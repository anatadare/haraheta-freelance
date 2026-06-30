const tabs = document.querySelectorAll(".tab");
const contentArea = document.getElementById("contentArea");

const pageCopy = {
  job: { title: "Job", desc: "Halaman Job aktif." },
  submit: { title: "Submit", desc: "Halaman Submit aktif." },
  deploy: { title: "Deploy", desc: "Halaman Deploy aktif." },
  wallet: { title: "Wallet", desc: "Halaman Wallet aktif." },
  profile: { title: "Profile", desc: "Lengkapi data payout akun." },
};

function getTelegramUserStrict() {
  const tg = window.Telegram?.WebApp;
  const u = tg?.initDataUnsafe?.user;

  // Wajib data asli Telegram
  if (!tg || !u || !u.id) return null;

  return {
    id: String(u.id || ""),
    first_name: u.first_name || "",
    username: u.username || "",
  };
}

function renderDefaultPage(tabKey) {
  const data = pageCopy[tabKey];
  contentArea.innerHTML = `<h1>${data.title}</h1><p>${data.desc}</p>`;
}

function getInitial(name = "") {
  return (name.trim()[0] || "U").toUpperCase();
}

function renderProfilePage() {
  const user = getTelegramUserStrict();

  // Kalau bukan dibuka dari Telegram Mini App, tampilkan warning
  if (!user) {
    contentArea.innerHTML = `
      <div class="section-card">
        <div class="section-head">
          <div>
            <div class="section-title">Telegram Data Not Found</div>
            <div class="section-sub">Buka app ini dari Telegram Mini App untuk memuat data asli user.</div>
          </div>
        </div>
        <p class="hint">Status: fallback dimatikan. Tidak pakai data dummy.</p>
      </div>
    `;
    return;
  }

  const storageKey = `profileData:${user.id}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");

  contentArea.innerHTML = `
    <div class="profile-wrap">
      <section class="profile-hero">
        <div class="hero-top">
          <div class="avatar">${getInitial(user.first_name)}</div>
          <div>
            <div class="hero-name">${escapeHtml(user.first_name || "User")}</div>
            <div class="hero-user">@${escapeHtml(user.username || "no_username")}</div>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <div class="v">${escapeHtml(String(user.id || "-"))}</div>
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

          <button class="btn" id="saveProfileBtn">Save Profile</button>
          <p class="hint" id="saveHint">Belum disimpan.</p>
        </div>
      </section>
    </div>
  `;

  document.getElementById("saveProfileBtn").addEventListener("click", async () => {
    const payload = {
      telegramId: String(user.id || ""),
      name: user.first_name || "",
      username: user.username || "",
      walletAddress: document.getElementById("walletAddress").value.trim(),
      ewalletNumber: document.getElementById("ewalletNumber").value.trim(),
      ewalletProvider: document.getElementById("ewalletProvider").value,
      updatedAt: new Date().toISOString(),
    };

    // Simpan per-user (berdasarkan telegramId asli)
    localStorage.setItem(storageKey, JSON.stringify(payload));

    // Aktifkan kalau endpoint backend kamu sudah jadi:
    // await saveProfileToDatabase(payload);

    const hint = document.getElementById("saveHint");
    hint.textContent = "Profile tersimpan ✅ (Telegram data aktif)";
    hint.classList.add("ok");
  });
}

function renderProviderOptions(selected = "") {
  const providers = ["DANA", "OVO", "GoPay", "ShopeePay", "LinkAja", "SeaBank", "Bank Transfer"];
  return providers
    .map((p) => `<option value="${p}" ${selected === p ? "selected" : ""}>${p}</option>`)
    .join("");
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
