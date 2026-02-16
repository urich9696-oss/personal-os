// js/core/boot.js
// PERSONAL OS — Bootloader (robust, crash-safe, iOS-safe)
// Ziele:
// - Niemals White Screen: On-screen Boot-Fallback bei Fehlern
// - DB öffnen + ensureTodayState
// - Router.init() starten (Dashboard default)
// - Service Worker registrieren + Update-Hinweis (iOS-safe)
// - Kein DevTools-Zwang: Fehler werden im UI angezeigt (optional mehr bei Debug)

// NOTE: Requires in index.html load order:
// state.js -> registry.js -> router.js -> screens -> boot.js

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function renderBootError(title, details) {
    try {
      var host = $("app-content");
      if (!host) return;

      var wrap = document.createElement("div");
      wrap.className = "error";
      wrap.style.marginTop = "12px";
      wrap.innerHTML =
        "<div style='font-weight:900; margin-bottom:6px;'>" + escapeHtml(title || "Boot Error") + "</div>" +
        "<div style='font-size:13px; opacity:0.85;'>" + escapeHtml(details || "Unknown") + "</div>" +
        "<div style='font-size:12px; opacity:0.75; margin-top:10px;'>" +
          "Tip: System → Clear Cache Storage / Unregister Service Worker, dann Reload." +
        "</div>";

      // Replace only if empty-ish; otherwise append
      if (!host.innerHTML || host.innerHTML.trim().length < 20) host.innerHTML = "";
      host.appendChild(wrap);
    } catch (_) {}
  }

  function renderToast(msg) {
    try {
      var host = document.body;
      if (!host) return;

      var el = document.createElement("div");
      el.style.position = "fixed";
      el.style.left = "16px";
      el.style.right = "16px";
      el.style.bottom = "calc(80px + env(safe-area-inset-bottom, 0px))";
      el.style.zIndex = "999";
      el.style.padding = "12px 14px";
      el.style.borderRadius = "14px";
      el.style.background = "rgba(255,255,255,0.82)";
      el.style.border = "1px solid rgba(0,0,0,0.12)";
      el.style.boxShadow = "0 10px 24px rgba(0,0,0,0.12)";
      el.style.backdropFilter = "blur(14px)";
      el.style.webkitBackdropFilter = "blur(14px)";
      el.style.color = "#121212";
      el.style.fontSize = "13px";
      el.style.opacity = "0.98";
      el.textContent = String(msg || "");

      host.appendChild(el);
      setTimeout(function () {
        try { el.remove(); } catch (_) {}
      }, 4200);
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function boot() {
    try {
      // 1) Sanity
      if (typeof window.State === "undefined" || typeof window.State.openDB !== "function") {
        renderBootError("State missing", "state.js not loaded or corrupted");
        return;
      }
      if (typeof window.Router === "undefined" || typeof window.Router.init !== "function") {
        renderBootError("Router missing", "router.js not loaded or corrupted");
        return;
      }

      // 2) Open DB + day state
      await window.State.openDB();
      await window.State.ensureTodayState();

      // 3) Optional debug runtime flag (persisted)
      try {
        var s = await window.State.getSettings();
        window.PersonalOS = window.PersonalOS || {};
        window.PersonalOS.debug = !!(s && s.ui && s.ui.debug);
      } catch (_) {}

      // 4) Router init (Dashboard default)
      window.Router.init();

    } catch (e) {
      console.error("Boot failure", e);
      renderBootError("Boot failure", (e && e.message) ? e.message : String(e));
      return;
    }

    // 5) Service Worker registration (separate safe block)
    try {
      if (!("serviceWorker" in navigator)) return;

      // GH Pages subpath safe
      var swUrl = "./service-worker.js";

      var reg = await navigator.serviceWorker.register(swUrl);

      // Update hint: if waiting worker exists -> show toast
      if (reg && reg.waiting) {
        renderToast("Update verfügbar. App neu starten für die neue Version.");
      }

      // Listen for updates
      reg.addEventListener("updatefound", function () {
        try {
          var newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", function () {
            try {
              if (newWorker.state === "installed") {
                // If there's an existing controller, it's an update
                if (navigator.serviceWorker.controller) {
                  renderToast("Update installiert. App neu starten, um zu aktualisieren.");
                }
              }
            } catch (_) {}
          });
        } catch (_) {}
      });

      // Optional: controller change -> reload hint (do not auto-reload to avoid iOS weirdness)
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        try { renderToast("App wurde aktualisiert. Bitte einmal neu öffnen."); } catch (_) {}
      });

    } catch (e2) {
      console.error("SW init error", e2);
      // Do not block app
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    boot();
  });
})();
