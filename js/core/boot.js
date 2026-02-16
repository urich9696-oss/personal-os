(function () {
  "use strict";

  var APP_VERSION = "0.1.0";

  function setHeaderDate() {
    var el = document.getElementById("header-date");
    if (!el) return;
    el.textContent = UI.formatDateHuman(new Date());
  }

  function wireBottomNav() {
    var nav = document.querySelector(".bottom-nav");
    if (!nav) return;

    nav.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.classList && t.classList.contains("bottom-nav__btn")) {
        var route = t.getAttribute("data-route");
        if (!route) return;
        Router.go(route, {});
      }
    });
  }

  function ensureDefaultStart() {
    if (!location.hash || location.hash === "#") {
      location.hash = "#dashboard";
    }
  }

  function renderBootError(title, details) {
    var host = document.getElementById("app-content");
    if (!host) return;
    host.innerHTML = "";

    var card = UI.el("div", { className: "card tile" }, [
      UI.el("div", { className: "tile__label", text: title }, []),
      UI.el("div", { className: "tile__value", text: details }, [])
    ]);

    host.appendChild(card);
  }

  function hasQueryFlag(name) {
    try {
      var url = new URL(location.href);
      return url.searchParams.get(name) !== null;
    } catch (e) {
      return false;
    }
  }

  async function killSwitchNoSW() {
    try {
      if (!("serviceWorker" in navigator)) return false;

      var regs = await navigator.serviceWorker.getRegistrations();
      for (var i = 0; i < regs.length; i++) {
        try { await regs[i].unregister(); } catch (e) {}
      }

      if (window.caches && caches.keys) {
        var keys = await caches.keys();
        for (var k = 0; k < keys.length; k++) {
          try { await caches.delete(keys[k]); } catch (e) {}
        }
      }

      var u = new URL(location.href);
      u.searchParams.delete("nosw");
      history.replaceState({}, "", u.toString());
      location.reload();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) consideration: return;

    try {
      var reg = await navigator.serviceWorker.register("./service-worker.js?v=" + APP_VERSION, { scope: "./" });

      reg.addEventListener("updatefound", function () {
        UI.toast("Update found…", 2000);
      });

      if (reg.waiting) {
        UI.toast("Update ready. Reload app.", 2500);
      }

      var refreshed = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (refreshed) return;
        refreshed = true;
        UI.toast("Updated. Reloading…", 1500);
        setTimeout(function () { location.reload(); }, 500);
      });
    } catch (e) {
      // SW errors must not break boot
    }
  }

  async function boot() {
    setHeaderDate();
    wireBottomNav();
    ensureDefaultStart();

    await State.init();
    await State.ensureTodayState();

    // Finance month logic
    try {
      var res = await State.financeEnsureMonth();
      if (res && res.showReminder) {
        UI.toast("Finance: Monat ausfüllen", 2500);
      }
    } catch (e) {}

    Router.init();
    await registerSW();
  }

  (async function () {
    try {
      if (hasQueryFlag("nosw")) {
        await killSwitchNoSW();
        return;
      }
      await boot();
    } catch (e) {
      var msg = (e && e.message) ? e.message : String(e);
      renderBootError("Boot Error", msg);
    }
  })();
})();
