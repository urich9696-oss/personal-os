(function () {
  const ui = () => window.POS && window.POS.ui;
  const reg = () => window.POS && window.POS.registry;

  const state = {
    current: null,         // dashboard | mindset | path | maintenance | finance
    lastTab: "mindset",     // remember last opened tab
    params: {}             // one-shot params for next mount
  };

  function setActiveNav(screenId) {
    const nav = document.getElementById("bottomNav");
    if (!nav) return;
    const btns = nav.querySelectorAll(".nav-btn");
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      const target = b.getAttribute("data-screen");
      if (target === screenId) b.classList.add("active");
      else b.classList.remove("active");
    }
  }

  function clearRoot() {
    const root = document.getElementById("screenRoot");
    if (!root) return;
    root.innerHTML = "";
  }

  async function guardedMount(screenId, ctx) {
    const entry = reg().get(screenId);
    if (!entry) return;

    if (!entry.mountFn) {
      try {
        entry.mountFn = entry.factory();
      } catch (e) {
        ui().toast("Screen init failed: " + screenId);
        console.error("Screen factory error:", screenId, e);
        return;
      }
    }

    if (typeof entry.mountFn !== "function") {
      ui().toast("Screen mount missing: " + screenId);
      return;
    }

    try {
      await entry.mountFn(ctx);
      entry.mounted = true;
    } catch (e) {
      ui().toast("Screen crashed: " + screenId);
      console.error("Screen mount error:", screenId, e);
      // Never throw further
    }
  }

  async function go(screenId, params) {
    params = params || {};
    state.params = params;

    // Dashboard is not a tab, but tabs stay visible
    state.current = screenId;
    if (screenId !== "dashboard") state.lastTab = screenId;

    // UI: set nav active only for tabs
    if (screenId === "mindset" || screenId === "path" || screenId === "maintenance" || screenId === "finance") {
      setActiveNav(screenId);
    } else {
      setActiveNav(null);
    }

    clearRoot();

    const root = document.getElementById("screenRoot");
    if (!root) return;

    const ctx = {
      root: root,
      router: window.POS.router,
      params: state.params
    };

    await guardedMount(screenId, ctx);
  }

  function bindBottomNav() {
    const nav = document.getElementById("bottomNav");
    if (!nav) return;

    const handler = function (e) {
      try {
        e.preventDefault();
      } catch (_) {}

      const btn = e.currentTarget;
      const target = btn && btn.getAttribute("data-screen");
      if (!target) return;

      // Always navigate even if current screen is broken
      window.POS.router.go(target, {});
    };

    const btns = nav.querySelectorAll(".nav-btn");
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      b.addEventListener("click", handler, { passive: false });
      b.addEventListener("touchend", handler, { passive: false });
    }
  }

  function getState() {
    return { current: state.current, lastTab: state.lastTab };
  }

  window.POS = window.POS || {};
  window.POS.router = { go, bindBottomNav, getState };
})();
