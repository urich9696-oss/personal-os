// js/core/router.js
// PERSONAL OS — Router (no modules, crash-safe, dashboard default, never-white)
// Goals:
// - Navigation must never die (even if a screen crashes or hangs)
// - Dashboard is start screen (not a tab)
// - On-screen error boundary (optional, non-devtools)
// - Global Home access (Dashboard) even though it's not a tab
// - Params support (deep-link style via Router.setParam / getParam)

(function () {
  "use strict";

  // Stable namespace
  window.PersonalOS = window.PersonalOS || {};

  // -----------------------------
  // Registry guarantee
  // -----------------------------
  function ensureRegistry() {
    // Accept both: window.ScreenRegistry and window.PersonalOS.ScreenRegistry
    var reg = window.ScreenRegistry || window.PersonalOS.ScreenRegistry || null;

    // If missing, create minimal registry to prevent crashes
    if (!reg) {
      var _screens = {};
      reg = {
        register: function (name, def) { _screens[name] = def; },
        get: function (name) { return _screens[name] || null; },
        list: function () { return Object.keys(_screens); }
      };
      window.ScreenRegistry = reg;
      window.PersonalOS.ScreenRegistry = reg;
    }

    // Keep both references in sync
    window.ScreenRegistry = reg;
    window.PersonalOS.ScreenRegistry = reg;
    return reg;
  }

  // -----------------------------
  // Internal state
  // -----------------------------
  var _params = {};
  var _current = null;
  var _listeners = [];
  var _navToken = 0;

  // If a screen mount hangs forever, we will show fallback
  var MOUNT_TIMEOUT_MS = 8000;

  // -----------------------------
  // DOM helpers
  // -----------------------------
  function getHost() {
    return document.getElementById("app-content");
  }

  function mountIntoHost(htmlOrNode) {
    var host = getHost();
    if (!host) return;

    host.innerHTML = "";

    if (typeof htmlOrNode === "string") {
      host.innerHTML = htmlOrNode;
      return;
    }

    if (htmlOrNode && htmlOrNode.nodeType) {
      host.appendChild(htmlOrNode);
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderErrorScreen(title, details) {
    var wrap = document.createElement("div");
    wrap.className = "error";
    wrap.innerHTML =
      "<div style='font-weight:800; margin-bottom:6px;'>" + escapeHtml(title || "Error") + "</div>" +
      "<div style='opacity:0.85; font-size:14px; line-height:1.35;'>" + escapeHtml(details || "Unknown") + "</div>" +
      "<div style='margin-top:10px; font-size:12px; opacity:0.75;'>Navigation bleibt aktiv. Du kannst unten einen Tab wählen oder Home drücken.</div>";
    mountIntoHost(wrap);
  }

  function renderLoading(screenName) {
    mountIntoHost(
      "<div style='padding:14px; border-radius:14px; background:rgba(255,255,255,0.62); border:1px solid rgba(0,0,0,0.08); box-shadow:0 10px 22px rgba(0,0,0,0.08);'>" +
        "<div style='font-weight:800; margin-bottom:6px;'>Loading</div>" +
        "<div style='opacity:0.75; font-size:14px;'>"+ escapeHtml(String(screenName || "")) +"</div>" +
      "</div>"
    );
  }

  // -----------------------------
  // On-screen Error Boundary (overlay)
  // -----------------------------
  function ensureErrorOverlay() {
    try {
      var existing = document.getElementById("os-error-overlay");
      if (existing) return existing;

      var overlay = document.createElement("div");
      overlay.id = "os-error-overlay";
      overlay.style.position = "fixed";
      overlay.style.left = "12px";
      overlay.style.right = "12px";
      overlay.style.top = "calc(env(safe-area-inset-top, 0px) + 10px)";
      overlay.style.zIndex = "9999";
      overlay.style.display = "none";
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
            "<div style='font-weight:800; margin-bottom:4px;'>System Hinweis</div>" +
            "<div id='os-error-overlay-msg' style='font-size:13px; opacity:0.85; line-height:1.35; word-wrap:break-word;'></div>" +
          "</div>" +
          "<button id='os-error-overlay-close' type='button' style='border:0; background:rgba(18,18,18,0.08); padding:8px 10px; border-radius:12px; font-size:13px;'>OK</button>" +
        "</div>";

      document.body.appendChild(overlay);

      var closeBtn = document.getElementById("os-error-overlay-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", function () {
          try { overlay.style.display = "none"; } catch (_) {}
        });
      }

      return overlay;
    } catch (_) {
      return null;
    }
  }

  function showOverlay(msg) {
    try {
      var overlay = ensureErrorOverlay();
      if (!overlay) return;
      var box = document.getElementById("os-error-overlay-msg");
      if (box) box.textContent = String(msg || "Unbekannter Fehler");
      overlay.style.display = "block";
    } catch (_) {}
  }

  // Optional global handlers (kept minimal, do not crash app)
  function installGlobalErrorHandlersOnce() {
    try {
      if (window.PersonalOS.__globalErrorsInstalled) return;
      window.PersonalOS.__globalErrorsInstalled = true;

      window.addEventListener("error", function (ev) {
        try {
          var msg = (ev && ev.message) ? ev.message : "Unbekannter Fehler";
          showOverlay("JS Error: " + msg);
        } catch (_) {}
      });

      window.addEventListener("unhandledrejection", function (ev) {
        try {
          var reason = ev && ev.reason;
          var msg = (reason && reason.message) ? reason.message : String(reason || "Unhandled Promise Rejection");
          showOverlay("Promise Error: " + msg);
        } catch (_) {}
      });
    } catch (_) {}
  }

  // -----------------------------
  // Global Home Button (Dashboard)
  // -----------------------------
  function ensureHomeButton() {
    try {
      var existing = document.getElementById("os-home-btn");
      if (existing) return existing;

      var btn = document.createElement("button");
      btn.id = "os-home-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Home (Dashboard)");
      btn.textContent = "Home";

      // Style: liquid-glass, top-left, safe-area aware
      btn.style.position = "fixed";
      btn.style.left = "12px";
      btn.style.top = "calc(env(safe-area-inset-top, 0px) + 10px)";
      btn.style.zIndex = "9998";
      btn.style.border = "1px solid rgba(0,0,0,0.10)";
      btn.style.background = "rgba(255,255,255,0.72)";
      btn.style.color = "#121212";
      btn.style.borderRadius = "14px";
      btn.style.padding = "10px 12px";
      btn.style.fontSize = "13px";
      btn.style.fontWeight = "700";
      btn.style.boxShadow = "0 10px 24px rgba(0,0,0,0.10)";
      btn.style.backdropFilter = "blur(14px)";
      btn.style.webkitBackdropFilter = "blur(14px)";

      btn.addEventListener("click", function (e) {
        try { if (e && e.preventDefault) e.preventDefault(); } catch (_) {}
        try { Router.clearParams(); } catch (_) {}
        try { Router.go("dashboard"); } catch (_) {}
      }, { passive: false });

      document.body.appendChild(btn);
      return btn;
    } catch (_) {
      return null;
    }
  }

  // -----------------------------
  // Params
  // -----------------------------
  function setParam(key, value) {
    try { _params[String(key)] = value; } catch (_) {}
  }

  function getParam(key) {
    try { return _params[String(key)]; } catch (_) { return undefined; }
  }

  function setParams(obj) {
    try {
      if (!obj || typeof obj !== "object") return;
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        _params[k] = obj[k];
      }
    } catch (_) {}
  }

  function clearParams() {
    _params = {};
  }

  // -----------------------------
  // Listeners
  // -----------------------------
  function notify(screenName) {
    try {
      for (var i = 0; i < _listeners.length; i++) {
        try { _listeners[i](screenName); } catch (_) {}
      }
    } catch (_) {}
  }

  function onChange(fn) {
    try {
      if (typeof fn !== "function") return function () {};
      _listeners.push(fn);
      return function () {
        try {
          var idx = _listeners.indexOf(fn);
          if (idx >= 0) _listeners.splice(idx, 1);
        } catch (_) {}
      };
    } catch (_) {
      return function () {};
    }
  }

  // -----------------------------
  // Navigation (never-white)
  // -----------------------------
  function withTimeout(promise, ms, onTimeout) {
    var done = false;

    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try { if (onTimeout) onTimeout(); } catch (_) {}
        reject(new Error("Mount timeout"));
      }, ms);

      Promise.resolve(promise).then(function (v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      }).catch(function (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  async function go(screenName) {
    var reg = ensureRegistry();
    var host = getHost();

    _navToken += 1;
    var token = _navToken;

    try {
      _current = String(screenName || "");

      if (!host) {
        // Host missing is fatal for UI, but we still try to show overlay
        showOverlay("Host fehlt: #app-content nicht gefunden.");
        return;
      }

      // Loading placeholder to avoid perceived white screen
      renderLoading(_current);

      var def = reg.get(_current);
      if (!def || typeof def.mount !== "function") {
        renderErrorScreen("Screen nicht gefunden", _current);
        showOverlay("Screen nicht gefunden: " + _current);
        notify(_current);
        return;
      }

      // Important: params object reference must be stable per navigation
      var ctx = { params: _params };

      // Guard against mounts that throw or hang
      await withTimeout(
        def.mount(host, ctx),
        MOUNT_TIMEOUT_MS,
        function () {
          // only show timeout if still current nav
          if (token === _navToken) showOverlay("Screen lädt zu lange: " + _current);
        }
      );

      // If a newer navigation happened while we awaited, do nothing further
      if (token !== _navToken) return;

      notify(_current);
    } catch (e) {
      // If a newer navigation happened while we awaited, ignore
      if (token !== _navToken) return;

      var msg = (e && e.message) ? e.message : String(e || "Unknown");
      renderErrorScreen("Navigation Fehler", msg);
      showOverlay("Navigation Fehler (" + String(_current) + "): " + msg);
      notify(_current);
    }
  }

  function init() {
    try {
      ensureRegistry();
      installGlobalErrorHandlersOnce();
      ensureErrorOverlay();
      ensureHomeButton();

      // Always start on dashboard
      go("dashboard");
    } catch (e) {
      var msg = (e && e.message) ? e.message : String(e || "Unknown");
      renderErrorScreen("Boot Fehler", msg);
      showOverlay("Boot Fehler: " + msg);
    }
  }

  function getCurrent() {
    return _current;
  }

  // -----------------------------
  // Public API
  // -----------------------------
  window.Router = {
    init: init,
    go: go,

    setParam: setParam,
    getParam: getParam,
    setParams: setParams,
    clearParams: clearParams,

    onChange: onChange,
    getCurrent: getCurrent
  };

  window.PersonalOS.Router = window.Router;

})();
