(function () {
  "use strict";

  var current = {
    screen: "dashboard",
    params: {}
  };

  function parseHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) return { screen: "dashboard", params: {} };

    var parts = h.split("?");
    var screen = parts[0] || "dashboard";
    var params = {};

    if (parts[1]) {
      parts[1].split("&").forEach(function (kv) {
        if (!kv) return;
        var p = kv.split("=");
        var k = decodeURIComponent(p[0] || "");
        var v = decodeURIComponent(p[1] || "");
        if (k) params[k] = v;
      });
    }

    return { screen: screen, params: params };
  }

  function buildHash(screen, params) {
    var q = "";
    if (params) {
      var keys = Object.keys(params);
      if (keys.length) {
        q = "?" + keys.map(function (k) {
          return encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k]));
        }).join("&");
      }
    }
    return "#" + screen + q;
  }

  async function render() {
    var parsed = parseHash();
    current.screen = parsed.screen;
    current.params = parsed.params;

    var host = document.getElementById("app-content");
    if (!host) return;

    if (!ScreenRegistry.has(current.screen)) {
      current.screen = "dashboard";
      current.params = {};
      location.hash = buildHash("dashboard", {});
      return;
    }

    try {
      host.innerHTML = "";
      var spec = ScreenRegistry.get(current.screen);
      await spec.mount(host, { params: current.params });
      highlightNav(current.screen);
    } catch (e) {
      host.innerHTML = "";
      var msg = (e && e.message) ? e.message : String(e);
      host.appendChild(UI.el("div", { className: "card tile", html: "<div class='tile__label'>Router Error</div><div class='tile__value'>" + escapeHtml(msg) + "</div>" }, []));
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function highlightNav(screen) {
    var btns = document.querySelectorAll(".bottom-nav__btn");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var r = b.getAttribute("data-route");
      if (r === screen) b.classList.add("is-active");
      else b.classList.remove("is-active");
    }
  }

  function go(screen, params) {
    location.hash = buildHash(screen, params || {});
  }

  function getParam(key) {
    return current.params ? current.params[key] : undefined;
  }

  function setParam(key, value) {
    current.params = current.params || {};
    current.params[key] = value;
    location.hash = buildHash(current.screen, current.params);
  }

  function init() {
    window.addEventListener("hashchange", function () {
      render();
    });
    render();
  }

  window.Router = {
    init: init,
    go: go,
    getParam: getParam,
    setParam: setParam
  };
})();
