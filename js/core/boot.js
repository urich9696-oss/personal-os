(function () {
  async function setNetBadge() {
    const badge = document.getElementById("netBadge");
    if (!badge) return;
    const online = navigator.onLine;
    badge.textContent = online ? "Online" : "Offline";
  }

  function wireNetEvents() {
    window.addEventListener("online", setNetBadge);
    window.addEventListener("offline", setNetBadge);
    setNetBadge();
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      // use relative to work under repo subpath
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (e) {
      console.warn("SW register failed", e);
    }
  }

  function wireGlobalErrorGuards() {
    window.addEventListener("error", function (e) {
      try {
        if (window.POS && window.POS.ui) window.POS.ui.toast("Error: " + (e.message || "unknown"));
      } catch (_) {}
      // Do not prevent default; but ensure app doesn't hard-stop.
    });

    window.addEventListener("unhandledrejection", function (e) {
      try {
        if (window.POS && window.POS.ui) window.POS.ui.toast("Promise error");
      } catch (_) {}
    });
  }

  async function start() {
    wireGlobalErrorGuards();
    wireNetEvents();

    // Ensure core objects exist
    if (!window.POS || !window.POS.state || !window.POS.router) {
      console.error("Core not ready");
      return;
    }

    // Initialize DB/settings (never crash boot)
    let settings = null;
    try {
      settings = await window.POS.state.getSettings();
    } catch (e) {
      console.error("Settings read failed", e);
    }

    // Bind nav handlers
    try {
      window.POS.router.bindBottomNav();
    } catch (e) {
      console.error("Nav bind failed", e);
    }

    // Start screen must ALWAYS be dashboard
    try {
      await window.POS.router.go("dashboard", {});
    } catch (e) {
      console.error("Router start failed", e);
      // hard fallback: still show something
      try {
        const root = document.getElementById("screenRoot");
        if (root) root.textContent = "Boot failed. Reload app.";
      } catch (_) {}
    }

    // Register SW after initial paint
    setTimeout(() => { registerSW(); }, 250);
  }

  window.POS = window.POS || {};
  window.POS.boot = { start: start };
})();
