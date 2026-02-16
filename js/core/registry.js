// js/core/registry.js
// PERSONAL OS — Screen Registry (global, crash-safe)
// - No modules
// - Provides window.ScreenRegistry + window.PersonalOS.ScreenRegistry
// - Idempotent (safe if loaded multiple times)

(function () {
  "use strict";

  window.PersonalOS = window.PersonalOS || {};

  // If already present, keep it (avoid overwriting)
  if (window.ScreenRegistry && typeof window.ScreenRegistry.register === "function") {
    window.PersonalOS.ScreenRegistry = window.ScreenRegistry;
    return;
  }

  var _screens = {};
  var _mounted = {};

  var reg = {
    register: function (name, def) {
      try {
        var key = String(name || "").trim();
        if (!key) return false;
        _screens[key] = def || {};
        return true;
      } catch (_) {
        return false;
      }
    },

    get: function (name) {
      try {
        var key = String(name || "").trim();
        return _screens[key] || null;
      } catch (_) {
        return null;
      }
    },

    isMounted: function (name) {
      try { return !!_mounted[String(name || "")]; } catch (_) { return false; }
    },

    markMounted: function (name) {
      try { _mounted[String(name || "")] = true; } catch (_) {}
    },

    resetMounted: function (name) {
      try {
        if (name) delete _mounted[String(name || "")];
        else _mounted = {};
      } catch (_) {}
    },

    list: function () {
      try { return Object.keys(_screens); } catch (_) { return []; }
    }
  };

  window.ScreenRegistry = reg;
  window.PersonalOS.ScreenRegistry = reg;
})();
