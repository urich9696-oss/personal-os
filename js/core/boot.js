// js/core/boot.js
// PERSONAL OS — Boot Sequence (dashboard first, offline-safe, iOS-safe)
// Requirements:
// - Dashboard is startscreen (not a tab)
// - Ensures DB seed + today state
// - Applies debug flag to runtime
// - Initializes Router after core is ready
// - No modules, defensive

(function () {
  "use strict";

  window.PersonalOS = window.PersonalOS || {};

  function logDiag(line) {
    try {
      var card = document.getElementById("diag-card");
      var pre = document.getElementById("diag-log");
      if (!card || !pre) return;
      card.style.display = "block";
      pre.textContent = (pre.textContent ? (pre.textContent + "\n") : "") + String(line || "");
    } catch (_) {}
  }

  function safeStr(v) { try { return String(v); } catch (_) { return "[unprintable]"; } }

  async function boot() {
    // Sanity checks (never hard-crash)
    if (!window.Router || typeof window.Router.init !== "function") {
      logDiag("BOOT: Router missing or invalid.");
      return;
    }
    if (!window.ScreenRegistry || typeof window.ScreenRegistry.register !== "function") {
      logDiag("BOOT: ScreenRegistry missing or invalid.");
      return;
    }
    if (!window.State) {
      logDiag("BOOT: State missing (window.State undefined).");
      return;
    }

    // Seed + set day state (iOS-safe)
    try {
      if (typeof window.State.ensureTodayState === "function") {
        await window.State.ensureTodayState();
      } else if (typeof window.State.ensureCoreSeed === "function") {
        await window.State.ensureCoreSeed();
      }
    } catch (e) {
      logDiag("BOOT: ensureTodayState failed: " + safeStr(e && e.message ? e.message : e));
    }

    // Apply debug flag to runtime
    try {
      var settings = null;
      if (typeof window.State.getSettings === "function") {
        settings = await window.State.getSettings();
      }
      var debug = !!(settings && settings.ui && settings.ui.debug);
      window.PersonalOS.debug = debug;
    } catch (_) {}

    // Init router (will deep-link if hash present; otherwise dashboard)
    try {
      window.Router.init();
    } catch (e2) {
      logDiag("BOOT: Router.init failed: " + safeStr(e2 && e2.message ? e2.message : e2));
    }

    // Optional: react to hash changes (basic)
    try {
      window.addEventListener("hashchange", function () {
        try { window.Router.init(); } catch (_) {}
      });
    } catch (_) {}
  }

  // Start after DOM is ready (safe for iOS)
  try {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(boot, 0);
    } else {
      document.addEventListener("DOMContentLoaded", function () { boot(); }, { passive: true });
    }
  } catch (_) {
    // Last fallback
    setTimeout(boot, 50);
  }
})();
