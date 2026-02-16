(function () {
  "use strict";

  // PERSONAL OS — Router (hash-based, params)
  // - Keeps bottom nav active state
  // - Supports Router.go(name, params)
  // - Supports Router.getParam / setParam
  // - Default screen: dashboard

  var Router = {};
  var current = { name: null, params: {} };

  function parseHash() {
    var h = location.hash || "";
    if (!h || h === "#") return { name: "dashboard", params: {} };

    // Format: #screen?key=value&k2=v2
    if (h.charAt(0) === "#") h = h.slice(1);

    var parts = h.split("?");
    var name = (parts[0] || "dashboard").trim();
    if (!name) name = "dashboard";

    var params = {};
    if (parts[1]) {
      var qs = parts[1].split("&");
      for (var i = 0; i < qs.length; i++) {
        var kv = qs[i].split("=");
        var k = decodeURIComponent(kv[0] || "").trim();
        if (!k) continue;
        var v = decodeURIComponent(kv[1] || "");
        params[k] = v;
      }
    }

    return { name: name, params: params };
  }

  function buildHash(name, params) {
    name = name || "dashboard";
    var p = params || {};
    var keys = Object.keys(p).filter(function (k) { return p[k] !== undefined && p[k] !== null && String(p[k]).length > 0; });
    if (!keys.length) return "#" + name;

    var qs = keys.map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(String(p[k]));
    }).join("&");

    return "#" + name + "?" + qs;
  }

  function setActiveNav(routeName) {
    try {
      var btns = document.querySelectorAll(".bottom-nav__btn");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var r = b.getAttribute("data-route");
        if (!r) continue;

        // Dashboard is not a tab: no active highlight when on dashboard
        if (routeName === "dashboard") {
          b.classList.remove("is-active");
          continue;
        }

        if (r === routeName) b.classList.add("is-active");
        else b.classList.remove("is-active");
      }
    } catch (e) {}
  }

  async function render() {
    var parsed = parseHash();
    current.name = parsed.name;
    current.params = parsed.params || {};

    setActiveNav(current.name);

    var container = document.getElementById("app-content");
    if (!container) return;

    // Safety: never keep old UI
    container.innerHTML = "";

    var screen = ScreenRegistry.get(current.name);
    if (!screen || typeof screen.mount !== "function") {
      container.innerHTML = "";
      container.appendChild(UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Route not found" }, []),
        UI.el("div", { className: "tile__value", text: current.name }, [])
      ]));
      return;
    }

    try {
      await screen.mount(container, { params: current.params });
    } catch (e) {
      var msg = (e && e.message) ? e.message : String(e);
      container.innerHTML = "";
      container.appendChild(UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Screen Error" }, []),
        UI.el("div", { className: "tile__value", text: msg }, [])
      ]));
    }
  }

  Router.init = function () {
    // Ensure default
    if (!location.hash || location.hash === "#") {
      location.hash = "#dashboard";
      return;
    }
    render();
    window.addEventListener("hashchange", render);
  };

  Router.go = function (name, params) {
    location.hash = buildHash(name, params || {});
  };

  Router.getParam = function (key) {
    return current.params ? current.params[key] : undefined;
  };

  Router.setParam = function (key, value) {
    current.params = current.params || {};
    if (value === null || value === undefined || String(value).length === 0) {
      delete current.params[key];
    } else {
      current.params[key] = String(value);
    }
    location.hash = buildHash(current.name || "dashboard", current.params);
  };

  window.Router = Router;
})();
