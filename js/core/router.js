// js/core/router.js
// PERSONAL OS — Router (no modules, crash-safe, dashboard default)

(function () {
  "use strict";

  // Ensure a stable namespace
  window.PersonalOS = window.PersonalOS || {};

  function ensureRegistry() {
    // Accept both: window.ScreenRegistry and window.PersonalOS.ScreenRegistry
    var reg = window.ScreenRegistry || window.PersonalOS.ScreenRegistry || null;

    // If still missing, create a minimal registry to prevent crashes
    if (!reg) {
      var _screens = {};
      var _mounted = {};

      reg = {
        register: function (name, def) { _screens[name] = def; },
        get: function (name) { return _screens[name] || null; },
        isMounted: function (name) { return !!_mounted[name]; },
        markMounted: function (name) { _mounted[name] = true; },
        resetMounted: function (name) { if (name) delete _mounted[name]; else _mounted = {}; },
        list: function () { return Object.keys(_screens); }
      };

      window.ScreenRegistry = reg;
      window.PersonalOS.ScreenRegistry = reg;
    }

    // Keep both references in sync
    window.ScreenRegistry = reg;
    window.PersonalOS.ScreenRegistry = reg;

    return reg;
  }

  var _params = {};
  var _current = null;

  function setParam(key, value) {
    try { _params[key] = value; } catch (e) {}
  }

  function getParam(key) {
    try { return _params[key]; } catch (e) { return undefined; }
  }

  function clearParams() {
    _params = {};
  }

  function mountIntoAppContent(htmlOrNode) {
    var host = document.getElementById("app-content");
    if (!host) return;

    host.innerHTML = "";

    if (typeof htmlOrNode === "string") {
      host.innerHTML = htmlOrNode;
      return;
    }

    if (htmlOrNode && htmlOrNode.nodeType) {
      host.appendChild(htmlOrNode);
    }
  }

  function renderErrorScreen(title, details) {
    var wrap = document.createElement("div");
    wrap.className = "error";
    wrap.innerHTML =
      "<div style='font-weight:700; margin-bottom:6px;'>" + (title || "Error") + "</div>" +
      "<div style='opacity:0.85; font-size:14px;'>" + (details || "Unknown") + "</div>";
    mountIntoAppContent(wrap);
  }

  async function go(screenName) {
    var reg = ensureRegistry();

    try {
      _current = String(screenName || "");

      // Dashboard is a first-class screen (not a tab)
      var def = reg.get(_current);

      if (!def || typeof def.mount !== "function") {
        renderErrorScreen("Screen not found", _current);
        return;
      }

      var host = document.getElementById("app-content");
      if (!host) {
        renderErrorScreen("Host missing", "#app-content not found");
        return;
      }

      // Lazy mount: only mount logic can decide if it wants to re-render
      // We still allow mount every time (simple + stable)
      await def.mount(host, { params: _params });

    } catch (e) {
      console.error("Router.go failed", e);
      renderErrorScreen("Navigation error", (e && e.message) ? e.message : String(e));
    }
  }

  function init() {
    try {
      ensureRegistry();

      // Always start on dashboard
      go("dashboard");

    } catch (e) {
      console.error("Router.init failed", e);
      renderErrorScreen("Boot error", (e && e.message) ? e.message : String(e));
    }
  }

  window.Router = {
    init: init,
    go: go,
    setParam: setParam,
    getParam: getParam,
    clearParams: clearParams
  };

  // Also store under namespace for safety
  window.PersonalOS.Router = window.Router;

})();
