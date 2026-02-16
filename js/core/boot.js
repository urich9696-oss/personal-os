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
    // Beim ersten Laden ohne Hash -> Dashboard erzwingen.
    if (!location.hash || location.hash === "#") {
      location.hash = "#dashboard";
    }
  }

  function boot() {
    setHeaderDate();
    wireBottomNav();
    ensureDefaultStart();
    Router.init();
  }

  try {
    boot();
  } catch (e) {
    var host = document.getElementById("app-content");
    if (host) {
      var msg = (e && e.message) ? e.message : String(e);
      host.innerHTML = "";
      host.appendChild(UI.el("div", { className: "card tile", html: "<div class='tile__label'>Boot Error</div><div class='tile__value'>" + msg + "</div>" }, []));
    }
  }
})();
