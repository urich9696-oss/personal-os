// js/core/router.js
// PERSONAL OS — Router (crash-safe, lazy mount, param support)

const Router = (function () {

  let currentScreen = null;
  let params = {};

  function init() {
    try {
      go("dashboard");
    } catch (e) {
      console.error("Router init failed", e);
    }
  }

  function setParam(key, value) {
    params[key] = value;
  }

  function getParam(key) {
    return params[key];
  }

  function clearParams() {
    params = {};
  }

  function go(screenName) {

    try {

      if (!screenName) return;

      const container = document.getElementById("app-content");
      if (!container) return;

      if (currentScreen === screenName) return;

      currentScreen = screenName;

      // Clear view
      container.innerHTML = "";

      const screen = ScreenRegistry.get(screenName);

      if (!screen || typeof screen.mount !== "function") {
        container.innerHTML = "<div class='error'>Screen not found</div>";
        return;
      }

      try {
        screen.mount(container);
      } catch (e) {
        console.error("Screen mount error", e);
        container.innerHTML = "<div class='error'>Screen failed to load</div>";
      }

    } catch (e) {
      console.error("Router go error", e);
    }
  }

  function getCurrent() {
    return currentScreen;
  }

  return {
    init,
    go,
    getCurrent,
    setParam,
    getParam,
    clearParams
  };

})();
