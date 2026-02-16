// js/core/router.js
// PERSONAL OS — Router (Hash-based, Dashboard-first, Params, iOS-safe)
// - No modules
// - Defensive: no throws
// - Supports: Router.go("screen"), Router.init(), getParam/setParam/clearParams
// - Deep link format: #screen?key=value&k2=v2
// - Emits: window.dispatchEvent(new CustomEvent("personalos:navigated",{detail:{screen}}))

(function () {
  "use strict";

  window.PersonalOS = window.PersonalOS || {};

  // If already installed, do not overwrite
  if (window.Router && typeof window.Router.go === "function") {
    window.PersonalOS.Router = window.Router;
    return;
  }

  var _params = {};
  var _currentScreen = "";
  var _isNavigating = false;

  var DEFAULT_SCREEN = "dashboard";

  function safeStr(v) { try { return String(v); } catch (_) { return ""; } }

  function getHostEl() {
    try { return document.getElementById("app-content"); } catch (_) { return null; }
  }

  function logDiag(line) {
    try {
      var card = document.getElementById("diag-card");
      var pre = document.getElementById("diag-log");
      if (!card || !pre) return;
      card.style.display = "block";
      pre.textContent = (pre.textContent ? (pre.textContent + "\n") : "") + safeStr(line);
    } catch (_) {}
  }

  function parseHash() {
    // Expected: "#dashboard" or "#vault?dayKey=2026-02-16"
    try {
      var h = safeStr(location.hash || "");
      if (!h) return { screen: "", query: "" };
      if (h[0] === "#") h = h.slice(1);
      var parts = h.split("?");
      return { screen: safeStr(parts[0] || ""), query: safeStr(parts[1] || "") };
    } catch (_) {
      return { screen: "", query: "" };
    }
  }

  function parseQuery(qs) {
    // returns object
    var out = {};
    try {
      var q = safeStr(qs || "");
      if (!q) return out;
      var pairs = q.split("&");
      for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        if (!p) continue;
        var idx = p.indexOf("=");
        var k = idx >= 0 ? p.slice(0, idx) : p;
        var v = idx >= 0 ? p.slice(idx + 1) : "";
        try { k = decodeURIComponent(k); } catch (_) {}
        try { v = decodeURIComponent(v); } catch (_) {}
        if (!k) continue;
        out[k] = v;
      }
    } catch (_) {}
    return out;
  }

  function buildHash(screen, params) {
    try {
      var s = safeStr(screen || "");
      if (!s) s = DEFAULT_SCREEN;

      var q = "";
      if (params && typeof params === "object") {
        var keys = Object.keys(params);
        var parts = [];
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
          var v = params[k];
          if (v === null || typeof v === "undefined") continue;
          var kk = "";
          var vv = "";
          try { kk = encodeURIComponent(safeStr(k)); } catch (_) { kk = safeStr(k); }
          try { vv = encodeURIComponent(safeStr(v)); } catch (_) { vv = safeStr(v); }
          parts.push(kk + "=" + vv);
        }
        if (parts.length) q = parts.join("&");
      }

      return "#" + s + (q ? ("?" + q) : "");
    } catch (_) {
      return "#" + DEFAULT_SCREEN;
    }
  }

  function emitNavigated(screenName) {
    try {
      var ev;
      try {
        ev = new CustomEvent("personalos:navigated", { detail: { screen: safeStr(screenName || "") } });
      } catch (_) {
        // IE fallback not needed, but keep safe
        ev = document.createEvent("CustomEvent");
        ev.initCustomEvent("personalos:navigated", false, false, { screen: safeStr(screenName || "") });
      }
      window.dispatchEvent(ev);
    } catch (_) {}
  }

  async function mountScreen(screenName) {
    var host = getHostEl();
    if (!host) {
      logDiag("ROUTER: #app-content missing.");
      return false;
    }

    if (!window.ScreenRegistry || typeof window.ScreenRegistry.get !== "function") {
      logDiag("ROUTER: ScreenRegistry missing.");
      host.innerHTML = "<div class='error'>System error: ScreenRegistry missing</div>";
      return false;
    }

    var def = null;
    try { def = window.ScreenRegistry.get(screenName); } catch (_) { def = null; }

    if (!def || typeof def.mount !== "function") {
      // Unknown screen -> fallback to dashboard
      if (screenName !== DEFAULT_SCREEN) {
        return await navigateTo(DEFAULT_SCREEN, true);
      }
      host.innerHTML = "<div class='error'>Unknown screen</div>";
      return false;
    }

    try {
      await def.mount(host, { screen: screenName, params: _params });
      return true;
    } catch (e) {
      logDiag("ROUTER: mount failed for '" + safeStr(screenName) + "': " + safeStr(e && e.message ? e.message : e));
      try {
        host.innerHTML = "<div class='error'>Screen failed: " + safeStr(screenName) + "</div>";
      } catch (_) {}
      return false;
    }
  }

  async function navigateTo(screenName, replace) {
    if (_isNavigating) return false;
    _isNavigating = true;

    try {
      var target = safeStr(screenName || "").trim();
      if (!target) target = DEFAULT_SCREEN;

      // Set hash (this is your "URL state")
      var hash = buildHash(target, _params);

      try {
        if (replace) location.replace(hash);
        else location.hash = hash;
      } catch (_) {
        // ignore
      }

      _currentScreen = target;

      // Mount immediately (don’t rely on hashchange for iOS quirks)
      var ok = await mountScreen(target);

      // Notify nav binding
      emitNavigated(target);

      return ok;
    } finally {
      _isNavigating = false;
    }
  }

  var Router = {
    init: async function () {
      try {
        var parsed = parseHash();
        var screen = safeStr(parsed.screen || "").trim();
        var query = safeStr(parsed.query || "");

        // If no screen in hash -> dashboard
        if (!screen) {
          _params = {};
          _currentScreen = DEFAULT_SCREEN;
          // Ensure hash reflects state (use replace to avoid history spam)
          try { location.replace(buildHash(DEFAULT_SCREEN, {})); } catch (_) {}
          await mountScreen(DEFAULT_SCREEN);
          emitNavigated(DEFAULT_SCREEN);
          return true;
        }

        // Parse params from hash query (deep-link)
        _params = parseQuery(query);

        _currentScreen = screen;
        var ok = await mountScreen(screen);
        emitNavigated(screen);
        return ok;
      } catch (e) {
        logDiag("ROUTER.init failed: " + safeStr(e && e.message ? e.message : e));
        try {
          _params = {};
          _currentScreen = DEFAULT_SCREEN;
          await mountScreen(DEFAULT_SCREEN);
          emitNavigated(DEFAULT_SCREEN);
        } catch (_) {}
        return false;
      }
    },

    go: function (screenName) {
      // Keep existing params unless caller cleared; most screens do one-shot clear
      return navigateTo(screenName, false);
    },

    replace: function (screenName) {
      return navigateTo(screenName, true);
    },

    getCurrent: function () {
      return _currentScreen || DEFAULT_SCREEN;
    },

    // Params API
    getParam: function (key) {
      try { return _params[safeStr(key)]; } catch (_) { return null; }
    },

    setParam: function (key, value) {
      try {
        var k = safeStr(key);
        if (!k) return false;
        _params[k] = value;
        return true;
      } catch (_) {
        return false;
      }
    },

    setParams: function (obj) {
      try {
        if (!obj || typeof obj !== "object") return false;
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
          _params[safeStr(k)] = obj[k];
        }
        return true;
      } catch (_) {
        return false;
      }
    },

    clearParams: function () {
      try { _params = {}; return true; } catch (_) { return false; }
    }
  };

  window.Router = Router;
  window.PersonalOS.Router = Router;
})();
