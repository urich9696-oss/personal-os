// js/core/router.js
// PERSONAL OS — Router (single-page, mounts ScreenRegistry screens into #app-content)
// Goals:
// - global Router.go(screenName)
// - params: setParam, setParams, getParam, clearParams
// - emits window event "personalos:navigated" with {screen}
// - defensive, no throws

(function () {
  "use strict";

  var Router = (function () {
    var _params = {};
    var _current = null;
    var _mountToken = 0;

    function _getHost() {
      try { return document.getElementById("app-content"); } catch (_) { return null; }
    }

    function _emitNavigated(screenName) {
      try {
        var ev = new CustomEvent("personalos:navigated", { detail: { screen: String(screenName || "") } });
        window.dispatchEvent(ev);
      } catch (_) {}
    }

    function setParam(k, v) {
      try {
        var key = String(k || "").trim();
        if (!key) return;
        _params[key] = v;
      } catch (_) {}
    }

    function setParams(obj) {
      try {
        if (!obj || typeof obj !== "object") return;
        for (var k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) setParam(k, obj[k]);
        }
      } catch (_) {}
    }

    function getParam(k) {
      try {
        var key = String(k || "").trim();
        return _params[key];
      } catch (_) {
        return undefined;
      }
    }

    function clearParams() {
      try { _params = {}; } catch (_) {}
    }

    async function go(screenName) {
      var token = ++_mountToken;

      try {
        var name = String(screenName || "").trim();
        if (!name) name = "dashboard";

        var host = _getHost();
        if (!host) return false;

        // If screen not registered, fallback
        var reg = (window.ScreenRegistry && typeof window.ScreenRegistry.get === "function")
          ? window.ScreenRegistry.get(name)
          : null;

        if (!reg) {
          name = "dashboard";
          reg = (window.ScreenRegistry && typeof window.ScreenRegistry.get === "function")
            ? window.ScreenRegistry.get(name)
            : null;
        }

        host.innerHTML = "";

        // render minimal error if still missing
        if (!reg || typeof reg.mount !== "function") {
          host.innerHTML =
            "<div class='dash-card' style='margin-top:12px;'>" +
              "<div style='font-weight:900;'>Screen missing</div>" +
              "<div style='font-size:13px; opacity:0.75; margin-top:6px;'>" +
                "Registry hat keinen Screen: " + escapeHtml(name) +
              "</div>" +
            "</div>";
          _current = name;
          _emitNavigated(name);
          return false;
        }

        _current = name;
        _emitNavigated(name);

        // mount
        await reg.mount(host, { screen: name, params: _params });

        // If another navigation started while mounting, ignore
        if (token !== _mountToken) return false;

        return true;
      } catch (e) {
        try {
          var h = _getHost();
          if (h) {
            h.innerHTML =
              "<div class='dash-card' style='margin-top:12px; border:1px solid rgba(160,60,60,0.25);'>" +
                "<div style='font-weight:900; color:#7a1f1f;'>Router error</div>" +
                "<div style='font-size:12px; opacity:0.85; margin-top:8px; white-space:pre-wrap;'>" +
                  escapeHtml(String(e && (e.message || e) || "unknown")) +
                "</div>" +
              "</div>";
          }
        } catch (_) {}
        return false;
      }
    }

    function current() { return _current; }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    return {
      go: go,
      current: current,
      setParam: setParam,
      setParams: setParams,
      getParam: getParam,
      clearParams: clearParams
    };
  })();

  try { window.Router = Router; } catch (_) {}
  try { if (typeof globalThis !== "undefined") globalThis.Router = Router; } catch (_) {}
})();
