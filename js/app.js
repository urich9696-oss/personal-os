(function () {
  const buttons = document.querySelectorAll(".nav-btn");
  const screens = document.querySelectorAll(".screen");

  const mounted = { mindset:false, path:false, maintenance:false, finance:false };

  function setActive(target) {
    buttons.forEach((b) => b.classList.remove("active"));
    screens.forEach((s) => s.classList.remove("active"));

    const btn = document.querySelector(`.nav-btn[data-target="${target}"]`);
    const screen = document.getElementById("screen-" + target);

    if (btn) btn.classList.add("active");
    if (screen) screen.classList.add("active");
  }

  async function mountIfNeeded(target) {
    try {
      if (mounted[target]) return;

      const screensApi = (window.PersonalOS && window.PersonalOS.screens) ? window.PersonalOS.screens : {};
      const fn =
        target === "mindset" ? screensApi.mindset :
        target === "path" ? screensApi.path :
        target === "maintenance" ? screensApi.maintenance :
        target === "finance" ? screensApi.finance :
        null;

      if (typeof fn === "function") await fn();
      mounted[target] = true;

    } catch (e) {
      console.error("Mount error:", e);
    }
  }

  buttons.forEach((btn) => {
    const handler = async (e) => {
      e.preventDefault();
      const target = btn.dataset.target;
      setActive(target);
      await mountIfNeeded(target);
    };

    btn.addEventListener("click", handler, { passive:false });
    btn.addEventListener("touchend", handler, { passive:false });
  });

  async function boot() {
    setActive("path");
    await mountIfNeeded("path");
  }

  boot();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js");
    });
  }
})();
