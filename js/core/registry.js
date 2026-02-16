// js/core/registry.js
// PERSONAL OS — Screen Registry (no modules)

(function () {
  "use strict";

  // Always create a stable global registry object.
  // Screens register themselves here; nothing executes on load.
  var _screens = {};
  var _mounted = {};

  function register(name, def) {
    if (!name) throw new Error("ScreenRegistry.register: name missing");
    if (!def || typeof def.mount !== "function") {
      throw new Error("ScreenRegistry.register: def.mount missing for " + name);
    }
    _screens[name] = def;
  }

  function get(name) {
    return _screens[name] || null;
  }

  function isMounted(name) {
    return !!_mounted[name];
  }

  function markMounted(name) {
    _mounted[name] = true;
  }

  function resetMounted(name) {
    if (name) delete _mounted[name];
    else _mounted = {};
  }

  function list() {
    return Object.keys(_screens);
  }

  // Expose globally
  window.ScreenRegistry = {
    register: register,
    get: get,
    isMounted: isMounted,
    markMounted: markMounted,
    resetMounted: resetMounted,
    list: list
  };
})();
