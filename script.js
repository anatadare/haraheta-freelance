const tabs = document.querySelectorAll(".tab");
const contentArea = document.getElementById("contentArea");

const pageCopy = {
  job: { title: "Job", desc: "Halaman Job aktif." },
  submit: { title: "Submit", desc: "Halaman Submit aktif." },
  deploy: { title: "Deploy", desc: "Halaman Deploy aktif." },
  wallet: { title: "Wallet", desc: "Kelola deposit & withdraw." },
  profile: { title: "Profile", desc: "Lengkapi data payout akun." },
};

(function initTelegramWebApp() {
  if (window.Telegram?.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    } catch (_) {}
  }
})();

function parseUserFromQueryString(qs = "") {
  if (!qs) return null;
  const params = new URLSearchParams(qs);
  const raw = params.get("user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    if (!u?.id) return null;
    return { id: String(u.id), first_name: u.first_name || "", username: u.username || "" };
  } catch {
    return null;
  }
}

function extractTgWebAppDataFromUrl() {
  const candidates = [];
  candidates.push(window.location.search?.replace(/^\?/, "") || "");
  const hash = window.location.hash || "";
  if (hash.startsWith("#")) {
    candidates.push(hash.slice(1));
    const qIndex = hash.indexOf("?");
    if (qIndex >= 0) candidates.push(hash.slice(qIndex + 1));
  }

  for (const c of candidates) {
    if (!c) continue;
    const p = new URLSearchParams(c);
    const tgWebAppData = p.get("tgWebAppData");
    if (tgWebAppData) {
      try { return decodeURIComponent(tgWebAppData); } catch { return tgWebAppData; }
    }
  }
  return "";
}

function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  const u1 = tg?.initDataUnsafe?.user;
  if (u1?.id) return { id: String(u1.id), first_name: u1.first_name || "", username: u1.username || "" };

  const u2 = parseUserFromQueryString(tg?.initData || "");
  if (u2?.id) return u2;

  const u3 = parseUserFromQueryString(extractTgWebAppDataFromUrl());
  if (u3?.id) return u3;

  return null;
}

function getProfileDataByUser(user) {
  if (!user?.id) return JSON.parse(localStorage.getItem("profileData:last") || "{}");
  return (
    JSON.parse(localStorage.getItem(`profileData:${user.id}`) || "null") ||
    JSON.parse(localStorage.getItem("profileData:last") || "{}")
  );
}

function getInitial(name = "") {
  return (name.trim()[0] || "U").toUpperCase();
}

function getUserLevel(completedTasks = 0) {
  const n = Number(completedTasks) || 0;
  if (n >= 2000) return "Elite";
  if (n >= 800) return "Platinum";
  if (n >= 300) return "Gold";
  if (n >= 100) return "Silver";
  if (n >= 25) return "Bronze";
  return "Beginner";
}

