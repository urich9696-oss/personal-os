(function () {
  const registry = {};

  function register(id, factory) {
    if (!id || typeof factory !== "function") return;
    registry[id] = { factory: factory, mounted: false, mountFn: null };
  }

  function get(id) {
    return registry[id] || null;
  }

  function list() {
    return Object.keys(registry);
  }

  window.POS = window.POS || {};
  window.POS.registry = { register, get, list };
})();
