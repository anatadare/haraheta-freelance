const tabs = document.querySelectorAll(".tab");
const contentArea = document.getElementById("contentArea");

const pageCopy = {
  job: { title: "Job", desc: "Halaman Job aktif." },
  submit: { title: "Submit", desc: "Halaman Submit aktif." },
  deploy: { title: "Deploy", desc: "Halaman Deploy aktif." },
  wallet: { title: "Wallet", desc: "Halaman Wallet aktif." },
  profile: { title: "Profile", desc: "Lengkapi data verifikasi akun." },
};

// Fallback data untuk testing non-Telegram
const fallbackUser = {
  id: "123456789",
  first_name: "User",
  username: "username_kamu",
};

// Ambil user dari Telegram Mini App jika tersedia
function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  const u = tg?.initDataUnsafe?.user;
  if (!u) return fallbackUser;
  return {
    id: String(u.id || ""),
    first_name: u.first_name || "",
    username: u.username || "",
  };
}

function renderDefaultPage(tabKey) {
  const data = pageCopy[tabKey];
  contentArea.innerHTML = `
    <h1 id="pageTitle">${data.title}</h1>
    <p id="pageDesc">${data.desc}</p>
  `;
}

function renderProfilePage() {
  const user = getTelegramUser();
  const saved = JSON.parse(localStorage.getItem("profileData") || "{}");

  contentArea.innerHTML = `
    <h1>Profile</h1>
    <p>Data ini dipakai untuk verifikasi dan mencegah double claim.</p>

    <section class="profile-card">
      <div class="profile-grid">
        <div class="row">
          <label>Nama</label>
          <input class="input" id="fullName" readonly value="${escapeHtml(user.first_name || "-")}" />
        </div>

        <div class="row">
          <label>Username</label>
          <input class="input" id="username" readonly value="@${escapeHtml(user.username || "tidak_ada_username")}" />
        </div>

        <div class="row">
          <label>Telegram ID</label>
          <input class="input" id="telegramId" readonly value="${escapeHtml(user.id || "-")}" />
        </div>

        <div class="row">
          <label>Wallet Address (untuk crypto)</label>
          <input class="input" id="walletAddress" placeholder="Contoh: 0x.... / T...." value="${escapeHtml(saved.walletAddress || "")}" />
        </div>

        <div class="row">
          <label>Nomor E-Wallet</label>
          <input class="input" id="ewalletNumber" placeholder="Contoh: 0812xxxxxx" value="${escapeHtml(saved.ewalletNumber || "")}" />
        </div>

        <div class="row">
          <label>Pembayaran E-Wallet yang didukung</label>
          <select class="select" id="ewalletProvider">
            ${renderProviderOptions(saved.ewalletProvider)}
          </select>
        </div>

        <button class="btn" id="saveProfileBtn">Save Profile</button>
        <p class="hint" id="saveHint">Belum disimpan.</p>
      </div>
    </section>
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

    // Simpan lokal (langsung berfungsi)
    localStorage.setItem("profileData", JSON.stringify(payload));

    // Contoh kirim ke backend (aktifkan saat endpoint sudah siap)
    // await saveProfileToDatabase(payload);

    const hint = document.getElementById("saveHint");
    hint.textContent = "Profile tersimpan ✅";
  });
}

function renderProviderOptions(selected = "") {
  const providers = [
    "DANA",
    "OVO",
    "GoPay",
    "ShopeePay",
    "LinkAja",
    "SeaBank",
    "Bank Transfer",
    "USDT (TRC20)",
    "USDT (BEP20)",
  ];
  return providers
    .map((p) => `<option value="${p}" ${selected === p ? "selected" : ""}>${p}</option>`)
    .join("");
}

// Siapkan endpoint nanti untuk anti double-claim
async function saveProfileToDatabase(payload) {
  // Ganti URL ini ke backend kamu
  const endpoint = "https://your-api.com/profile/upsert";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Gagal simpan profile ke database");
  }
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
    if (key === "profile") {
      renderProfilePage();
    } else {
      renderDefaultPage(key);
    }
  });
});

// default awal = Deploy
renderDefaultPage("deploy");
