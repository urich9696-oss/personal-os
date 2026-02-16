// js/core/router.js
// PERSONAL OS — Router (no modules, crash-safe, dashboard default)
// Updates:
// - Dispatch Event "personalos:navigated" after successful navigation (for Tab-Sync)
// - Hash Deep-Linking (#/screen?key=value) safe
// - Never-white: renderErrorScreen fallback
// - Params: setParam/getParam/clearParams + setParams(object)
// - Dashboard is Startscreen (not a tab)

(function () {
  "use strict";

  window.PersonalOS = window.PersonalOS || {};

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

  var _params = {};
  var _current = null;

  function setParam(key, value) {
    try { _params[key] = value; } catch (_) {}
  }

  function setParams(obj) {
    try {
      if (!obj || typeof obj !== "object") return;
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) _params[k] = obj[k];
      }
    } catch (_) {}
  }

  function getParam(key) {
    try { return _params[key]; } catch (_) { return undefined; }
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
      "<div style='font-weight:900; margin-bottom:6px;'>" + escapeHtml(title || "Error") + "</div>" +
      "<div style='opacity:0.85; font-size:13px;'>" + escapeHtml(details || "Unknown") + "</div>";

    try {
      var dbg = window.PersonalOS && window.PersonalOS.debug;
      if (dbg) {
        var extra = document.createElement("div");
        extra.style.marginTop = "10px";
        extra.style.fontSize = "12px";
        extra.style.opacity = "0.75";
        extra.textContent = "Router current=" + String(_current || "") + " · screens=" + (ensureRegistry().list().join(", "));
        wrap.appendChild(extra);
      }
    } catch (_) {}

    mountIntoAppContent(wrap);
  }

  function dispatchNavigated(screenName) {
    try {
      var ev = new CustomEvent("personalos:navigated", {
        detail: { screen: String(screenName || ""), params: shallowCopy(_params) }
      });
      window.dispatchEvent(ev);
    } catch (_) {}
  }

  function shallowCopy(obj) {
    var out = {};
    try {
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
      }
    } catch (_) {}
    return out;
  }

  async function go(screenName) {
    var reg = ensureRegistry();

    try {
      _current = String(screenName || "");

      var def = reg.get(_current);

      if (!def || typeof def.mount !== "function") {
        renderErrorScreen("Screen not found", _current);
        dispatchNavigated(_current);
        syncHash(_current);
        return;
      }

      var host = document.getElementById("app-content");
      if (!host) {
        renderErrorScreen("Host missing", "#app-content not found");
        dispatchNavigated(_current);
        syncHash(_current);
        return;
      }

      await def.mount(host, { params: _params });

      dispatchNavigated(_current);
      syncHash(_current);

    } catch (e) {
      console.error("Router.go failed", e);
      renderErrorScreen("Navigation error", (e && e.message) ? e.message : String(e));
      dispatchNavigated(String(screenName || ""));
      syncHash(String(screenName || ""));
    }
  }

  function init() {
    try {
      ensureRegistry();

      var start = parseHash();
      if (start && start.screen) {
        if (start.params) {
          for (var k in start.params) {
            if (Object.prototype.hasOwnProperty.call(start.params, k)) _params[k] = start.params[k];
          }
        }
        go(start.screen);
        return;
      }

      go("dashboard");

    } catch (e) {
      console.error("Router.init failed", e);
      renderErrorScreen("Boot error", (e && e.message) ? e.message : String(e));
    }
  }

  function parseHash() {
    try {
      var h = String(location.hash || "");
      if (!h || h.length < 3) return null;
      if (h.indexOf("#/") !== 0) return null;

      var rest = h.slice(2);
      if (rest.indexOf("/") === 0) rest = rest.slice(1);

      var parts = rest.split("?");
      var screen = decodeURIComponent(parts[0] || "");
      if (!screen) return null;

      var params = {};
      if (parts[1]) {
        var qs = parts[1].split("&");
        for (var i = 0; i < qs.length; i++) {
          var kv = qs[i].split("=");
          var key = decodeURIComponent(kv[0] || "");
          var val = decodeURIComponent(kv[1] || "");
          if (key) params[key] = val;
        }
      }

      return { screen: screen, params: params };
    } catch (_) {
      return null;
    }
  }

  function syncHash(screenName) {
    try {
      var s = String(screenName || "");
      if (!s) return;

      var newHash = "#/" + encodeURIComponent(s);
      if (location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.Router = {
    init: init,
    go: go,
    setParam: setParam,
    setParams: setParams,
    getParam: getParam,
    clearParams: clearParams
  };

  window.PersonalOS.Router = window.Router;

})();
