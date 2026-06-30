const tabs = document.querySelectorAll(".tab");
const contentArea = document.getElementById("contentArea");

const pageCopy = {
  job: { title: "Job", desc: "Halaman Job aktif." },
  submit: { title: "Submit", desc: "Halaman Submit aktif." },
  deploy: { title: "Deploy", desc: "Halaman Deploy aktif." },
  wallet: { title: "Wallet", desc: "Kelola deposit & withdrawal." },
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
    return {
      id: String(u.id),
      first_name: u.first_name || "",
      username: u.username || "",
    };
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
      try {
        return decodeURIComponent(tgWebAppData);
      } catch {
        return tgWebAppData;
      }
    }
  }
  return "";
}

function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  const u1 = tg?.initDataUnsafe?.user;
  if (u1?.id) {
    return {
      id: String(u1.id),
      first_name: u1.first_name || "",
      username: u1.username || "",
    };
  }

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

function renderDefaultPage(tabKey) {
  const data = pageCopy[tabKey];
  contentArea.innerHTML = `<h1>${data.title}</h1><p>${data.desc}</p>`;
}

function getInitial(name = "") {
  return (name.trim()[0] || "U").toUpperCase();
}

/* ================= PROFILE ================= */
function renderProfilePage() {
  const user = getTelegramUser();
  const saved = getProfileDataByUser(user);
  const canSave = !!user?.id;

  const shownName = user?.first_name || "Unknown";
  const shownUsername = user?.username || "unknown";
  const shownId = user?.id || "-";

  contentArea.innerHTML = `
    <div class="profile-wrap">
      <section class="profile-hero">
        <div class="hero-top">
          <div class="avatar">${getInitial(shownName)}</div>
          <div>
            <div class="hero-name">${escapeHtml(shownName)}</div>
            <div class="hero-user">@${escapeHtml(shownUsername)}</div>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <div class="v">${escapeHtml(String(shownId))}</div>
            <div class="k">Telegram ID</div>
          </div>
          <div class="stat">
            <div class="v">${saved.ewalletProvider ? "Ready" : "Empty"}</div>
            <div class="k">E-Wallet</div>
          </div>
          <div class="stat">
            <div class="v">${saved.walletAddress ? "Ready" : "Empty"}</div>
            <div class="k">Xrocket Address</div>
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">Payout Settings</div>
            <div class="section-sub">Atur metode pembayaran reward kamu.</div>
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
              <select class="select" id="ewalletProvider">
                ${renderProviderOptions(saved.ewalletProvider)}
              </select>
            </div>
          </div>

          <button class="btn" id="saveProfileBtn" ${canSave ? "" : "disabled"}>
            ${canSave ? "Save Profile" : "Waiting Telegram Data..."}
          </button>
          <p class="hint" id="saveHint">${canSave ? "Siap disimpan." : "Data Telegram belum terdeteksi."}</p>
        </div>
      </section>
    </div>
  `;

  document.getElementById("saveProfileBtn")?.addEventListener("click", async () => {
    const currentUser = getTelegramUser();
    if (!currentUser?.id) return;

    const payload = {
      telegramId: String(currentUser.id),
      name: currentUser.first_name || "",
      username: currentUser.username || "",
      walletAddress: document.getElementById("walletAddress").value.trim(),
      ewalletNumber: document.getElementById("ewalletNumber").value.trim(),
      ewalletProvider: document.getElementById("ewalletProvider").value,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem("profileData:last", JSON.stringify(payload));
    localStorage.setItem(`profileData:${payload.telegramId}`, JSON.stringify(payload));

    const hint = document.getElementById("saveHint");
    hint.textContent = "Profile tersimpan ✅";
    hint.classList.add("ok");
  });
}

/* ================= WALLET ================= */
function renderWalletPage() {
  const user = getTelegramUser();
  const saved = getProfileDataByUser(user);

  const name = user?.first_name || "Unknown";
  const username = user?.username || "unknown";
  const telegramId = user?.id || "-";

  const ewalletReady = !!(saved.ewalletProvider && saved.ewalletNumber);
  const xrocketReady = !!saved.walletAddress;

  contentArea.innerHTML = `
    <div class="profile-wrap">
      <section class="profile-hero">
        <div class="hero-top">
          <div class="avatar">${getInitial(name)}</div>
          <div>
            <div class="hero-name">Wallet</div>
            <div class="hero-user">@${escapeHtml(username)}</div>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <div class="v">${ewalletReady ? "Ready" : "Empty"}</div>
            <div class="k">E-Wallet</div>
          </div>
          <div class="stat">
            <div class="v">${xrocketReady ? "Ready" : "Empty"}</div>
            <div class="k">Xrocket</div>
          </div>
          <div class="stat">
            <div class="v">${escapeHtml(String(telegramId))}</div>
            <div class="k">Telegram ID</div>
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">Metode Tersimpan</div>
            <div class="section-sub">Data diambil otomatis dari tab Profile.</div>
          </div>
        </div>

        <div class="form-grid">
          <div class="row">
            <label>E-Wallet</label>
            <input class="input" readonly value="${escapeHtml(saved.ewalletProvider || "-")} • ${escapeHtml(saved.ewalletNumber || "-")}" />
          </div>
          <div class="row">
            <label>Xrocket Address</label>
            <input class="input" readonly value="${escapeHtml(saved.walletAddress || "-")}" />
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">Actions</div>
            <div class="section-sub">Deposit / Withdraw sesuai metode pilihan.</div>
          </div>
        </div>

        <div class="form-grid">
          <div class="inline-2">
            <div class="row">
              <label>Nominal</label>
              <input class="input" id="amountInput" type="number" min="1000" step="1000" placeholder="Contoh: 10000" />
            </div>
            <div class="row">
              <label>Metode Withdraw</label>
              <select class="select" id="withdrawMethod">
                <option value="ewallet">E-Wallet (bayar.gg)</option>
                <option value="xrocket">Xrocket Address</option>
              </select>
            </div>
          </div>

          <button class="btn" id="depositBtn">Deposit</button>
          <button class="btn" id="withdrawBtn">Withdraw</button>
          <p class="hint" id="walletHint">Pilih nominal lalu klik aksi.</p>
        </div>
      </section>
    </div>
  `;

  document.getElementById("depositBtn")?.addEventListener("click", async () => {
    const amount = Number(document.getElementById("amountInput").value || 0);
    if (!amount || amount < 1000) return setWalletHint("Minimal deposit 1000.", true);

    // TODO backend: create deposit invoice
    // const url = await createDepositInvoice({ telegramId: user?.id, amount });
    // window.open(url, "_blank");

    setWalletHint(`Deposit request ${formatIDR(amount)} dibuat (stub). Hubungkan ke invoice backend.`, false);
  });

  document.getElementById("withdrawBtn")?.addEventListener("click", async () => {
    const amount = Number(document.getElementById("amountInput").value || 0);
    const method = document.getElementById("withdrawMethod").value;

    if (!amount || amount < 1000) return setWalletHint("Minimal withdraw 1000.", true);

    if (method === "ewallet") {
      if (!ewalletReady) return setWalletHint("E-Wallet belum lengkap di Profile.", true);

      // Generate bayar.gg payment link (template)
      const link = generateBayarGGLink({
        amount,
        provider: saved.ewalletProvider,
        ewalletNumber: saved.ewalletNumber,
        telegramId: user?.id || "",
        username: user?.username || "",
      });

      setWalletHint("Link bayar.gg berhasil dibuat. Membuka halaman pembayaran...", false);
      window.open(link, "_blank");
      return;
    }

    if (method === "xrocket") {
      if (!xrocketReady) return setWalletHint("Xrocket address belum diisi di Profile.", true);

      // TODO backend: process on-chain withdraw request
      setWalletHint(`Withdraw ke Xrocket address queued (stub): ${saved.walletAddress}`, false);
    }
  });

  function setWalletHint(text, isError = false) {
    const el = document.getElementById("walletHint");
    el.textContent = text;
    el.classList.toggle("ok", !isError);
  }
}

/**
 * Template link generator bayar.gg
 * NOTE: Sesuaikan format URL dengan endpoint bayar.gg yang kamu pakai.
 */
function generateBayarGGLink({ amount, provider, ewalletNumber, telegramId, username }) {
  const base = "https://bayar.gg/pay";
  const params = new URLSearchParams({
    amount: String(amount),
    channel: provider,          // contoh: DANA/OVO/GoPay
    target: ewalletNumber,      // nomor e-wallet user
    ref_id: `wd_${telegramId}_${Date.now()}`,
    note: `Withdraw @${username || "user"} (${telegramId})`,
  });
  return `${base}?${params.toString()}`;
}

/* ================= UTILS ================= */
function renderProviderOptions(selected = "") {
  const providers = ["DANA", "OVO", "GoPay", "ShopeePay", "LinkAja", "SeaBank", "Bank Transfer"];
  return providers.map((p) => `<option value="${p}" ${selected === p ? "selected" : ""}>${p}</option>`).join("");
}

function formatIDR(n) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ================= TAB NAV ================= */
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
    return renderDefaultPage(key);
  });
});

renderDefaultPage("deploy");
