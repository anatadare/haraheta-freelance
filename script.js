const tabs = document.querySelectorAll(".tab");
const contentArea = document.getElementById("contentArea");

const pageCopy = {
  job: { title: "Job", desc: "Halaman Job aktif." },
  submit: { title: "Submit", desc: "Halaman Submit aktif." },
  deploy: { title: "Deploy", desc: "Halaman Deploy aktif." },
  wallet: { title: "Wallet", desc: "Halaman Wallet aktif." },
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

function parseInitDataRaw(initData = "") {
  // parse query-string style "user=%7B...%7D&..."
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const u = JSON.parse(userRaw);
    return {
      id: u?.id ? String(u.id) : "",
      first_name: u?.first_name || "",
      username: u?.username || "",
    };
  } catch {
    return null;
  }
}

function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return null;

  // 1) paling umum
  const u1 = tg.initDataUnsafe?.user;
  if (u1?.id) {
    return {
      id: String(u1.id),
      first_name: u1.first_name || "",
      username: u1.username || "",
    };
  }

  // 2) parse dari initData raw
  const u2 = parseInitDataRaw(tg.initData || "");
  if (u2?.id) return u2;

  // 3) kadang ada di unsafe object lain (defensive)
  const maybeUser = tg?.unsafeData?.user || tg?.WebAppUser;
  if (maybeUser?.id) {
    return {
      id: String(maybeUser.id),
      first_name: maybeUser.first_name || "",
      username: maybeUser.username || "",
    };
  }

  return null;
}

function renderDefaultPage(tabKey) {
  const data = pageCopy[tabKey];
  contentArea.innerHTML = `<h1>${data.title}</h1><p>${data.desc}</p>`;
}

function getInitial(name = "") {
  return (name.trim()[0] || "U").toUpperCase();
}

function renderProfilePage() {
  const user = getTelegramUser();
  const saved = JSON.parse(localStorage.getItem("profileData:last") || "{}");

  // tetap tampilkan UI, tapi disable save kalau user Telegram belum ada
  const canSave = !!user?.id;

  const shownName = user?.first_name || saved.name || "Unknown";
  const shownUsername = user?.username || saved.username || "unknown";
  const shownId = user?.id || saved.telegramId || "-";

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
            <div class="k">Wallet Address</div>
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
            <label>Wallet Address (Crypto Wallet)</label>
            <input class="input" id="walletAddress" placeholder="Contoh: 0x..., T..., bc1..." value="${escapeHtml(saved.walletAddress || "")}" />
          </div>

          <div class="inline-2">
            <div class="row">
              <label>Nomor E-Wallet</label>
              <input class="input" id="ewalletNumber" placeholder="Contoh: 0812xxxxxx" value="${escapeHtml(saved.ewalletNumber || "")}" />
            </div>
            <div class="row">
              <label>Provider E-Wallet (Support Bayar)</label>
              <select class="select" id="ewalletProvider">
                ${renderProviderOptions(saved.ewalletProvider)}
              </select>
            </div>
          </div>

          <button class="btn" id="saveProfileBtn" ${canSave ? "" : "disabled"}>${canSave ? "Save Profile" : "Waiting Telegram Data..."}</button>
          <p class="hint" id="saveHint">
            ${canSave ? "Siap disimpan." : "Data Telegram belum terdeteksi. Buka dari tombol menu bot (WebApp button), bukan link preview/cache."}
          </p>
        </div>
      </section>
    </div>
  `;

  const saveBtn = document.getElementById("saveProfileBtn");
  saveBtn?.addEventListener("click", async () => {
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

    // simpan cache terakhir + per-user key
    localStorage.setItem("profileData:last", JSON.stringify(payload));
    localStorage.setItem(`profileData:${payload.telegramId}`, JSON.stringify(payload));

    // aktifkan kalau endpoint backend siap:
    // await saveProfileToDatabase(payload);

    const hint = document.getElementById("saveHint");
    hint.textContent = "Profile tersimpan ✅";
    hint.classList.add("ok");
  });
}

function renderProviderOptions(selected = "") {
  const providers = ["DANA", "OVO", "GoPay", "ShopeePay", "LinkAja", "SeaBank", "Bank Transfer"];
  return providers.map((p) => `<option value="${p}" ${selected === p ? "selected" : ""}>${p}</option>`).join("");
}

async function saveProfileToDatabase(payload) {
  const endpoint = "https://your-api.com/profile/upsert";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Gagal simpan profile ke database");
  return res.json();
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
    if (key === "profile") renderProfilePage();
    else renderDefaultPage(key);
  });
});

renderDefaultPage("deploy");
