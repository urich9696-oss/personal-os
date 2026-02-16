// js/core/registry.js
// PERSONAL OS — Screen Registry (no modules, global, defensive)

(function () {
  "use strict";

  var ScreenRegistry = (function () {
    var _screens = {};

    function register(name, screenObj) {
      try {
        var key = String(name || "").trim();
        if (!key) return false;
        if (!screenObj || typeof screenObj.mount !== "function") return false;
        _screens[key] = screenObj;
        return true;
      } catch (_) {
        return false;
      }
    }

    function get(name) {
      try {
        var key = String(name || "").trim();
        return _screens[key] || null;
      } catch (_) {
        return null;
      }
    }

    function list() {
      try {
        return Object.keys(_screens);
      } catch (_) {
        return [];
      }
    }

    return { register: register, get: get, list: list };
  })();

  try { window.ScreenRegistry = ScreenRegistry; } catch (_) {}
  try { if (typeof globalThis !== "undefined") globalThis.ScreenRegistry = ScreenRegistry; } catch (_) {}
})();
