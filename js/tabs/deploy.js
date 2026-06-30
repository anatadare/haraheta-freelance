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
        <button class="deploy-card" data-deploy-cat="member" type="button">
          <span class="deploy-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3 14.4 8.1 20 8.8l-4.1 3.9 1 5.6L12 15.8 7.1 18.3l1-5.6L4 8.8l5.6-.7L12 3Z" stroke-width="1.8" stroke="currentColor"/>
            </svg>
          </span>
          <div class="deploy-name">Beli Member</div>
          <div class="deploy-desc">Tambah member/channel/group.</div>
        </button>

        <button class="deploy-card" data-deploy-cat="referral" type="button">
          <span class="deploy-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M10 14 8 16a3 3 0 0 1-4-4l2-2a3 3 0 0 1 4 0" stroke-width="1.8" stroke="currentColor" stroke-linecap="round"/>
              <path d="M14 10 16 8a3 3 0 1 1 4 4l-2 2a3 3 0 0 1-4 0" stroke-width="1.8" stroke="currentColor" stroke-linecap="round"/>
              <path d="M9 15 15 9" stroke-width="1.8" stroke="currentColor" stroke-linecap="round"/>
            </svg>
          </span>
          <div class="deploy-name">Referral</div>
          <div class="deploy-desc">Campaign referral user baru.</div>
        </button>

        <button class="deploy-card" data-deploy-cat="socmed" type="button">
          <span class="deploy-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="7" y="2.8" width="10" height="18.4" rx="2.2" stroke-width="1.8" stroke="currentColor"/>
              <circle cx="12" cy="17.8" r="0.9" fill="currentColor"/>
              <path d="M10 5.8h4" stroke-width="1.8" stroke="currentColor" stroke-linecap="round"/>
            </svg>
          </span>
          <div class="deploy-name">Kebutuhan Socmed</div>
          <div class="deploy-desc">Like, comment, follow, subscribe, dll.</div>
        </button>

        <button class="deploy-card" data-deploy-cat="game" type="button">
          <span class="deploy-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 5.4l-.8 3.8a2.2 2.2 0 0 1-3.6 1.2l-2.1-1.8a3.5 3.5 0 0 0-4.8 0l-2.1 1.8a2.2 2.2 0 0 1-3.6-1.2l-.8-3.8A4.5 4.5 0 0 1 7.5 8Z" stroke-width="1.8" stroke="currentColor"/>
              <path d="M8.5 12h3M10 10.5v3" stroke-width="1.8" stroke="currentColor" stroke-linecap="round"/>
              <circle cx="15.8" cy="11.2" r=".8" fill="currentColor"/>
              <circle cx="17.5" cy="13" r=".8" fill="currentColor"/>
            </svg>
          </span>
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

        <button id="deployCreateBtn" class="btn" type="button">Buat Draft Job</button>
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
