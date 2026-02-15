(function () {
  const buttons = document.querySelectorAll(".nav-btn");
  const screens = document.querySelectorAll(".screen");

  function setActive(target) {
    buttons.forEach((b) => b.classList.remove("active"));
    screens.forEach((s) => s.classList.remove("active"));

    const btn = document.querySelector(`.nav-btn[data-target="${target}"]`);
    const screen = document.getElementById("screen-" + target);

    if (btn) btn.classList.add("active");
    if (screen) screen.classList.add("active");
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setActive(btn.dataset.target));
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js");
    });
  }
})();
