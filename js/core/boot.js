// js/core/boot.js
// PERSONAL OS — Bootloader (robust, crash-safe, iOS-safe)
// Responsibilities:
// - Open IndexedDB + ensure day state
// - Init Router (which installs global error handlers + home button + fallback UI)
// - Register Service Worker (best-effort)
// - Never allow a silent white screen (overlay + console + router fallback)

(function () {
  "use strict";

  function log() {
    try { console.log.apply(console, arguments); } catch (_) {}
  }

  function err() {
    try { console.error.apply(console, arguments); } catch (_) {}
  }

  function showBootOverlay(message) {
    try {
      // Reuse Router overlay if present, else create minimal
      if (window.Router && typeof window.Router.go === "function") {
        // Router may not be initialized yet; we still can create a minimal overlay here
      }

      var existing = document.getElementById("os-boot-overlay");
      if (existing) {
        var msg = document.getElementById("os-boot-overlay-msg");
        if (msg) msg.textContent = String(message || "");
        existing.style.display = "block";
        return;
      }

      var overlay = document.createElement("div");
      overlay.id = "os-boot-overlay";
      overlay.style.position = "fixed";
      overlay.style.left = "12px";
      overlay.style.right = "12px";
      overlay.style.top = "calc(env(safe-area-inset-top, 0px) + 10px)";
      overlay.style.zIndex = "9999";
      overlay.style.padding = "12px 12px";
      overlay.style.borderRadius = "14px";
      overlay.style.background = "rgba(255,255,255,0.78)";
      overlay.style.border = "1px solid rgba(0,0,0,0.10)";
      overlay.style.boxShadow = "0 10px 30px rgba(0,0,0,0.12)";
      overlay.style.backdropFilter = "blur(14px)";
      overlay.style.webkitBackdropFilter = "blur(14px)";
      overlay.style.color = "#121212";

      overlay.innerHTML =
        "<div style='display:flex; align-items:flex-start; gap:10px;'>" +
          "<div style='flex:1; min-width:0;'>" +
            "<div style='font-weight:800; margin-bottom:4px;'>Boot</div>" +
            "<div id='os-boot-overlay-msg' style='font-size:13px; opacity:0.85; line-height:1.35; word-wrap:break-word;'></div>" +
          "</div>" +
          "<button id='os-boot-overlay-close' type='button' style='border:0; background:rgba(18,18,18,0.08); padding:8px 10px; border-radius:12px; font-size:13px;'>OK</button>" +
        "</div>";

      document.body.appendChild(overlay);

      var msgEl = document.getElementById("os-boot-overlay-msg");
      if (msgEl) msgEl.textContent = String(message || "");

      var closeBtn = document.getElementById("os-boot-overlay-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", function () {
          try { overlay.style.display = "none"; } catch (_) {}
        });
      }
    } catch (_) {}
  }

  function ensureHostExists() {
    try {
      var host = document.getElementById("app-content");
      if (host) return true;

      // If missing, create a last-resort host so Router can render something
      var main = document.createElement("main");
      main.id = "app-content";
      main.className = "app-content";
      main.setAttribute("aria-label", "App content");

      // Try to insert into .app-shell if it exists
      var shell = document.querySelector(".app-shell");
      if (shell) shell.insertBefore(main, shell.firstChild);
      else document.body.appendChild(main);

      return true;
    } catch (_) {
      return false;
    }
  }

  async function initState() {
    if (typeof State === "undefined" || !State || typeof State.openDB !== "function") {
      showBootOverlay("State Modul fehlt oder ist defekt.");
      err("State module missing");
      return false;
    }

    try {
      await State.openDB();
      await State.ensureTodayState();
      return true;
    } catch (e) {
      showBootOverlay("IndexedDB Fehler: " + ((e && e.message) ? e.message : String(e)));
      err("State init failed", e);
      return false;
    }
  }

  function initRouter() {
    if (typeof Router === "undefined" || !Router || typeof Router.init !== "function") {
      showBootOverlay("Router Modul fehlt oder ist defekt.");
      err("Router module missing");
      return false;
    }

    try {
      Router.init();
      return true;
    } catch (e) {
      showBootOverlay("Router init Fehler: " + ((e && e.message) ? e.message : String(e)));
      err("Router init failed", e);
      return false;
    }
  }

  function registerServiceWorker() {
    try {
      if (!("serviceWorker" in navigator)) return;

      // GH Pages subpath safe (relative)
      var swUrl = "./service-worker.js";

      navigator.serviceWorker.register(swUrl).then(function (reg) {
        log("SW registered", reg && reg.scope ? reg.scope : "");

        // Optional: listen for updates and show a visible hint
        try {
          reg.addEventListener("updatefound", function () {
            try {
              var installing = reg.installing;
              if (!installing) return;

              installing.addEventListener("statechange", function () {
                // If a new SW is installed while a previous controller exists => update available
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // Use Router overlay if available, else boot overlay
                  showBootOverlay("Update verfügbar. App neu laden, um die neue Version zu aktivieren.");
                }
              });
            } catch (_) {}
          });
        } catch (_) {}
      }).catch(function (e) {
        err("SW registration failed", e);
      });
    } catch (e) {
      err("SW init error", e);
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    // 0) Ensure UI host exists (last resort)
    ensureHostExists();

    // 1) Init State first (DB + day state)
    var okState = await initState();

    // 2) Init Router (must render dashboard even if State had issues)
    initRouter();

    // If state failed, keep app usable (router + tabs) but surface warning
    if (!okState) {
      showBootOverlay("DB konnte nicht initialisiert werden. Navigation bleibt nutzbar, Daten ggf. nicht verfügbar.");
    }

    // 3) SW registration (best-effort, do not block UI)
    registerServiceWorker();
  });

})();
