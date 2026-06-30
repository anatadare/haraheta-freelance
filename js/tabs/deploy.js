window.renderDeployTab = function (contentArea) {
  contentArea.innerHTML = `
    <section class="section-card">
      <div class="section-head">
        <div>
          <div class="section-title">Deploy Job</div>
          <div class="section-sub">Pilih kategori untuk mulai rilis kerjaan ke worker.</div>
        </div>
      </div>

      <div class="deploy-grid" id="deployGrid">
        <button class="deploy-card" data-deploy-cat="member">
          <div class="deploy-icon">👑</div>
          <div class="deploy-name">Beli Member</div>
          <div class="deploy-desc">Tambah member/channel/group.</div>
        </button>

        <button class="deploy-card" data-deploy-cat="referral">
          <div class="deploy-icon">🔗</div>
          <div class="deploy-name">Referral</div>
          <div class="deploy-desc">Campaign referral user baru.</div>
        </button>

        <button class="deploy-card" data-deploy-cat="socmed">
          <div class="deploy-icon">📱</div>
          <div class="deploy-name">Kebutuhan Socmed</div>
          <div class="deploy-desc">Like, comment, follow, subscribe, dll.</div>
        </button>

        <button class="deploy-card" data-deploy-cat="game">
          <div class="deploy-icon">🎮</div>
          <div class="deploy-name">Akun / Item Game</div>
          <div class="deploy-desc">Jasa game account & item task.</div>
        </button>
      </div>
    </section>

    <section class="section-card">
      <div class="section-head">
        <div>
          <div class="section-title">Draft Deploy</div>
          <div class="section-sub">Isi detail awal job, nanti bisa kamu revisi lagi.</div>
        </div>
      </div>

      <div class="form-grid">
        <div class="row">
          <label>Kategori</label>
          <input id="deployCategory" class="input" readonly value="-" />
        </div>

        <div class="row">
          <label>Judul Job</label>
          <input id="deployTitle" class="input" placeholder="Contoh: Boost 100 member Telegram" />
        </div>

        <div class="inline-2">
          <div class="row">
            <label>Jumlah Worker</label>
            <input id="deployWorkers" class="input" type="number" min="1" step="1" placeholder="Contoh: 50" />
          </div>
          <div class="row">
            <label>Budget per Task (IDR)</label>
            <input id="deployReward" class="input" type="number" min="100" step="100" placeholder="Contoh: 2500" />
          </div>
        </div>

        <div class="row">
          <label>Deskripsi Singkat</label>
          <textarea id="deployDesc" class="input" rows="4" placeholder="Tulis requirement singkat job..."></textarea>
        </div>

        <button id="deployCreateBtn" class="btn">Buat Draft Job</button>
        <p id="deployHint" class="hint">Pilih kategori dulu, lalu isi draft.</p>
      </div>
    </section>
  `;

  const cards = contentArea.querySelectorAll(".deploy-card");
  const categoryInput = contentArea.querySelector("#deployCategory");
  const hint = contentArea.querySelector("#deployHint");
  const grid = contentArea.querySelector("#deployGrid");

  let selectedCategory = "";

  const categoryMap = {
    member: "Beli Member",
    referral: "Referral",
    socmed: "Kebutuhan Socmed",
    game: "Akun / Item Game",
  };

  function selectCategory(card) {
    cards.forEach((c) => c.classList.remove("active"));
    card.classList.add("active");

    const key = card.dataset.deployCat;
    selectedCategory = key;
    categoryInput.value = categoryMap[key] || "-";
    hint.textContent = `Kategori dipilih: ${categoryInput.value}`;
    hint.classList.add("ok");

    // biar card kepilih kelihatan jelas di area scroll
    card.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => selectCategory(card));
  });

  // default pilih card pertama
  if (cards.length > 0) {
    selectCategory(cards[0]);
    grid.scrollLeft = 0;
  }

  contentArea.querySelector("#deployCreateBtn")?.addEventListener("click", () => {
    const title = contentArea.querySelector("#deployTitle").value.trim();
    const workers = Number(contentArea.querySelector("#deployWorkers").value || 0);
    const reward = Number(contentArea.querySelector("#deployReward").value || 0);
    const desc = contentArea.querySelector("#deployDesc").value.trim();

    if (!selectedCategory) {
      hint.textContent = "Pilih kategori dulu.";
      hint.classList.remove("ok");
      return;
    }
    if (!title) {
      hint.textContent = "Judul job wajib diisi.";
      hint.classList.remove("ok");
      return;
    }
    if (!workers || workers < 1) {
      hint.textContent = "Jumlah worker minimal 1.";
      hint.classList.remove("ok");
      return;
    }
    if (!reward || reward < 100) {
      hint.textContent = "Budget per task minimal 100.";
      hint.classList.remove("ok");
      return;
    }

    const draft = {
      id: `draft_${Date.now()}`,
      category: categoryMap[selectedCategory],
      title,
      workers,
      reward,
      desc,
      status: "draft",
      createdAt: new Date().toISOString(),
    };

    const oldDrafts = JSON.parse(localStorage.getItem("deployDrafts") || "[]");
    oldDrafts.unshift(draft);
    localStorage.setItem("deployDrafts", JSON.stringify(oldDrafts));

    hint.textContent = "Draft job berhasil dibuat ✅";
    hint.classList.add("ok");
  });
};
