// js/core/registry.js
// PERSONAL OS — Screen Registry (lazy, crash-safe)

const ScreenRegistry = (function () {
  "use strict";

  const screens = Object.create(null);
  const mounted = Object.create(null);

  function register(name, definition) {
    if (!name || typeof name !== "string") return;
    if (!definition || typeof definition.mount !== "function") return;

    screens[name] = definition;
  }

  function get(name) {
    return screens[name] || null;
  }

  function mountIfNeeded(name, context) {
    try {
      if (!screens[name]) return;

      if (mounted[name]) return;

      const screen = screens[name];

      try {
        const res = screen.mount(
          document.getElementById("screen-" + name) || null,
          context || {}
        );

        if (res && typeof res.then === "function") {
          res.catch(e => {
            console.error("Async screen mount error:", name, e);
          });
        }

        mounted[name] = true;

      } catch (e) {
        console.error("Screen mount error:", name, e);
      }

    } catch (e) {
      console.error("mountIfNeeded failed:", e);
    }
  }

  return {
    register,
    get,
    mountIfNeeded
  };

})();
