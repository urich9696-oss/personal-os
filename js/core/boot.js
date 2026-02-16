// js/core/boot.js
// PERSONAL OS — Boot Sequence
// - Ensure DB seed + today state
// - Determine start screen from settings (ui.startScreen) else dashboard
// - Start screen is NOT a bottom tab; bottom tabs are screens but dashboard is default entry

(function () {
  "use strict";

  function safeStr(v) { try { return String(v); } catch (_) { return ""; } }

  function showBootError(msg) {
    try {
      var host = document.getElementById("app-content");
      if (!host) return;
      host.innerHTML =
        "<div class='dash-card' style='margin-top:12px; border:1px solid rgba(160,60,60,0.25);'>" +
          "<div style='font-weight:900; color:#7a1f1f;'>Boot failed</div>" +
          "<div style='font-size:13px; opacity:0.85; margin-top:8px; white-space:pre-wrap;'>" +
            escapeHtml(msg) +
          "</div>" +
          "<div style='font-size:12px; opacity:0.75; margin-top:10px;'>" +
            "Tipp: Wenn du auf GitHub Pages eine alte Version siehst: URL mit <b>?nosw=1</b> öffnen." +
          "</div>" +
        "</div>";
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function boot() {
    try {
      // Hard prerequisites
      if (!window.State) { showBootError("State fehlt (state.js nicht geladen)."); return; }
      if (!window.Router) { showBootError("Router fehlt (router.js nicht geladen)."); return; }
      if (!window.ScreenRegistry) { showBootError("ScreenRegistry fehlt (registry.js nicht geladen)."); return; }

      // Ensure DB + today
      try {
        if (typeof window.State.ensureTodayState === "function") {
          await window.State.ensureTodayState();
        } else if (typeof window.State.ensureCoreSeed === "function") {
          await window.State.ensureCoreSeed();
        }
      } catch (_) {}

      // Determine start screen
      var startScreen = "dashboard";
      try {
        if (typeof window.State.getSettings === "function") {
          var s = await window.State.getSettings();
          if (s && s.ui && s.ui.startScreen) startScreen = safeStr(s.ui.startScreen) || "dashboard";
        }
      } catch (_) {}

      // Always fall back to dashboard
      if (!startScreen) startScreen = "dashboard";

      // Navigate
      await window.Router.go(startScreen);
    } catch (e) {
      showBootError(String(e && (e.message || e) || "unknown boot error"));
    }
  }

  // DOM ready
  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { passive: true });
    } else {
      boot();
    }
  } catch (_) {
    // last resort
    setTimeout(boot, 0);
  }
})();
