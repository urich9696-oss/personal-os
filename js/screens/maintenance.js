(function () {
  const { ui } = window.PersonalOS;
  const { el } = ui;

  window.PersonalOS.screens = window.PersonalOS.screens || {};
  window.PersonalOS.screens.maintenance = async function mountMaintenance() {
    const ess = document.getElementById("maintenance-essentials");
    const sc = document.getElementById("maintenance-selfcare");

    ess.innerHTML = "";
    ess.appendChild(el("div", { class: "meta" }, "MVP: Essentials storage comes after core stability. (Next iteration)"));

    sc.innerHTML = "";
    sc.appendChild(el("div", { class: "meta" }, "MVP: Habits + reminders comes after core stability. (Next iteration)"));
  };
})();
