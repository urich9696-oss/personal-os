// js/core/router.js
// PERSONAL OS — Router (no modules, crash-safe, dashboard default)
// Ziele:
// - Navigation darf nie sterben (auch bei Screen-Crash)
// - Dashboard ist Startscreen (kein Tab)
// - Deep-Link Parameter: setParam/getParam/clearParams + setParams(obj)
// - On-Screen Error Boundary (Router rendert immer etwas)
// - (Optional) History via location.hash (#/screen) — iOS/GH-Pages safe

(function () {
  "use strict";

  window.PersonalOS = window.PersonalOS || {};

  // -----------------------------
  // Registry guarantee
  // -----------------------------

  function ensureRegistry() {
    var reg = window.ScreenRegistry || window.PersonalOS.ScreenRegistry || null;

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

    window.ScreenRegistry = reg;
    window.PersonalOS.ScreenRegistry = reg;

    return reg;
  }

  // -----------------------------
  // Params
  // -----------------------------

  var _params = {};
  var _current = "dashboard";
  var _lastNonDashboard = "mindset";

  function setParam(key, value) {
    try { _params[key] = value; } catch (_) {}
  }

  function setParams(obj) {
    try {
      if (!obj) return;
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) _params[k] = obj[k];
      }
    } catch (_) {}
  }

  function getParam(key) {
    try { return _params[key]; } catch (_) { return undefined; }
  }

  function clearParams() { _params = {}; }

  // -----------------------------
  // Rendering helpers
  // -----------------------------

  function getHost() { return document.getElementById("app-content"); }

  function mountIntoAppContent(htmlOrNode) {
    var host = getHost();
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

  function renderErrorScreen(title, details, meta) {
    var wrap = document.createElement("div");
    wrap.className = "error";

    var t = document.createElement("div");
    t.style.fontWeight = "800";
    t.style.marginBottom = "6px";
    t.textContent = title || "Error";

    var d = document.createElement("div");
    d.style.opacity = "0.85";
    d.style.fontSize = "14px";
    d.textContent = details || "Unknown";

    wrap.appendChild(t);
    wrap.appendChild(d);

    if (meta) {
      var m = document.createElement("div");
      m.style.opacity = "0.65";
      m.style.fontSize = "12px";
      m.style.marginTop = "10px";
      m.textContent = String(meta);
      wrap.appendChild(m);
    }

    // Minimal recovery actions (navigation must survive)
    var actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "10px";
    actions.style.marginTop = "12px";

    var b1 = document.createElement("button");
    b1.type = "button";
    b1.textContent = "Go Dashboard";
    b1.onclick = function () { safeGo("dashboard"); };

    var b2 = document.createElement("button");
    b2.type = "button";
    b2.textContent = "Go Last Screen";
    b2.onclick = function () { safeGo(_lastNonDashboard || "mindset"); };

    actions.appendChild(b1);
    actions.appendChild(b2);

    // Note: use same button styling as screens
    wrap.appendChild(actions);

    mountIntoAppContent(wrap);
  }

  // -----------------------------
  // Hash routing (optional but useful)
  // -----------------------------

  function _screenToHash(name) {
    return "#/" + encodeURIComponent(String(name || "dashboard"));
  }

  function _hashToScreen(hash) {
    try {
      var h = String(hash || location.hash || "");
      if (!h || h.indexOf("#/") !== 0) return null;
      var name = decodeURIComponent(h.slice(2));
      return name || null;
    } catch (_) {
      return null;
    }
  }

  function _setHashSilently(name) {
    try {
      var target = _screenToHash(name);
      if (location.hash !== target) location.hash = target;
    } catch (_) {}
  }

  // -----------------------------
  // Core navigation
  // -----------------------------

  async function safeGo(screenName) {
    try { await go(screenName, { fromHash: false }); } catch (_) {}
  }

  async function go(screenName, opts) {
    var reg = ensureRegistry();

    try {
      var next = String(screenName || "");
      if (!next) next = "dashboard";

      _current = next;
      if (next !== "dashboard") _lastNonDashboard = next;

      // Write hash for back behavior (iOS can use it)
      if (!opts || !opts.fromHash) _setHashSilently(next);

      var def = reg.get(next);
      if (!def || typeof def.mount !== "function") {
        renderErrorScreen("Screen not found", next, "Registry: " + reg.list().join(", "));
        return;
      }

      var host = getHost();
      if (!host) {
        renderErrorScreen("Host missing", "#app-content not found");
        return;
      }

      // Always attempt mount; a crashing screen must not kill navigation.
      await def.mount(host, { params: _params });

      // Emit event for UI syncing (tabs highlight, etc.)
      try {
        window.dispatchEvent(new CustomEvent("personalos:navigated", { detail: { screen: next } }));
      } catch (_) {}

    } catch (e) {
      console.error("Router.go failed", e);
      renderErrorScreen(
        "Navigation error",
        (e && e.message) ? e.message : String(e),
        "Target: " + String(screenName || "")
      );
    }
  }

  function init() {
    try {
      ensureRegistry();

      // If hash exists, try that first; else dashboard
      var hashed = _hashToScreen(location.hash);
      if (hashed) {
        go(hashed, { fromHash: true });
      } else {
        go("dashboard", { fromHash: true });
      }

      // Handle back/forward via hash changes
      window.addEventListener("hashchange", function () {
        try {
          var s = _hashToScreen(location.hash);
          if (!s) return;
          go(s, { fromHash: true });
        } catch (_) {}
      });

    } catch (e) {
      console.error("Router.init failed", e);
      renderErrorScreen("Boot error", (e && e.message) ? e.message : String(e));
    }
  }

  // -----------------------------
  // Public API
  // -----------------------------

  window.Router = {
    init: init,
    go: go,
    safeGo: safeGo,

    setParam: setParam,
    setParams: setParams,
    getParam: getParam,
    clearParams: clearParams,

    // Debug/introspection
    getCurrent: function () { return _current; },
    getLastNonDashboard: function () { return _lastNonDashboard; }
  };

  window.PersonalOS.Router = window.Router;

})();
