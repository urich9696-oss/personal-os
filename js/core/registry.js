(function () {
  "use strict";

  var screens = {};

  function register(name, spec) {
    if (!name) throw new Error("ScreenRegistry.register: name missing");
    if (!spec || typeof spec.mount !== "function") {
      throw new Error("ScreenRegistry.register: mount() missing for " + name);
    }
    screens[name] = spec;
  }

  function get(name) {
    return screens[name] || null;
  }

  function has(name) {
    return !!screens[name];
  }

  window.ScreenRegistry = {
    register: register,
    get: get,
    has: has
  };
})();
