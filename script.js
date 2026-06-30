const tabs = document.querySelectorAll(".tab");
const pageTitle = document.getElementById("pageTitle");
const pageDesc = document.getElementById("pageDesc");

const copy = {
  job: { title: "Job", desc: "Halaman Job aktif." },
  submit: { title: "Submit", desc: "Halaman Submit aktif." },
  deploy: { title: "Deploy", desc: "Halaman Deploy aktif." },
  wallet: { title: "Wallet", desc: "Halaman Wallet aktif." },
  profile: { title: "Profile", desc: "Halaman Profile aktif." },
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => {
      t.classList.remove("active");
      t.removeAttribute("aria-current");
    });

    tab.classList.add("active");
    tab.setAttribute("aria-current", "page");

    const key = tab.dataset.tab;
    pageTitle.textContent = copy[key].title;
    pageDesc.textContent = copy[key].desc;
  });
});
