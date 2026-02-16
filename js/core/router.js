// js/core/router.js
// PERSONAL OS — Router (crash-safe, works with BOTH layouts)
// Layout A (new): single mount root #app-content (preferred)
// Layout B (legacy): pre-rendered screens with ids like #screen-dashboard, #screen-mindset, etc.
// Rules: never let a screen error break navigation.

const Router = (function () {
  "use strict";

  let currentScreen = null;
  let params = Object.create(null);

  function init() {
    // Default route is always dashboard (start screen is NOT a tab)
    try {
      go("dashboard");
    } catch (e) {
      console.error("Router.init failed", e);
    }
  }

  function setParam(key, value) {
    try {
      params[String(key)] = value;
    } catch (_) {}
  }

  function getParam(key) {
    try {
      return params[String(key)];
    } catch (_) {
      return undefined;
    }
  }

  function clearParams() {
    params = Object.create(null);
  }

  function getCurrent() {
    return currentScreen;
  }

  function _mountNewLayout(screenName) {
    const root = document.getElementById("app-content");
    if (!root) return false;

    // Clear root first (prevent mixed UI)
    root.innerHTML = "";

    // ScreenRegistry is expected in new layout
    if (!window.ScreenRegistry || typeof window.ScreenRegistry.get !== "function") {
      root.innerHTML = "<div class='error'>Screen registry missing</div>";
      return true; // handled (we rendered an error)
    }

    const screen = window.ScreenRegistry.get(screenName);
    if (!screen || typeof screen.mount !== "function") {
      root.innerHTML = "<div class='error'>Screen not found</div>";
      return true;
    }

    // Guard: screen mount must never kill router
    try {
      const res = screen.mount(root, { params: params, router: api });
      // If mount returns a promise, guard async errors too
      if (res && typeof res.then === "function") {
        res.catch((e) => {
          console.error("Screen async mount error", e);
          try {
            root.innerHTML = "<div class='error'>Screen failed to load</div>";
          } catch (_) {}
        });
      }
    } catch (e) {
      console.error("Screen mount error", e);
      root.innerHTML = "<div class='error'>Screen failed to load</div>";
    }

    return true;
  }

  function _activateLegacyLayout(screenName) {
    // Legacy: screens are in DOM, we just toggle .active
    const screens = document.querySelectorAll(".screen");
    if (!screens || screens.length === 0) return false;

    screens.forEach((s) => {
      try { s.classList.remove("active"); } catch (_) {}
    });

    const el = document.getElementById("screen-" + screenName);
    if (!el) {
      console.warn("Legacy screen not found:", screenName);
      return true; // handled, nothing else to do
    }

    try { el.classList.add("active"); } catch (_) {}

    // If ScreenRegistry exists, try mount lazily (optional)
    try {
      if (window.ScreenRegistry && typeof window.ScreenRegistry.mountIfNeeded === "function") {
        window.ScreenRegistry.mountIfNeeded(screenName, { params: params, router: api });
      }
    } catch (e) {
      console.error("Legacy mountIfNeeded error", e);
    }

    return true;
  }

  function go(screenName) {
    try {
      if (!screenName) return;
      screenName = String(screenName);

      if (currentScreen === screenName) return;
      currentScreen = screenName;

      // Clear one-shot params when navigating unless caller set them (caller can manage)
      // We DO NOT auto-clear here because "viewVault" etc. must survive the jump.
      // Caller can clear via clearParams() after consumption.

      // Prefer new layout if present
      const handledNew = _mountNewLayout(screenName);
      if (handledNew) return;

      // Fallback legacy
      const handledLegacy = _activateLegacyLayout(screenName);
      if (handledLegacy) return;

      console.warn("Router: no compatible layout found (missing #app-content and .screen nodes)");
    } catch (e) {
      console.error("Router.go failed", e);
    }
  }

  const api = {
    init,
    go,
    getCurrent,
    setParam,
    getParam,
    clearParams
  };

  return api;
})();