function generateWorkerId(telegramId = "") {
  const seed = String(telegramId || "0");
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  const base = Math.abs(h >>> 0).toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HH-${base.slice(0, 4).padEnd(4, "X")}-${rand}`;
}

function getWorkerId(user) {
  const tgId = user?.id ? String(user.id) : "";
  const key = tgId ? `workerId:${tgId}` : "workerId:last";
  let wid = localStorage.getItem(key);
  if (!wid) {
    wid = generateWorkerId(tgId);
    localStorage.setItem(key, wid);
  }
  return wid;
}

function renderDefaultPage(tabKey) {
  const data = pageCopy[tabKey] || { title: "Page", desc: "Halaman aktif." };
  contentArea.innerHTML = `<h1>${data.title}</h1><p>${data.desc}</p>`;
}

function renderDeployPage() {
  if (typeof window.renderDeployTab === "function") {
    return window.renderDeployTab(contentArea);
  }
  return renderDefaultPage("deploy");
}

function renderProfilePage() {
  const user = getTelegramUser();
  const saved = getProfileDataByUser(user);
  const canSave = !!user?.id;

  const shownName = user?.first_name || "Unknown";
  const shownUsername = user?.username || "unknown";
  const workerId = getWorkerId(user);

  const tasksCompletedRaw = saved.tasksCompleted ?? saved.completedTasks ?? saved.task_completed ?? saved.totalTasks ?? 0;
  const totalEarningsRaw = saved.totalEarnings ?? saved.earnings ?? saved.total_earnings ?? saved.income ?? 0;

  const tasksCompleted = Number(tasksCompletedRaw) || 0;
  const totalEarnings = Number(totalEarningsRaw) || 0;
  const level = getUserLevel(tasksCompleted);

  contentArea.innerHTML = `
    <div class="profile-wrap">
      <section class="profile-hero">
        <div class="hero-top">
          <div class="avatar">${getInitial(shownName)}</div>
          <div>
            <div class="hero-name">${escapeHtml(shownName)}</div>
            <div class="hero-user">@${escapeHtml(shownUsername)}</div>
          </div>
          <div class="hero-telegram-id" title="Worker ID">${escapeHtml(workerId)}</div>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <div class="v">${escapeHtml(level)}</div>
            <div class="k">Level</div>
          </div>
          <div class="stat">
            <div class="v">${escapeHtml(String(tasksCompleted))}</div>
            <div class="k">Tasks Completed</div>
          </div>
          <div class="stat">
            <div class="v">${escapeHtml(formatIDR(totalEarnings))}</div>
            <div class="k">Total Earnings</div>
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">Payout Settings</div>
            <div class="section-sub">Data ini dipakai di tab Wallet.</div>
          </div>
        </div>

        <div class="form-grid">
          <div class="row">
            <label>Xrocket Wallet Address</label>
            <input class="input" id="walletAddress" placeholder="Contoh: 0x..., T..., bc1..." value="${escapeHtml(saved.walletAddress || "")}" />
          </div>

          <div class="inline-2">
            <div class="row">
              <label>Nomor E-Wallet</label>
              <input class="input" id="ewalletNumber" placeholder="Contoh: 0812xxxxxx" value="${escapeHtml(saved.ewalletNumber || "")}" />
            </div>
            <div class="row">
              <label>Provider E-Wallet</label>
              <select class="select" id="ewalletProvider">${renderProviderOptions(saved.ewalletProvider)}</select>
            </div>
          </div>

          <button class="btn" id="saveProfileBtn" ${canSave ? "" : "disabled"}>${canSave ? "Save Profile" : "Waiting Telegram Data..."}</button>
          <p class="hint" id="saveHint">${canSave ? "Siap disimpan." : "Data Telegram belum terdeteksi."}</p>
        </div>
      </section>
    </div>
  `;

  document.getElementById("saveProfileBtn")?.addEventListener("click", () => {
    const currentUser = getTelegramUser();
    if (!currentUser?.id) return;

    const currentWorkerId = getWorkerId(currentUser);

    const payload = {
      workerId: currentWorkerId,
      telegramId: String(currentUser.id),
      name: currentUser.first_name || "",
      username: currentUser.username || "",
      walletAddress: document.getElementById("walletAddress").value.trim(),
      ewalletNumber: document.getElementById("ewalletNumber").value.trim(),
      ewalletProvider: document.getElementById("ewalletProvider").value,
      tasksCompleted,
      totalEarnings,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem("profileData:last", JSON.stringify(payload));
    localStorage.setItem(`profileData:${payload.telegramId}`, JSON.stringify(payload));

    const hint = document.getElementById("saveHint");
    hint.textContent = "Profile tersimpan ✅";
    hint.classList.add("ok");
  });
}

/* API-only FX (Frankfurter) */
const FX_CACHE_KEY = "fx:IDRUSD";
const FX_CACHE_TTL_MS = 30 * 60 * 1000;

async function getLiveUsdPerIdr() {
  // pakai cache dulu
  const raw = localStorage.getItem(FX_CACHE_KEY);
  if (raw) {
    try {
      const c = JSON.parse(raw);
      const age = Date.now() - (c.ts || 0);
      if (c.rate && age < FX_CACHE_TTL_MS) return c.rate;
    } catch {}
  }

  // hit API Frankfurter
  const res = await fetch("https://api.frankfurter.app/latest?base=IDR&symbols=USD", {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("FX fetch failed");

  const data = await res.json();
  const rate = Number(data?.rates?.USD || 0); // 1 IDR = ? USD
  if (!rate) throw new Error("Invalid FX rate");

  localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
  return rate;
}

function formatUSDFromIDR(idrAmount, usdPerIdr) {
  const usd = (Number(idrAmount) || 0) * (Number(usdPerIdr) || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(usd);
}

function renderWalletPage() {
  const user = getTelegramUser();
  const saved = getProfileDataByUser(user);

  const ewalletReady = !!(saved.ewalletProvider && saved.ewalletNumber);
  const xrocketReady = !!saved.walletAddress;

  const balance = Number(localStorage.getItem("walletBalance") || 0);

  contentArea.innerHTML = `
    <div class="profile-wrap">
      <section class="balance-box">
        <div class="balance-label">TOTAL BALANCE</div>
        <div class="balance-main">${formatIDR(balance)}</div>
        <div class="balance-sub" id="usdLiveText">Loading live USD...</div>
      </section>

      <section class="section-card">
        <div class="action-grid">
          <button class="action-btn" id="depositBtn">↓ Deposit</button>
          <button class="action-btn" id="withdrawBtn">↑ Withdraw</button>
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">Withdraw Settings</div>
            <div class="section-sub">Data otomatis dari Profile.</div>
          </div>
        </div>

        <div class="form-grid">
          <div class="inline-2">
            <div class="row">
              <label>Nominal</label>
              <input class="input" id="amountInput" type="number" min="1000" step="1000" placeholder="Contoh: 10000" />
            </div>
            <div class="row">
              <label>Metode</label>
              <select class="select" id="withdrawMethod">
                <option value="ewallet">E-Wallet (bayar.gg)</option>
                <option value="xrocket">Xrocket Address</option>
              </select>
            </div>
          </div>

          <div class="row">
            <label>E-Wallet</label>
            <input class="input" readonly value="${escapeHtml(saved.ewalletProvider || "-")} • ${escapeHtml(saved.ewalletNumber || "-")}" />
          </div>

          <div class="row">
            <label>Xrocket Address</label>
            <input class="input" readonly value="${escapeHtml(saved.walletAddress || "-")}" />
          </div>

          <p class="hint" id="walletHint">Pilih nominal lalu klik Deposit / Withdraw.</p>
        </div>
      </section>
    </div>
  `;

  (async () => {
    const usdEl = document.getElementById("usdLiveText");
    if (!usdEl) return;

    try {
      const usdPerIdr = await getLiveUsdPerIdr();
      usdEl.textContent = formatUSDFromIDR(balance, usdPerIdr);
    } catch {
      usdEl.textContent = "USD unavailable";
    }
  })();

  document.getElementById("depositBtn")?.addEventListener("click", () => {
    const amount = Number(document.getElementById("amountInput").value || 0);
    if (!amount || amount < 1000) return setWalletHint("Minimal deposit 1000.", true);

    const newBal = balance + amount;
    localStorage.setItem("walletBalance", String(newBal));
    setWalletHint(`Deposit ${formatIDR(amount)} berhasil (mode test). Refresh tab Wallet untuk update tampilan.`, false);
  });

  document.getElementById("withdrawBtn")?.addEventListener("click", () => {
    const amount = Number(document.getElementById("amountInput").value || 0);
    const method = document.getElementById("withdrawMethod").value;
    const currentBal = Number(localStorage.getItem("walletBalance") || 0);

    if (!amount || amount < 1000) return setWalletHint("Minimal withdraw 1000.", true);
    if (amount > currentBal) return setWalletHint("Saldo tidak cukup.", true);

    if (method === "ewallet") {
      if (!ewalletReady) return setWalletHint("E-Wallet belum lengkap di Profile.", true);

      const link = generateBayarGGLink({
        amount,
        provider: saved.ewalletProvider,
        ewalletNumber: saved.ewalletNumber,
        telegramId: user?.id || "",
        username: user?.username || "",
      });

      localStorage.setItem("walletBalance", String(currentBal - amount));
      setWalletHint("Link bayar.gg dibuat. Membuka halaman...", false);
      window.open(link, "_blank");
      return;
    }

    if (method === "xrocket") {
      if (!xrocketReady) return setWalletHint("Xrocket address belum diisi di Profile.", true);

      localStorage.setItem("walletBalance", String(currentBal - amount));
      setWalletHint(`Withdraw ke Xrocket diproses (test): ${saved.walletAddress}`, false);
    }
  });

  function setWalletHint(text, isError = false) {
    const el = document.getElementById("walletHint");
    el.textContent = text;
    el.classList.toggle("ok", !isError);
  }
}

function generateBayarGGLink({ amount, provider, ewalletNumber, telegramId, username }) {
  const base = "https://bayar.gg/pay";
  const params = new URLSearchParams({
    amount: String(amount),
    channel: provider,
    target: ewalletNumber,
    ref_id: `wd_${telegramId}_${Date.now()}`,
    note: `Withdraw @${username || "user"} (${telegramId})`,
  });
  return `${base}?${params.toString()}`;
}

function renderProviderOptions(selected = "") {
  const providers = ["DANA", "OVO", "GoPay", "ShopeePay", "LinkAja", "SeaBank", "Bank Transfer"];
  return providers.map((p) => `<option value="${p}" ${selected === p ? "selected" : ""}>${p}</option>`).join("");
}

function formatIDR(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(n || 0);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => {
      t.classList.remove("active");
      t.removeAttribute("aria-current");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-current", "page");

    const key = tab.dataset.tab;
    if (key === "profile") return renderProfilePage();
    if (key === "wallet") return renderWalletPage();
    if (key === "deploy") return renderDeployPage();
    return renderDefaultPage(key);
  });
});

renderDeployPage();
