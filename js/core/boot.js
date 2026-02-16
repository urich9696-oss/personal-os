(function () {
  "use strict";

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
    // Dashboard ist KEIN Tab, sondern Startscreen.
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

  async function boot() {
    setHeaderDate();
    wireBottomNav();
    ensureDefaultStart();

    // DB + State init (no screen may touch IndexedDB directly)
    await State.init();
    await State.ensureTodayState();

    Router.init();
  }

  (async function () {
    try {
      await boot();
    } catch (e) {
      var msg = (e && e.message) ? e.message : String(e);
      renderBootError("Boot Error", msg);
    }
  })();
})();
