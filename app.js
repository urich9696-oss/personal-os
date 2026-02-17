/* app.js — Global Framework, Router, Navigation (Batch 1)
   - Dashboard is default start screen (not a tab)
   - Fixed Topbar (Dashboard button) + Bottom Nav (5 tabs)
   - Offline-first: SW registration + Kill-Switch ?nosw=1 (unregister + clear caches + reload)
*/

(function () {
  "use strict";

  var APP_VERSION = "1.0.0";

  function $(id) { return document.getElementById(id); }

  // ---------- Utilities ----------
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function monthKey(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }
  function formatNiceDate(d) {
    // English, iOS-like short format
    try {
      return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "2-digit" }).format(d);
    } catch (e) {
      return dayKey(d);
    }
  }

  // ---------- Toast ----------
  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-show");
    }, 2200);
  }

  // ---------- Kill-Switch ----------
  function hasNoSwFlag() {
    try {
      var qs = new URLSearchParams(location.search);
      return qs.get("nosw") === "1";
    } catch (e) {
      return false;
    }
  }

  async function runKillSwitchIfNeeded() {
    if (!hasNoSwFlag()) return false;

    try {
      // Unregister service workers
      if ("serviceWorker" in navigator) {
        var regs = await navigator.serviceWorker.getRegistrations();
        for (var i = 0; i < regs.length; i++) {
          try { await regs[i].unregister(); } catch (e) {}
        }
      }

      // Clear caches
      if (window.caches && caches.keys) {
        var keys = await caches.keys();
        for (var k = 0; k < keys.length; k++) {
          try { await caches.delete(keys[k]); } catch (e) {}
        }
      }

      // Remove flag and hard reload
      var url = new URL(location.href);
      url.searchParams.delete("nosw");
      location.replace(url.toString());
      return true;
    } catch (e) {
      // If kill switch fails, still allow app to load
      return false;
    }
  }

  // ---------- Router ----------
  // Routes: dashboard, alignment, maintenance, path, finance, settings
  var Router = (function () {
    var current = null;

    function parseRoute() {
      // Prefer hash like #/alignment; fallback to dashboard
      var h = location.hash || "";
      if (h.indexOf("#/") === 0) {
        var r = h.slice(2).trim();
        if (!r) return "dashboard";
        return r.split("?")[0];
      }
      return "dashboard";
    }

    function go(route) {
      if (!route) route = "dashboard";
      location.hash = "#/" + route;
    }

    function onChange(fn) {
      window.addEventListener("hashchange", fn);
    }

    function getCurrent() { return current; }

    async function render() {
      var route = parseRoute();
      current = route;

      // Update nav active state
      setNavActive(route);

      // Mount screen
      var view = $("view");
      if (!view) return;

      try {
        view.innerHTML = "";
        if (route === "dashboard") {
          Screens.dashboard(view);
        } else if (route === "alignment") {
          Screens.alignment(view);
        } else if (route === "maintenance") {
          Screens.maintenance(view);
        } else if (route === "path") {
          Screens.path(view);
        } else if (route === "finance") {
          Screens.finance(view);
        } else if (route === "settings") {
          Screens.settings(view);
        } else {
          Screens.notFound(view, route);
        }
      } catch (e) {
        Screens.bootError(view, "Render Error", String(e && e.message ? e.message : e));
      }
    }

    return {
      go: go,
      render: render,
      onChange: onChange,
      getCurrent: getCurrent
    };
  })();

  function setNavActive(route) {
    var btns = document.querySelectorAll(".navbtn");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var r = b.getAttribute("data-route");
      var active = (route === r);
      b.classList.toggle("is-active", !!active);
      b.setAttribute("aria-current", active ? "page" : "false");
    }
  }

  // ---------- Minimal State (Batch 1 placeholder) ----------
  var State = (function () {
    var s = {
      today: dayKey(new Date()),
      month: monthKey(new Date()),
      // These become real in later batches
      performanceScore: 0,
      nextBlockLabel: "No blocks yet",
      budgetRemainingLabel: "—",
      gatekeeperLabel: "No active lock"
    };

    function refreshDerived() {
      // Placeholder; later computed from IndexedDB
      return s;
    }

    function get() {
      return refreshDerived();
    }

    return { get: get };
  })();

  // ---------- Screens (Batch 1 UI skeleton) ----------
  var Screens = (function () {
    function sectionTitle(title, subtitle) {
      var wrap = document.createElement("div");
      wrap.className = "stack";

      var h = document.createElement("div");
      h.className = "glass card card--strong";

      var t = document.createElement("div");
      t.className = "h1";
      t.textContent = title;

      var p = document.createElement("div");
      p.className = "p";
      p.textContent = subtitle;

      h.appendChild(t);
      h.appendChild(p);
      wrap.appendChild(h);
      return wrap;
    }

    function dashboard(container) {
      var st = State.get();

      var root = document.createElement("div");
      root.className = "stack";

      // Hero
      var hero = document.createElement("div");
      hero.className = "glass card card--strong";

      var h1 = document.createElement("div");
      h1.className = "h1";
      h1.textContent = "Dashboard";

      var p = document.createElement("div");
      p.className = "p";
      p.textContent = "Your daily command center. Performance, Path, Budget, and Gatekeeper — in one glance.";

      hero.appendChild(h1);
      hero.appendChild(p);

      var btn = document.createElement("button");
      btn.className = "btnPrimary";
      btn.type = "button";
      btn.textContent = "Start Journal";
      btn.addEventListener("click", function () {
        // Batch 2 will choose Morning/Evening and open Alignment flow
        toast("Journal opens in Batch 2 (Alignment).");
        Router.go("alignment");
      });

      hero.appendChild(document.createElement("div")).style.height = "10px";
      hero.appendChild(btn);

      root.appendChild(hero);

      // Widgets
      var row1 = document.createElement("div");
      row1.className = "row";

      row1.appendChild(widgetCard("Performance", "Score", st.performanceScore ? String(st.performanceScore) : "—"));
      row1.appendChild(widgetCard("Next Block", "Today’s Path", st.nextBlockLabel));

      var row2 = document.createElement("div");
      row2.className = "row";

      row2.appendChild(widgetCard("Budget", "Remaining", st.budgetRemainingLabel));
      row2.appendChild(widgetCard("Gatekeeper", "72h Lock", st.gatekeeperLabel));

      root.appendChild(row1);
      root.appendChild(row2);

      // Quick actions (placeholder)
      var qa = document.createElement("div");
      qa.className = "glass card";
      qa.appendChild(textLine("Quick Actions", "Fast entry points will be added in Batch 6."));
      qa.appendChild(spacer(10));
      var a1 = document.createElement("button");
      a1.className = "btnGhost";
      a1.type = "button";
      a1.textContent = "Open Today’s Path";
      a1.onclick = function () { Router.go("path"); };
      qa.appendChild(a1);

      root.appendChild(qa);

      container.appendChild(root);
    }

    function widgetCard(title, meta, value) {
      var c = document.createElement("div");
      c.className = "glass card";
      c.appendChild(textLine(title, meta));
      c.appendChild(spacer(10));

      var v = document.createElement("div");
      v.className = "h1";
      v.style.fontSize = "18px";
      v.style.fontWeight = "820";
      v.style.margin = "0";
      v.textContent = value;

      c.appendChild(v);
      return c;
    }

    function textLine(title, meta) {
      var wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.alignItems = "baseline";
      wrap.style.justifyContent = "space-between";
      wrap.style.gap = "12px";

      var t = document.createElement("div");
      t.style.fontWeight = "820";
      t.style.letterSpacing = ".2px";
      t.textContent = title;

      var m = document.createElement("div");
      m.style.color = "rgba(18,18,18,.55)";
      m.style.fontSize = "12px";
      m.style.fontWeight = "650";
      m.textContent = meta;

      wrap.appendChild(t);
      wrap.appendChild(m);
      return wrap;
    }

    function spacer(h) {
      var s = document.createElement("div");
      s.style.height = (h || 12) + "px";
      return s;
    }

    function alignment(container) {
      var root = sectionTitle("Alignment", "Morning Flow, Evening Flow, and Vault are implemented in Batch 2.");
      var card = document.createElement("div");
      card.className = "glass card";

      var p = document.createElement("div");
      p.className = "p";
      p.textContent = "This tab becomes your daily mental operating system: journaling, reflection, and an immutable archive.";

      card.appendChild(p);
      card.appendChild(spacer(12));

      var b1 = document.createElement("button");
      b1.className = "btnGhost";
      b1.type = "button";
      b1.textContent = "Start Morning Flow";
      b1.onclick = function () { toast("Batch 2 will activate Morning Flow."); };

      var b2 = document.createElement("button");
      b2.className = "btnGhost";
      b2.type = "button";
      b2.textContent = "Start Evening Flow";
      b2.style.marginLeft = "10px";
      b2.onclick = function () { toast("Batch 2 will activate Evening Flow."); };

      card.appendChild(b1);
      card.appendChild(b2);

      root.appendChild(card);
      container.appendChild(root);
    }

    function maintenance(container) {
      var root = sectionTitle("Maintenance", "Habits and Daily Tasks management is implemented in Batch 3.");
      var card = document.createElement("div");
      card.className = "glass card";
      var p = document.createElement("div");
      p.className = "p";
      p.textContent = "Maintenance feeds the Performance score on the Dashboard (checkbox logic in Batch 3).";
      card.appendChild(p);
      root.appendChild(card);
      container.appendChild(root);
    }

    function path(container) {
      var root = sectionTitle("Today’s Path", "Time blocks and template engine are implemented in Batch 4.");
      var card = document.createElement("div");
      card.className = "glass card";
      var p = document.createElement("div");
      p.className = "p";
      p.textContent = "Batch 4 adds iOS-like time pickers and a one-click template loader (e.g., Workday).";
      card.appendChild(p);
      root.appendChild(card);
      container.appendChild(root);
    }

    function finance(container) {
      var root = sectionTitle("Finance", "Budget tracker and 72h Gatekeeper are implemented in Batch 5.");
      var card = document.createElement("div");
      card.className = "glass card";
      var p = document.createElement("div");
      p.className = "p";
      p.textContent = "Batch 5 builds your monthly budget control and impulse-purchase barrier with countdown and unlock logic.";
      card.appendChild(p);
      root.appendChild(card);
      container.appendChild(root);
    }

    function settings(container) {
      var root = sectionTitle("Settings", "Export/Import and system reset are implemented in Batch 6.");
      var card = document.createElement("div");
      card.className = "glass card";

      var p = document.createElement("div");
      p.className = "p";
      p.textContent = "Batch 6 delivers OS integrity: JSON export/import, safe reset, and offline update prompts.";

      card.appendChild(p);
      card.appendChild(spacer(12));

      var btn = document.createElement("button");
      btn.className = "btnGhost";
      btn.type = "button";
      btn.textContent = "Run Offline Check";
      btn.onclick = async function () {
        try {
          await DB.open();
          toast("Offline storage ready (IndexedDB OK).");
        } catch (e) {
          toast("IndexedDB error. Safari Private Mode may block storage.");
        }
      };

      card.appendChild(btn);
      root.appendChild(card);
      container.appendChild(root);
    }

    function notFound(container, route) {
      var root = sectionTitle("Not Found", "Unknown route: " + route);
      container.appendChild(root);
    }

    function bootError(container, title, details) {
      container.innerHTML = "";
      var root = document.createElement("div");
      root.className = "stack";

      var card = document.createElement("div");
      card.className = "glass card card--strong";

      var h = document.createElement("div");
      h.className = "h1";
      h.textContent = title;

      var p = document.createElement("div");
      p.className = "p";
      p.textContent = details;

      card.appendChild(h);
      card.appendChild(p);

      var b = document.createElement("button");
      b.className = "btnGhost";
      b.type = "button";
      b.textContent = "Reload";
      b.onclick = function () { location.reload(); };

      root.appendChild(card);
      root.appendChild(b);

      container.appendChild(root);
    }

    return {
      dashboard: dashboard,
      alignment: alignment,
      maintenance: maintenance,
      path: path,
      finance: finance,
      settings: settings,
      notFound: notFound,
      bootError: bootError
    };
  })();

  // ---------- Service Worker ----------
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;

    // Kill-switch should have priority
    if (hasNoSwFlag()) return;

    try {
      // Register relative to current base (GitHub Pages subpath safe)
      await navigator.serviceWorker.register("./sw.js?v=" + encodeURIComponent(APP_VERSION), { scope: "./" });
    } catch (e) {
      // Do not block app; show minimal feedback
      // (iOS sometimes fails silently on first load)
    }
  }

  // ---------- Boot ----------
  async function boot() {
    // Set date
    var d = new Date();
    var dateEl = $("today-date");
    if (dateEl) dateEl.textContent = formatNiceDate(d);

    // Kill-switch if requested
    var killed = await runKillSwitchIfNeeded();
    if (killed) return;

    // Ensure DB is usable early (so future batches rely on it)
    try {
      await DB.open();
    } catch (e) {
      toast("Storage unavailable. Avoid Private Mode on iOS Safari.");
    }

    // Wire nav
    var dashBtn = $("btn-dashboard");
    if (dashBtn) dashBtn.addEventListener("click", function () { Router.go("dashboard"); });

    var navBtns = document.querySelectorAll(".navbtn");
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].addEventListener("click", function (ev) {
        var r = ev.currentTarget.getAttribute("data-route");
        Router.go(r);
      });
    }

    // Render now + on route change
    Router.onChange(Router.render);

    // Default route: dashboard (if hash empty)
    if (!location.hash || location.hash === "#") {
      Router.go("dashboard");
    } else {
      await Router.render();
    }

    // SW registration after UI is up
    registerSW();
  }

  boot().catch(function (e) {
    var view = $("view");
    if (view) {
      Screens.bootError(view, "Boot Error", String(e && e.message ? e.message : e));
    }
  });
})();
