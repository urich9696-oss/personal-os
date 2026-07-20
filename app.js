/* app.js — Batch 3
   Adds:
   - Maintenance tab: manage Habits + Daily Tasks and check them off for today
   - Performance score on Dashboard:
     score = completed_today / total_active_today  (0..100)
   - Journal/Vault from Batch 2 retained
*/

(function () {
  "use strict";

  var APP_VERSION = "1.0.5";

  function $(id) { return document.getElementById(id); }

  // ---------- Utilities ----------
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function monthKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }
  function formatNiceDate(d) {
    try { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "2-digit" }).format(d); }
    catch (e) { return dayKey(d); }
  }

  function qs() {
    try { return new URLSearchParams(location.search); } catch (e) { return null; }
  }

  function getHashRoute() {
    var h = location.hash || "";
    if (h.indexOf("#/") === 0) return h.slice(2);
    return "";
  }

  function parseHash() {
    var raw = getHashRoute();
    var parts = raw.split("?");
    var route = (parts[0] || "dashboard").trim() || "dashboard";
    var params = new URLSearchParams(parts[1] || "");
    return { route: route, params: params };
  }

  function setHash(route, params) {
    var p = params ? params.toString() : "";
    location.hash = "#/" + route + (p ? ("?" + p) : "");
  }

  // ---------- Toast ----------
  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-show"); }, 2200);
  }

  // ---------- View timers (cleared on every route render) ----------
  var Timers = {
    _ids: [],
    add: function (id) { this._ids.push(id); return id; },
    clearAll: function () {
      for (var i = 0; i < this._ids.length; i++) {
        try { clearInterval(this._ids[i]); } catch (e) {}
      }
      this._ids = [];
    }
  };

  // ---------- Kill-Switch ----------
  function hasNoSwFlag() {
    try { var q = qs(); return q && q.get("nosw") === "1"; } catch (e) { return false; }
  }

  async function runKillSwitchIfNeeded() {
    if (!hasNoSwFlag()) return false;

    try {
      if ("serviceWorker" in navigator) {
        var regs = await navigator.serviceWorker.getRegistrations();
        for (var i = 0; i < regs.length; i++) {
          try { await regs[i].unregister(); } catch (e) {}
        }
      }

      if (window.caches && caches.keys) {
        var keys = await caches.keys();
        for (var k = 0; k < keys.length; k++) {
          try { await caches.delete(keys[k]); } catch (e) {}
        }
      }

      var url = new URL(location.href);
      url.searchParams.delete("nosw");
      location.replace(url.toString());
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- Router ----------
  var Router = (function () {
    var current = "dashboard";

    function go(route, paramsObj) {
      var params = new URLSearchParams(paramsObj || {});
      setHash(route || "dashboard", params);
    }

    function getCurrent() { return current; }

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

    async function render() {
      var parsed = parseHash();
      current = parsed.route;

      Timers.clearAll();
      setNavActive(current);

      var view = $("view");
      if (!view) return;

      try {
        view.innerHTML = "";
        if (current === "dashboard") await Screens.dashboard(view);
        else if (current === "alignment") await Screens.alignment(view, parsed.params);
        else if (current === "maintenance") await Screens.maintenance(view);
        else if (current === "path") await Screens.path(view);
        else if (current === "finance") await Screens.finance(view);
        else if (current === "settings") await Screens.settings(view);
        else Screens.notFound(view, current);
      } catch (e) {
        Screens.bootError(view, "Render Error", String(e && e.message ? e.message : e));
      }
    }

    function onChange(fn) { window.addEventListener("hashchange", fn); }

    return { go: go, render: render, onChange: onChange, getCurrent: getCurrent };
  })();

  // ---------- State ----------
  var State = (function () {
    var s = {
      today: dayKey(new Date()),
      month: monthKey(new Date()),

      // Alignment
      morning: null,
      evening: null,
      vaultList: [],
      vaultDetail: null,

      // Maintenance
      habits: [],
      tasks: [],
      checksToday: [],
      perf: { total: 0, done: 0, score: 0 }
    };

    function defaultMorning() {
      return { focus: "", gratitude: "", intention: "" };
    }
    function defaultEvening() {
      return { wins: "", lessons: "", master1: "", master2: "", master3: "", master4: "" };
    }

    async function loadTodayJournal() {
      var day = s.today;
      var m = await DB.getJournal(day, "morning");
      var e = await DB.getJournal(day, "evening");
      s.morning = m ? (m.payload || defaultMorning()) : defaultMorning();
      s.evening = e ? (e.payload || defaultEvening()) : defaultEvening();
    }

    async function saveMorning(payload) {
      s.morning = payload;
      await DB.upsertJournal(s.today, "morning", payload);
    }

    async function saveEvening(payload) {
      s.evening = payload;
      await DB.upsertJournal(s.today, "evening", payload);
    }

    async function loadVaultList() { s.vaultList = await DB.listVault(); }

    async function loadVaultDetail(dayKey) {
      s.vaultDetail = await DB.getVaultSnapshot(dayKey);
      return s.vaultDetail;
    }

    async function closeDayToVault() {
      var day = s.today;
      var existing = await DB.getVaultSnapshot(day);
      if (existing) return { ok: false, reason: "already_closed" };

      var allJournal = await DB.listJournalByDay(day);
      var morning = null, evening = null;

      for (var i = 0; i < allJournal.length; i++) {
        if (allJournal[i].flow === "morning") morning = allJournal[i].payload || null;
        if (allJournal[i].flow === "evening") evening = allJournal[i].payload || null;
      }

      // Maintenance snapshot (today)
      var maint = await computeMaintenanceSnapshot();

      var snapshot = {
        dayKey: day,
        journal: { morning: morning, evening: evening },
        maintenance: maint,
        path: null,
        finance: null,
        gatekeeper: null
      };

      await DB.putVaultSnapshot(day, snapshot);
      return { ok: true };
    }

    // ---- Maintenance ----
    async function loadMaintenance() {
      s.habits = await DB.listHabits();
      s.tasks = await DB.listTasks();
      s.checksToday = await DB.listChecksForDay(s.today);
      s.perf = computePerformanceLocal();
    }

    function isTargetChecked(kind, id) {
      var tkey = kind + ":" + id;
      for (var i = 0; i < s.checksToday.length; i++) {
        if (s.checksToday[i].targetKey === tkey) return true;
      }
      return false;
    }

    async function toggleCheck(kind, id, checked) {
      await DB.setChecked(s.today, kind, id, checked);
      s.checksToday = await DB.listChecksForDay(s.today);
      s.perf = computePerformanceLocal();
      return s.perf;
    }

    async function addHabit(name) {
      await DB.addHabit(name);
      s.habits = await DB.listHabits();
      s.perf = computePerformanceLocal();
    }

    async function addTask(name, category) {
      await DB.addTask(name, category);
      s.tasks = await DB.listTasks();
      s.perf = computePerformanceLocal();
    }

    async function setHabitActive(id, active) {
      await DB.setHabitActive(id, active);
      s.habits = await DB.listHabits();
      s.perf = computePerformanceLocal();
    }

    async function setTaskActive(id, active) {
      await DB.setTaskActive(id, active);
      s.tasks = await DB.listTasks();
      s.perf = computePerformanceLocal();
    }

    function computePerformanceLocal() {
      var activeHabits = s.habits.filter(function (h) { return !!h.active; });
      var activeTasks = s.tasks.filter(function (t) { return !!t.active; });
      var total = activeHabits.length + activeTasks.length;

      var done = 0;
      for (var i = 0; i < activeHabits.length; i++) {
        if (isTargetChecked("habit", activeHabits[i].id)) done++;
      }
      for (var j = 0; j < activeTasks.length; j++) {
        if (isTargetChecked("task", activeTasks[j].id)) done++;
      }

      var score = total > 0 ? Math.round((done / total) * 100) : 0;
      return { total: total, done: done, score: score };
    }

    async function computeMaintenanceSnapshot() {
      // Snapshot minimal summary
      var activeHabits = (await DB.listHabits()).filter(function (h) { return !!h.active; });
      var activeTasks = (await DB.listTasks()).filter(function (t) { return !!t.active; });
      var checks = await DB.listChecksForDay(s.today);

      var doneKeys = {};
      for (var i = 0; i < checks.length; i++) doneKeys[checks[i].targetKey] = true;

      var items = [];
      for (var a = 0; a < activeHabits.length; a++) {
        items.push({
          kind: "habit",
          id: activeHabits[a].id,
          name: activeHabits[a].name,
          done: !!doneKeys["habit:" + activeHabits[a].id]
        });
      }
      for (var b = 0; b < activeTasks.length; b++) {
        items.push({
          kind: "task",
          id: activeTasks[b].id,
          name: activeTasks[b].name,
          category: activeTasks[b].category || "General",
          done: !!doneKeys["task:" + activeTasks[b].id]
        });
      }

      var total = items.length;
      var done = items.filter(function (x) { return x.done; }).length;
      var score = total > 0 ? Math.round((done / total) * 100) : 0;

      return { total: total, done: done, score: score, items: items };
    }

    return {
      s: s,
      loadTodayJournal: loadTodayJournal,
      saveMorning: saveMorning,
      saveEvening: saveEvening,
      loadVaultList: loadVaultList,
      loadVaultDetail: loadVaultDetail,
      closeDayToVault: closeDayToVault,

      loadMaintenance: loadMaintenance,
      isTargetChecked: isTargetChecked,
      toggleCheck: toggleCheck,
      addHabit: addHabit,
      addTask: addTask,
      setHabitActive: setHabitActive,
      setTaskActive: setTaskActive
    };
  })();

  // ---------- UI helpers ----------
  function spacer(h) { var s = document.createElement("div"); s.style.height = (h || 12) + "px"; return s; }

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
    m.style.fontWeight = "700";
    m.textContent = meta;

    wrap.appendChild(t);
    wrap.appendChild(m);
    return wrap;
  }

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

  function labeledTextarea(label, value, placeholder) {
    var wrap = document.createElement("div");
    var l = document.createElement("div");
    l.className = "label";
    l.textContent = label;

    var t = document.createElement("textarea");
    t.className = "input textarea";
    t.value = value || "";
    t.placeholder = placeholder || "";

    wrap.appendChild(l);
    wrap.appendChild(t);
    return { wrap: wrap, textarea: t };
  }

  function labeledInput(label, value, placeholder) {
    var wrap = document.createElement("div");
    var l = document.createElement("div");
    l.className = "label";
    l.textContent = label;

    var i = document.createElement("input");
    i.className = "input";
    i.type = "text";
    i.value = value || "";
    i.placeholder = placeholder || "";

    wrap.appendChild(l);
    wrap.appendChild(i);
    return { wrap: wrap, input: i };
  }

  function makeInput(type, value, placeholder, attrs) {
    var i = document.createElement("input");
    i.className = "input";
    i.type = type || "text";
    if (value !== null && typeof value !== "undefined") i.value = value;
    if (placeholder) i.placeholder = placeholder;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { i.setAttribute(k, attrs[k]); });
    }
    return i;
  }

  function fieldWrap(labelText, el) {
    var wrap = document.createElement("div");
    var l = document.createElement("div");
    l.className = "label";
    l.textContent = labelText;
    wrap.appendChild(l);
    wrap.appendChild(el);
    return wrap;
  }

  function formatMoney(n) {
    var v = Number(n) || 0;
    try {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
    } catch (e) {
      return v.toFixed(2) + " €";
    }
  }

  function formatCountdown(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var parts = [];
    if (d) parts.push(d + "d");
    parts.push(h + "h");
    parts.push(m + "m");
    parts.push(s + "s");
    return parts.join(" ");
  }

  // Chart colour palette (Apple-like, multi-colour)
  var PALETTE = [
    "#0071e3", "#34c759", "#ff9500", "#ff2d55", "#5856d6",
    "#af52de", "#5ac8fa", "#ffcc00", "#00c7be", "#ff3b30", "#8e8e93"
  ];

  var SVG_NS = "http://www.w3.org/2000/svg";

  function polarPoint(cx, cy, r, angleDeg) {
    var a = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    var start = polarPoint(cx, cy, r, endAngle);
    var end = polarPoint(cx, cy, r, startAngle);
    var largeArc = (endAngle - startAngle) <= 180 ? "0" : "1";
    return ["M", cx, cy, "L", start.x, start.y,
      "A", r, r, 0, largeArc, 0, end.x, end.y, "Z"].join(" ");
  }

  // slices: [{ label, value, color }]. Returns a DOM node with an SVG pie + legend.
  function pieChart(slices) {
    var total = 0;
    for (var i = 0; i < slices.length; i++) total += Number(slices[i].value) || 0;

    var wrap = document.createElement("div");
    wrap.className = "chart";

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "chart__svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Expense breakdown pie chart");

    var cx = 50, cy = 50, r = 46;

    if (total <= 0) {
      var empty = document.createElementNS(SVG_NS, "circle");
      empty.setAttribute("cx", cx); empty.setAttribute("cy", cy); empty.setAttribute("r", r);
      empty.setAttribute("fill", "rgba(0,0,0,.06)");
      svg.appendChild(empty);
    } else if (slices.length === 1) {
      var full = document.createElementNS(SVG_NS, "circle");
      full.setAttribute("cx", cx); full.setAttribute("cy", cy); full.setAttribute("r", r);
      full.setAttribute("fill", slices[0].color);
      svg.appendChild(full);
    } else {
      var angle = 0;
      for (var j = 0; j < slices.length; j++) {
        var frac = (Number(slices[j].value) || 0) / total;
        var sweep = frac * 360;
        var path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", arcPath(cx, cy, r, angle, angle + sweep));
        path.setAttribute("fill", slices[j].color);
        path.setAttribute("stroke", "#fff");
        path.setAttribute("stroke-width", "1");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
        angle += sweep;
      }
    }

    wrap.appendChild(svg);

    var legend = document.createElement("div");
    legend.className = "legend";
    for (var k = 0; k < slices.length; k++) {
      var s = slices[k];
      var pct = total > 0 ? Math.round(((Number(s.value) || 0) / total) * 100) : 0;

      var rowEl = document.createElement("div");
      rowEl.className = "legend__row";

      var sw = document.createElement("span");
      sw.className = "legend__swatch";
      sw.style.background = s.color;

      var lab = document.createElement("span");
      lab.className = "legend__label";
      lab.textContent = s.label;

      var val = document.createElement("span");
      val.className = "legend__val";
      val.textContent = formatMoney(s.value) + " · " + pct + "%";

      rowEl.appendChild(sw);
      rowEl.appendChild(lab);
      rowEl.appendChild(val);
      legend.appendChild(rowEl);
    }
    wrap.appendChild(legend);

    return wrap;
  }

  // Build expense slices from one-off transactions (grouped by note) + recurring items.
  function buildExpenseSlices(txns, recurringItems) {
    var map = {};
    var order = [];
    (txns || []).forEach(function (t) {
      var key = (t.note && t.note.trim()) ? t.note.trim() : "Uncategorized";
      if (!(key in map)) { map[key] = 0; order.push(key); }
      map[key] += Number(t.amount) || 0;
    });

    var slices = order.map(function (k) { return { label: k, value: map[k] }; });

    (recurringItems || []).forEach(function (rc) {
      if (rc.active === false) return;
      slices.push({ label: rc.name + " (monatlich)", value: Number(rc.amount) || 0 });
    });

    slices = slices.filter(function (s) { return s.value > 0; });
    slices.sort(function (a, b) { return b.value - a.value; });
    slices.forEach(function (s, i) { s.color = PALETTE[i % PALETTE.length]; });
    return slices;
  }

  function segmented(initialKey, items, onChange) {
    var host = document.createElement("div");
    host.className = "glass card segment";

    var activeKey = initialKey;

    function setActive(k) {
      activeKey = k;
      var btns = host.querySelectorAll(".segbtn");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        b.classList.toggle("is-active", b.getAttribute("data-key") === activeKey);
      }
      if (typeof onChange === "function") onChange(activeKey);
    }

    for (var i = 0; i < items.length; i++) {
      (function (it) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "segbtn";
        b.textContent = it.label;
        b.setAttribute("data-key", it.key);
        b.onclick = function () { setActive(it.key); };
        host.appendChild(b);
      })(items[i]);
    }

    setTimeout(function () { setActive(activeKey); }, 0);

    return { el: host, set: setActive };
  }

  // ---------- Screens ----------
  var Screens = (function () {

    async function dashboard(container) {
      // compute performance from Maintenance
      await State.loadMaintenance();
      var perf = State.s.perf;

      // Live summaries for widgets (Batches 4 & 5)
      var today = State.s.today;
      var month = State.s.month;

      var dayBlocks = await DB.listBlocksByDay(today);
      var nowD = new Date();
      var nowHM = pad2(nowD.getHours()) + ":" + pad2(nowD.getMinutes());
      var nextBlock = null;
      for (var bi = 0; bi < dayBlocks.length; bi++) {
        if ((dayBlocks[bi].start || "") >= nowHM) { nextBlock = dayBlocks[bi]; break; }
      }
      var nextText = nextBlock
        ? (nextBlock.start + " · " + nextBlock.title)
        : (dayBlocks.length ? "Day complete" : "No blocks yet");

      var budget = await DB.getBudget(month);
      var spent = (await DB.sumTransactionsForMonth(month)) + (await DB.sumRecurring());
      var budgetText = budget > 0 ? formatMoney(budget - spent) : "—";

      var gates = await DB.listGates();
      var nowMs = Date.now();
      var lockedCount = 0, readyCount = 0;
      for (var gi = 0; gi < gates.length; gi++) {
        if (nowMs >= gates[gi].unlockAt) readyCount++;
        else lockedCount++;
      }
      var gateText = lockedCount ? (lockedCount + " locked")
        : (readyCount ? (readyCount + " ready") : "No active lock");

      var root = document.createElement("div");
      root.className = "stack";

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
      btn.onclick = function () { Router.go("alignment", { mode: "choose" }); };

      hero.appendChild(spacer(10));
      hero.appendChild(btn);
      root.appendChild(hero);

      var row1 = document.createElement("div");
      row1.className = "row";
      row1.appendChild(widgetCard("Performance", "Score", perf.total ? (perf.score + "%") : "—"));
      row1.appendChild(widgetCard("Next Block", "Today’s Path", nextText));

      var row2 = document.createElement("div");
      row2.className = "row";
      row2.appendChild(widgetCard("Budget", "Remaining", budgetText));
      row2.appendChild(widgetCard("Gatekeeper", "72h Lock", gateText));

      root.appendChild(row1);
      root.appendChild(row2);

      var qa = document.createElement("div");
      qa.className = "glass card";
      qa.appendChild(textLine("Quick Actions", "Maintenance + Alignment are live"));
      qa.appendChild(spacer(10));

      var b1 = document.createElement("button");
      b1.className = "btnGhost";
      b1.type = "button";
      b1.textContent = "Open Maintenance";
      b1.onclick = function () { Router.go("maintenance"); };

      var b2 = document.createElement("button");
      b2.className = "btnGhost";
      b2.type = "button";
      b2.textContent = "Open Alignment";
      b2.style.marginLeft = "10px";
      b2.onclick = function () { Router.go("alignment", { mode: "morning" }); };

      qa.appendChild(b1);
      qa.appendChild(b2);

      root.appendChild(qa);

      container.appendChild(root);
    }

    async function alignment(container, params) {
      var mode = (params && params.get("mode")) ? params.get("mode") : "morning";
      if (mode !== "morning" && mode !== "evening" && mode !== "vault" && mode !== "choose") mode = "morning";

      var root = sectionTitle("Alignment", "Morning Flow, Evening Flow, and Vault (read-only).");

      var seg = segmented(
        mode === "choose" ? "morning" : mode,
        [
          { key: "morning", label: "Morning" },
          { key: "evening", label: "Evening" },
          { key: "vault", label: "Vault" }
        ],
        function (k) { Router.go("alignment", { mode: k }); }
      );

      root.appendChild(seg.el);

      var content = document.createElement("div");
      content.className = "stack";
      root.appendChild(content);

      if (mode === "choose") renderChoose(content);
      else if (mode === "morning") await renderMorning(content);
      else if (mode === "evening") await renderEvening(content);
      else if (mode === "vault") await renderVault(content, params);

      container.appendChild(root);
    }

    function renderChoose(container) {
      var card = document.createElement("div");
      card.className = "glass card";
      var p = document.createElement("div");
      p.className = "p";
      p.textContent = "Choose your journaling flow for today.";
      card.appendChild(p);
      card.appendChild(spacer(12));

      var b1 = document.createElement("button");
      b1.className = "btnGhost";
      b1.type = "button";
      b1.textContent = "Start Morning Flow";
      b1.onclick = function () { Router.go("alignment", { mode: "morning" }); };

      var b2 = document.createElement("button");
      b2.className = "btnGhost";
      b2.type = "button";
      b2.textContent = "Start Evening Flow";
      b2.style.marginLeft = "10px";
      b2.onclick = function () { Router.go("alignment", { mode: "evening" }); };

      card.appendChild(b1);
      card.appendChild(b2);
      container.appendChild(card);
    }

    async function renderMorning(container) {
      var card = document.createElement("div");
      card.className = "glass card";
      card.appendChild(textLine("Morning Flow", "Today"));
      card.appendChild(spacer(10));

      await State.loadTodayJournal();
      var m = State.s.morning;

      var focus = labeledTextarea("Primary Focus", m.focus, "What matters most today?");
      var gratitude = labeledTextarea("Gratitude", m.gratitude, "Write 3 things you’re grateful for.");
      var intention = labeledTextarea("Intention", m.intention, "Who do you choose to be today?");

      card.appendChild(focus.wrap);
      card.appendChild(gratitude.wrap);
      card.appendChild(intention.wrap);
      card.appendChild(spacer(12));

      var save = document.createElement("button");
      save.className = "btnPrimary";
      save.type = "button";
      save.textContent = "Save Morning";
      save.onclick = async function () {
        try {
          await State.saveMorning({
            focus: focus.textarea.value.trim(),
            gratitude: gratitude.textarea.value.trim(),
            intention: intention.textarea.value.trim()
          });
          toast("Morning saved.");
        } catch (e) {
          toast("Save failed.");
        }
      };

      card.appendChild(save);
      container.appendChild(card);
    }

    async function renderEvening(container) {
      var card = document.createElement("div");
      card.className = "glass card";
      card.appendChild(textLine("Evening Flow", "Today"));
      card.appendChild(spacer(10));

      await State.loadTodayJournal();
      var e = State.s.evening;

      var wins = labeledTextarea("Wins", e.wins, "What went well today?");
      var lessons = labeledTextarea("Lessons", e.lessons, "What did you learn today?");

      var q1 = labeledTextarea("Master Question 1", e.master1,
        "Did I act as my best self — disciplined, honest, and courageous — especially when it was hard?");
      var q2 = labeledTextarea("Master Question 2", e.master2,
        "Did I invest my time and attention into assets (skills, health, relationships), or did I drift into liabilities (distraction, impulse, comfort)?");
      var q3 = labeledTextarea("Master Question 3", e.master3,
        "What did I do today that increases my freedom and future options — and what must I stop doing?");
      var q4 = labeledTextarea("Master Question 4", e.master4,
        "If today repeated for 100 days, would my life improve or decay — and what is the one change I commit to tomorrow?");

      card.appendChild(wins.wrap);
      card.appendChild(lessons.wrap);
      card.appendChild(q1.wrap);
      card.appendChild(q2.wrap);
      card.appendChild(q3.wrap);
      card.appendChild(q4.wrap);

      card.appendChild(spacer(12));

      var row = document.createElement("div");
      row.className = "row";

      var save = document.createElement("button");
      save.className = "btnPrimary";
      save.type = "button";
      save.textContent = "Save Evening";
      save.onclick = async function () {
        try {
          await State.saveEvening({
            wins: wins.textarea.value.trim(),
            lessons: lessons.textarea.value.trim(),
            master1: q1.textarea.value.trim(),
            master2: q2.textarea.value.trim(),
            master3: q3.textarea.value.trim(),
            master4: q4.textarea.value.trim()
          });
          toast("Evening saved.");
        } catch (e) { toast("Save failed."); }
      };

      var close = document.createElement("button");
      close.className = "btnGhost";
      close.type = "button";
      close.textContent = "Close Day to Vault";
      close.onclick = async function () {
        try {
          await State.saveEvening({
            wins: wins.textarea.value.trim(),
            lessons: lessons.textarea.value.trim(),
            master1: q1.textarea.value.trim(),
            master2: q2.textarea.value.trim(),
            master3: q3.textarea.value.trim(),
            master4: q4.textarea.value.trim()
          });

          var res = await State.closeDayToVault();
          if (!res.ok && res.reason === "already_closed") {
            toast("Vault is immutable. Today is already closed.");
            return;
          }
          toast("Day closed to Vault.");
          Router.go("alignment", { mode: "vault" });
        } catch (e) { toast("Close failed."); }
      };

      row.appendChild(save);
      row.appendChild(close);

      container.appendChild(card);
      container.appendChild(row);
    }

    async function renderVault(container, params) {
      var selectedDay = params ? params.get("day") : null;

      var card = document.createElement("div");
      card.className = "glass card";
      card.appendChild(textLine("Vault", "Read-only archive"));
      card.appendChild(spacer(10));

      await State.loadVaultList();
      var list = State.s.vaultList || [];

      if (selectedDay) {
        var detail = await State.loadVaultDetail(selectedDay);
        if (!detail) {
          var p = document.createElement("div");
          p.className = "p";
          p.textContent = "Snapshot not found.";
          card.appendChild(p);
        } else {
          var meta = document.createElement("div");
          meta.className = "p";
          meta.textContent = "Snapshot: " + detail.dayKey;
          card.appendChild(meta);
          card.appendChild(spacer(10));

          var snap = detail.snapshot || {};
          var jm = (snap.journal && snap.journal.morning) ? snap.journal.morning : null;
          var je = (snap.journal && snap.journal.evening) ? snap.journal.evening : null;
          var mt = snap.maintenance || null;

          card.appendChild(renderReadOnlyBlock("Morning", jm));
          card.appendChild(spacer(10));
          card.appendChild(renderReadOnlyBlock("Evening", je));
          card.appendChild(spacer(10));
          card.appendChild(renderMaintenanceSummary(mt));

          card.appendChild(spacer(12));
          var back = document.createElement("button");
          back.className = "btnGhost";
          back.type = "button";
          back.textContent = "Back to Vault List";
          back.onclick = function () { Router.go("alignment", { mode: "vault" }); };
          card.appendChild(back);
        }

        container.appendChild(card);
        return;
      }

      if (!list.length) {
        var p0 = document.createElement("div");
        p0.className = "p";
        p0.textContent = "No archived days yet. Use Evening Flow → Close Day to Vault.";
        card.appendChild(p0);
        container.appendChild(card);
        return;
      }

      var listEl = document.createElement("div");
      listEl.className = "list";

      for (var i = 0; i < list.length; i++) {
        (function (row) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");

          var k = document.createElement("div");
          k.className = "k";
          k.textContent = row.dayKey;

          var m = document.createElement("div");
          m.className = "m";
          try { m.textContent = new Date(row.closedAt).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" }); }
          catch (e) { m.textContent = "Closed"; }

          left.appendChild(k);
          left.appendChild(m);

          var che = document.createElement("div");
          che.style.opacity = ".55";
          che.style.fontWeight = "900";
          che.textContent = "›";

          it.appendChild(left);
          it.appendChild(che);

          it.onclick = function () { Router.go("alignment", { mode: "vault", day: row.dayKey }); };

          listEl.appendChild(it);
        })(list[i]);
      }

      card.appendChild(listEl);
      container.appendChild(card);
    }

    function renderMaintenanceSummary(mt) {
      var box = document.createElement("div");
      box.className = "glass card";
      box.style.boxShadow = "none";
      box.style.borderRadius = "18px";

      var t = document.createElement("div");
      t.style.fontWeight = "860";
      t.style.marginBottom = "8px";
      t.textContent = "Maintenance";
      box.appendChild(t);

      if (!mt) {
        var p = document.createElement("div");
        p.className = "p";
        p.textContent = "No maintenance snapshot.";
        box.appendChild(p);
        return box;
      }

      var pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = "Performance: " + mt.score + "% (" + mt.done + "/" + mt.total + ")";
      box.appendChild(pill);

      return box;
    }

    function renderReadOnlyBlock(title, obj) {
      var box = document.createElement("div");
      box.className = "glass card";
      box.style.boxShadow = "none";
      box.style.borderRadius = "18px";

      var t = document.createElement("div");
      t.style.fontWeight = "860";
      t.style.marginBottom = "8px";
      t.textContent = title;
      box.appendChild(t);

      if (!obj) {
        var p = document.createElement("div");
        p.className = "p";
        p.textContent = "No entry.";
        box.appendChild(p);
        return box;
      }

      var pre = document.createElement("div");
      pre.className = "p";
      pre.style.whiteSpace = "pre-wrap";
      pre.textContent = formatObj(obj);
      box.appendChild(pre);
      return box;
    }

    function formatObj(obj) {
      var lines = [];
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = obj[k];
        if (v === null || typeof v === "undefined") continue;
        if (String(v).trim() === "") continue;
        lines.push(k + ": " + v);
      }
      return lines.length ? lines.join("\n\n") : "No content.";
    }

    async function maintenance(container) {
      await State.loadMaintenance();
      var root = sectionTitle("Maintenance", "Habits and Daily Tasks. Check them off — this feeds your Performance score.");

      // Score card
      var perf = State.s.perf;
      var scoreCard = document.createElement("div");
      scoreCard.className = "glass card";
      scoreCard.appendChild(textLine("Performance", "Today"));
      scoreCard.appendChild(spacer(10));
      var pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = perf.total ? (perf.score + "% (" + perf.done + "/" + perf.total + ")") : "No active items yet";
      scoreCard.appendChild(pill);
      root.appendChild(scoreCard);

      // Add forms
      var addCard = document.createElement("div");
      addCard.className = "glass card";
      addCard.appendChild(textLine("Add Items", "Create your system"));

      var habitName = labeledInput("New Habit", "", "e.g., Mobility (10 min)");
      var addHabitBtn = document.createElement("button");
      addHabitBtn.className = "btnGhost";
      addHabitBtn.type = "button";
      addHabitBtn.textContent = "Add Habit";
      addHabitBtn.onclick = async function () {
        try {
          await State.addHabit(habitName.input.value);
          habitName.input.value = "";
          toast("Habit added.");
          Router.go("maintenance");
        } catch (e) { toast("Habit name required."); }
      };

      addCard.appendChild(habitName.wrap);
      addCard.appendChild(addHabitBtn);
      addCard.appendChild(document.createElement("hr")).className = "hr";

      var taskName = labeledInput("New Daily Task", "", "e.g., Admin (15 min)");
      var taskCat = labeledInput("Category", "General", "e.g., Mobility / Admin / Home");
      var addTaskBtn = document.createElement("button");
      addTaskBtn.className = "btnGhost";
      addTaskBtn.type = "button";
      addTaskBtn.textContent = "Add Task";
      addTaskBtn.onclick = async function () {
        try {
          await State.addTask(taskName.input.value, taskCat.input.value);
          taskName.input.value = "";
          toast("Task added.");
          Router.go("maintenance");
        } catch (e) { toast("Task name required."); }
      };

      addCard.appendChild(taskName.wrap);
      addCard.appendChild(taskCat.wrap);
      addCard.appendChild(addTaskBtn);

      root.appendChild(addCard);

      // Active list
      var listCard = document.createElement("div");
      listCard.className = "glass card";
      listCard.appendChild(textLine("Today Checklist", "Tap to toggle"));

      var listWrap = document.createElement("div");
      listWrap.className = "stack";
      listWrap.appendChild(spacer(6));

      var habits = State.s.habits.filter(function (h) { return !!h.active; });
      var tasks = State.s.tasks.filter(function (t) { return !!t.active; });

      if (!habits.length && !tasks.length) {
        var p0 = document.createElement("div");
        p0.className = "p";
        p0.textContent = "Add at least one Habit or Task to start tracking Performance.";
        listCard.appendChild(p0);
      } else {
        for (var i = 0; i < habits.length; i++) {
          listWrap.appendChild(makeCheckRow("habit", habits[i].id, habits[i].name, "Habit"));
        }
        for (var j = 0; j < tasks.length; j++) {
          listWrap.appendChild(makeCheckRow("task", tasks[j].id, tasks[j].name, (tasks[j].category || "Task")));
        }
        listCard.appendChild(listWrap);
      }

      root.appendChild(listCard);

      // Manage actives
      var manage = document.createElement("div");
      manage.className = "glass card";
      manage.appendChild(textLine("Manage Items", "Deactivate without deleting"));
      manage.appendChild(spacer(6));

      var manageList = document.createElement("div");
      manageList.className = "stack";

      var allHabits = State.s.habits;
      var allTasks = State.s.tasks;

      if (!allHabits.length && !allTasks.length) {
        var p1 = document.createElement("div");
        p1.className = "p";
        p1.textContent = "Nothing to manage yet.";
        manage.appendChild(p1);
      } else {
        for (var a = 0; a < allHabits.length; a++) {
          manageList.appendChild(makeActiveRow("habit", allHabits[a].id, allHabits[a].name, !!allHabits[a].active));
        }
        for (var b = 0; b < allTasks.length; b++) {
          manageList.appendChild(makeActiveRow("task", allTasks[b].id, allTasks[b].name + " (" + (allTasks[b].category || "General") + ")", !!allTasks[b].active));
        }
        manage.appendChild(manageList);
      }

      root.appendChild(manage);

      container.appendChild(root);

      function makeCheckRow(kind, id, name, meta) {
        var on = State.isTargetChecked(kind, id);

        var row = document.createElement("div");
        row.className = "checkrow";

        var left = document.createElement("div");
        left.className = "checkrow__left";

        var n = document.createElement("div");
        n.className = "checkrow__name";
        n.textContent = name;

        var m = document.createElement("div");
        m.className = "checkrow__meta";
        m.textContent = meta;

        left.appendChild(n);
        left.appendChild(m);

        var btn = document.createElement("button");
        btn.className = "checkrow__btn" + (on ? " is-on" : "");
        btn.type = "button";
        btn.textContent = on ? "✓" : "○";
        btn.setAttribute("aria-pressed", on ? "true" : "false");

        btn.onclick = async function () {
          try {
            var next = !State.isTargetChecked(kind, id);
            await State.toggleCheck(kind, id, next);
            toast(next ? "Checked." : "Unchecked.");
            Router.go("maintenance");
          } catch (e) {
            toast("Update failed.");
          }
        };

        row.appendChild(left);
        row.appendChild(btn);
        return row;
      }

      function makeActiveRow(kind, id, label, active) {
        var row = document.createElement("div");
        row.className = "checkrow";

        var left = document.createElement("div");
        left.className = "checkrow__left";

        var n = document.createElement("div");
        n.className = "checkrow__name";
        n.textContent = label;

        var m = document.createElement("div");
        m.className = "checkrow__meta";
        m.textContent = active ? "Active" : "Inactive";

        left.appendChild(n);
        left.appendChild(m);

        var btn = document.createElement("button");
        btn.className = "checkrow__btn" + (active ? " is-on" : "");
        btn.type = "button";
        btn.textContent = active ? "On" : "Off";
        btn.onclick = async function () {
          try {
            if (kind === "habit") await State.setHabitActive(id, !active);
            else await State.setTaskActive(id, !active);
            toast("Updated.");
            Router.go("maintenance");
          } catch (e) { toast("Update failed."); }
        };

        row.appendChild(left);
        row.appendChild(btn);
        return row;
      }
    }

    async function path(container) {
      var root = sectionTitle("Today’s Path", "Plan your day in time blocks. Load a template to start fast.");
      var today = State.s.today;
      var blocks = await DB.listBlocksByDay(today);

      // Today's blocks
      var listCard = document.createElement("div");
      listCard.className = "glass card";
      listCard.appendChild(textLine("Today’s Blocks", blocks.length ? (blocks.length + " scheduled") : "Empty"));
      listCard.appendChild(spacer(10));

      if (!blocks.length) {
        var p0 = document.createElement("div");
        p0.className = "p";
        p0.textContent = "No time blocks yet. Add one below or load a template.";
        listCard.appendChild(p0);
      } else {
        var list = document.createElement("div");
        list.className = "list";
        blocks.forEach(function (b) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");
          var k = document.createElement("div");
          k.className = "k";
          k.textContent = b.title;
          var m = document.createElement("div");
          m.className = "m";
          m.textContent = (b.start || "—") + (b.end ? (" – " + b.end) : "");
          left.appendChild(k);
          left.appendChild(m);
          var del = document.createElement("button");
          del.className = "btnGhost";
          del.type = "button";
          del.textContent = "Remove";
          del.onclick = async function () {
            await DB.deleteBlock(b.id);
            toast("Block removed.");
            Router.render();
          };
          it.appendChild(left);
          it.appendChild(del);
          list.appendChild(it);
        });
        listCard.appendChild(list);
      }
      root.appendChild(listCard);

      // Add block
      var addCard = document.createElement("div");
      addCard.className = "glass card";
      addCard.appendChild(textLine("Add Block", "Time-boxed focus"));
      var titleI = makeInput("text", "", "e.g., Deep Work");
      var startI = makeInput("time", "09:00");
      var endI = makeInput("time", "10:00");
      addCard.appendChild(fieldWrap("Title", titleI));
      var timeRow = document.createElement("div");
      timeRow.className = "row";
      timeRow.appendChild(fieldWrap("Start", startI));
      timeRow.appendChild(fieldWrap("End", endI));
      addCard.appendChild(timeRow);
      addCard.appendChild(spacer(12));
      var addBtn = document.createElement("button");
      addBtn.className = "btnPrimary";
      addBtn.type = "button";
      addBtn.textContent = "Add Block";
      addBtn.onclick = async function () {
        try {
          await DB.addBlock(today, startI.value, endI.value, titleI.value);
          toast("Block added.");
          Router.render();
        } catch (e) { toast(e && e.message ? e.message : "Add failed."); }
      };
      addCard.appendChild(addBtn);
      root.appendChild(addCard);

      // Templates
      var tplCard = document.createElement("div");
      tplCard.className = "glass card";
      tplCard.appendChild(textLine("Templates", "One-tap day plans"));
      tplCard.appendChild(spacer(10));

      var templates = await DB.listTemplates();
      if (!templates.length) {
        var pt = document.createElement("div");
        pt.className = "p";
        pt.textContent = "No templates yet. Create the sample Workday, or save today’s blocks below.";
        tplCard.appendChild(pt);
        tplCard.appendChild(spacer(10));
        var seed = document.createElement("button");
        seed.className = "btnGhost";
        seed.type = "button";
        seed.textContent = "Create ‘Workday’ template";
        seed.onclick = async function () {
          await DB.addTemplate("Workday", [
            { start: "07:00", end: "08:00", title: "Morning Routine" },
            { start: "09:00", end: "12:00", title: "Deep Work" },
            { start: "12:00", end: "13:00", title: "Lunch" },
            { start: "13:00", end: "17:00", title: "Focused Tasks" },
            { start: "18:00", end: "19:00", title: "Training" }
          ]);
          toast("Workday template created.");
          Router.render();
        };
        tplCard.appendChild(seed);
      } else {
        var tlist = document.createElement("div");
        tlist.className = "list";
        templates.forEach(function (t) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");
          var k = document.createElement("div");
          k.className = "k";
          k.textContent = t.name;
          var m = document.createElement("div");
          m.className = "m";
          m.textContent = (t.blocks ? t.blocks.length : 0) + " blocks";
          left.appendChild(k);
          left.appendChild(m);
          var actions = document.createElement("div");
          var load = document.createElement("button");
          load.className = "btnGhost";
          load.type = "button";
          load.textContent = "Load";
          load.onclick = async function () {
            var n = await DB.applyTemplateToDay(t.id, today);
            toast("Loaded " + n + " blocks.");
            Router.render();
          };
          var del = document.createElement("button");
          del.className = "btnGhost";
          del.type = "button";
          del.textContent = "Delete";
          del.style.marginLeft = "8px";
          del.onclick = async function () {
            await DB.deleteTemplate(t.id);
            toast("Template deleted.");
            Router.render();
          };
          actions.appendChild(load);
          actions.appendChild(del);
          it.appendChild(left);
          it.appendChild(actions);
          tlist.appendChild(it);
        });
        tplCard.appendChild(tlist);
      }

      if (blocks.length) {
        tplCard.appendChild(spacer(12));
        var hrt = document.createElement("hr");
        hrt.className = "hr";
        tplCard.appendChild(hrt);
        var nameI = makeInput("text", "", "Template name (e.g., Workday)");
        tplCard.appendChild(fieldWrap("Save today as template", nameI));
        tplCard.appendChild(spacer(10));
        var saveTpl = document.createElement("button");
        saveTpl.className = "btnGhost";
        saveTpl.type = "button";
        saveTpl.textContent = "Save Template";
        saveTpl.onclick = async function () {
          try {
            var tb = blocks.map(function (b) { return { start: b.start, end: b.end, title: b.title }; });
            await DB.addTemplate(nameI.value, tb);
            toast("Template saved.");
            Router.render();
          } catch (e) { toast(e && e.message ? e.message : "Save failed."); }
        };
        tplCard.appendChild(saveTpl);
      }
      root.appendChild(tplCard);

      container.appendChild(root);
    }

    async function finance(container) {
      var root = sectionTitle("Finance", "Monthly budget, recurring costs, spending breakdown, and the 72h Gatekeeper.");
      var month = State.s.month;
      var budget = await DB.getBudget(month);
      var txns = await DB.listTransactionsByMonth(month);
      var recurringItems = await DB.listRecurring();
      var oneOffSpent = await DB.sumTransactionsForMonth(month);
      var recurringSpent = await DB.sumRecurring();
      var spent = oneOffSpent + recurringSpent;
      var remaining = budget - spent;

      // Overview
      var overview = document.createElement("div");
      overview.className = "glass card card--strong";
      overview.appendChild(textLine("Budget", month));
      overview.appendChild(spacer(10));
      var pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = budget > 0
        ? ("Remaining: " + formatMoney(remaining) + " / " + formatMoney(budget))
        : "No budget set";
      overview.appendChild(pill);
      overview.appendChild(spacer(10));
      var sub = document.createElement("div");
      sub.className = "p";
      sub.textContent = "Spent this month: " + formatMoney(spent)
        + " (recurring " + formatMoney(recurringSpent) + ")";
      overview.appendChild(sub);
      root.appendChild(overview);

      // Spending breakdown (pie chart)
      var slices = buildExpenseSlices(txns, recurringItems);
      var chartCard = document.createElement("div");
      chartCard.className = "glass card";
      chartCard.appendChild(textLine("Spending Breakdown", month));
      chartCard.appendChild(spacer(12));
      if (!slices.length) {
        var cp = document.createElement("div");
        cp.className = "p";
        cp.textContent = "Add an expense or a recurring cost to see your breakdown.";
        chartCard.appendChild(cp);
      } else {
        chartCard.appendChild(pieChart(slices));
      }
      root.appendChild(chartCard);

      // Set budget
      var budgetCard = document.createElement("div");
      budgetCard.className = "glass card";
      budgetCard.appendChild(textLine("Set Monthly Budget", "Applies to " + month));
      var budgetI = makeInput("number", budget > 0 ? String(budget) : "", "e.g., 1500", { min: "0", step: "1" });
      budgetCard.appendChild(fieldWrap("Amount (€)", budgetI));
      budgetCard.appendChild(spacer(12));
      var saveB = document.createElement("button");
      saveB.className = "btnPrimary";
      saveB.type = "button";
      saveB.textContent = "Save Budget";
      saveB.onclick = async function () {
        await DB.setBudget(month, budgetI.value);
        toast("Budget saved.");
        Router.render();
      };
      budgetCard.appendChild(saveB);
      root.appendChild(budgetCard);

      // Expenses
      var expCard = document.createElement("div");
      expCard.className = "glass card";
      expCard.appendChild(textLine("Add Expense", "Track your spending"));
      var amtI = makeInput("number", "", "0.00", { min: "0", step: "0.01" });
      var noteI = makeInput("text", "", "e.g., Groceries");
      expCard.appendChild(fieldWrap("Amount (€)", amtI));
      expCard.appendChild(fieldWrap("Note", noteI));
      expCard.appendChild(spacer(12));
      var addE = document.createElement("button");
      addE.className = "btnGhost";
      addE.type = "button";
      addE.textContent = "Add Expense";
      addE.onclick = async function () {
        try {
          await DB.addTransaction(month, amtI.value, noteI.value);
          toast("Expense added.");
          Router.render();
        } catch (e) { toast(e && e.message ? e.message : "Add failed."); }
      };
      expCard.appendChild(addE);

      if (txns.length) {
        expCard.appendChild(spacer(12));
        var hrx = document.createElement("hr");
        hrx.className = "hr";
        expCard.appendChild(hrx);
        var tl = document.createElement("div");
        tl.className = "list";
        txns.forEach(function (t) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");
          var k = document.createElement("div");
          k.className = "k";
          k.textContent = formatMoney(t.amount);
          var m = document.createElement("div");
          m.className = "m";
          m.textContent = t.note || "—";
          left.appendChild(k);
          left.appendChild(m);
          var del = document.createElement("button");
          del.className = "btnGhost";
          del.type = "button";
          del.textContent = "Delete";
          del.onclick = async function () {
            await DB.deleteTransaction(t.id);
            toast("Expense removed.");
            Router.render();
          };
          it.appendChild(left);
          it.appendChild(del);
          tl.appendChild(it);
        });
        expCard.appendChild(tl);
      }
      root.appendChild(expCard);

      // Recurring monthly expenses
      var recCard = document.createElement("div");
      recCard.className = "glass card";
      recCard.appendChild(textLine("Recurring Expenses", "Charged every month"));
      recCard.appendChild(spacer(8));
      var recInfo = document.createElement("div");
      recInfo.className = "p";
      recInfo.textContent = "Fixed monthly costs (rent, subscriptions…) count automatically toward every month’s budget.";
      recCard.appendChild(recInfo);
      recCard.appendChild(spacer(10));
      var recName = makeInput("text", "", "e.g., Rent");
      var recAmt = makeInput("number", "", "0.00", { min: "0", step: "0.01" });
      recCard.appendChild(fieldWrap("Name", recName));
      recCard.appendChild(fieldWrap("Amount (€) / month", recAmt));
      recCard.appendChild(spacer(12));
      var addR = document.createElement("button");
      addR.className = "btnGhost";
      addR.type = "button";
      addR.textContent = "Add Recurring";
      addR.onclick = async function () {
        try {
          await DB.addRecurring(recName.value, recAmt.value);
          toast("Recurring expense added.");
          Router.render();
        } catch (e) { toast(e && e.message ? e.message : "Add failed."); }
      };
      recCard.appendChild(addR);

      if (recurringItems.length) {
        recCard.appendChild(spacer(12));
        var hrr = document.createElement("hr");
        hrr.className = "hr";
        recCard.appendChild(hrr);
        var rl = document.createElement("div");
        rl.className = "list";
        recurringItems.forEach(function (rc) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");
          var k = document.createElement("div");
          k.className = "k";
          k.textContent = formatMoney(rc.amount) + " / month";
          var m = document.createElement("div");
          m.className = "m";
          m.textContent = rc.name;
          left.appendChild(k);
          left.appendChild(m);
          var del = document.createElement("button");
          del.className = "btnGhost";
          del.type = "button";
          del.textContent = "Delete";
          del.onclick = async function () {
            await DB.deleteRecurring(rc.id);
            toast("Recurring expense removed.");
            Router.render();
          };
          it.appendChild(left);
          it.appendChild(del);
          rl.appendChild(it);
        });
        recCard.appendChild(rl);
      }
      root.appendChild(recCard);

      // Gatekeeper
      var gateCard = document.createElement("div");
      gateCard.className = "glass card";
      gateCard.appendChild(textLine("72h Gatekeeper", "Beat impulse purchases"));
      gateCard.appendChild(spacer(8));
      var gp = document.createElement("div");
      gp.className = "p";
      gp.textContent = "Add something you want to buy. It stays locked for 72 hours before you can approve it.";
      gateCard.appendChild(gp);
      gateCard.appendChild(spacer(10));
      var gItem = makeInput("text", "", "e.g., New headphones");
      var gAmt = makeInput("number", "", "0.00", { min: "0", step: "0.01" });
      gateCard.appendChild(fieldWrap("Item", gItem));
      gateCard.appendChild(fieldWrap("Amount (€)", gAmt));
      gateCard.appendChild(spacer(12));
      var addG = document.createElement("button");
      addG.className = "btnGhost";
      addG.type = "button";
      addG.textContent = "Lock for 72h";
      addG.onclick = async function () {
        try {
          await DB.addGate(gItem.value, gAmt.value, 72);
          toast("Locked for 72 hours.");
          Router.render();
        } catch (e) { toast(e && e.message ? e.message : "Add failed."); }
      };
      gateCard.appendChild(addG);

      var gates = await DB.listGates();
      if (gates.length) {
        gateCard.appendChild(spacer(12));
        var hrg = document.createElement("hr");
        hrg.className = "hr";
        gateCard.appendChild(hrg);
        var gl = document.createElement("div");
        gl.className = "list";
        gates.forEach(function (g) {
          var it = document.createElement("div");
          it.className = "checkrow";
          var left = document.createElement("div");
          left.className = "checkrow__left";
          var n = document.createElement("div");
          n.className = "checkrow__name";
          n.textContent = g.item + " · " + formatMoney(g.amount);
          var meta = document.createElement("div");
          meta.className = "checkrow__meta";
          var right = document.createElement("div");
          var now = Date.now();

          if (now >= g.unlockAt) {
            meta.textContent = "Unlocked — decide now";
            var ok = document.createElement("button");
            ok.className = "btnGhost";
            ok.type = "button";
            ok.textContent = "Approve";
            ok.onclick = async function () {
              await DB.addTransaction(month, g.amount, "Gatekeeper: " + g.item);
              await DB.deleteGate(g.id);
              toast("Approved & logged as expense.");
              Router.render();
            };
            var no = document.createElement("button");
            no.className = "btnGhost";
            no.type = "button";
            no.textContent = "Let it go";
            no.style.marginLeft = "8px";
            no.onclick = async function () {
              await DB.deleteGate(g.id);
              toast("Released. Money saved.");
              Router.render();
            };
            right.appendChild(ok);
            right.appendChild(no);
          } else {
            var cd = document.createElement("span");
            cd.setAttribute("data-unlock", String(g.unlockAt));
            cd.textContent = formatCountdown(g.unlockAt - now);
            meta.appendChild(document.createTextNode("Unlocks in "));
            meta.appendChild(cd);
            var cancel = document.createElement("button");
            cancel.className = "btnGhost";
            cancel.type = "button";
            cancel.textContent = "Cancel";
            cancel.onclick = async function () {
              await DB.deleteGate(g.id);
              toast("Cancelled.");
              Router.render();
            };
            right.appendChild(cancel);
          }

          left.appendChild(n);
          left.appendChild(meta);
          it.appendChild(left);
          it.appendChild(right);
          gl.appendChild(it);
        });
        gateCard.appendChild(gl);

        // Live countdown ticker (cleared on navigation via Timers)
        Timers.add(setInterval(function () {
          var els = gateCard.querySelectorAll("[data-unlock]");
          var now2 = Date.now();
          var needsRefresh = false;
          for (var i = 0; i < els.length; i++) {
            var u = Number(els[i].getAttribute("data-unlock"));
            var diff = u - now2;
            if (diff <= 0) { needsRefresh = true; }
            else { els[i].textContent = formatCountdown(diff); }
          }
          if (needsRefresh) Router.render();
        }, 1000));
      }
      root.appendChild(gateCard);

      container.appendChild(root);
    }

    async function settings(container) {
      var root = sectionTitle("Settings", "Back up, restore, and reset your PERSONAL OS.");

      // Export
      var expCard = document.createElement("div");
      expCard.className = "glass card";
      expCard.appendChild(textLine("Export Data", "Download a JSON backup"));
      expCard.appendChild(spacer(8));
      var ep = document.createElement("div");
      ep.className = "p";
      ep.textContent = "Save all your journals, habits, tasks, blocks, finances, and locks to a file.";
      expCard.appendChild(ep);
      expCard.appendChild(spacer(12));
      var expBtn = document.createElement("button");
      expBtn.className = "btnPrimary";
      expBtn.type = "button";
      expBtn.textContent = "Export Backup";
      expBtn.onclick = async function () {
        try {
          var data = await DB.exportAll();
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "personal-os-backup-" + State.s.today + ".json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          toast("Backup exported.");
        } catch (e) { toast("Export failed."); }
      };
      expCard.appendChild(expBtn);
      root.appendChild(expCard);

      // Import
      var impCard = document.createElement("div");
      impCard.className = "glass card";
      impCard.appendChild(textLine("Import Data", "Restore from a backup file"));
      impCard.appendChild(spacer(12));
      var fileI = document.createElement("input");
      fileI.type = "file";
      fileI.accept = "application/json,.json";
      fileI.className = "input";
      impCard.appendChild(fieldWrap("Backup file", fileI));
      impCard.appendChild(spacer(12));
      var impBtn = document.createElement("button");
      impBtn.className = "btnGhost";
      impBtn.type = "button";
      impBtn.textContent = "Import & Merge";
      impBtn.onclick = function () {
        var f = fileI.files && fileI.files[0];
        if (!f) { toast("Choose a file first."); return; }
        var reader = new FileReader();
        reader.onload = async function () {
          try {
            var data = JSON.parse(reader.result);
            var n = await DB.importAll(data);
            toast("Imported " + n + " records.");
            Router.render();
          } catch (e) { toast(e && e.message ? e.message : "Invalid backup file."); }
        };
        reader.onerror = function () { toast("Could not read file."); };
        reader.readAsText(f);
      };
      impCard.appendChild(impBtn);
      root.appendChild(impCard);

      // Danger zone: reset
      var resetCard = document.createElement("div");
      resetCard.className = "glass card";
      resetCard.appendChild(textLine("Danger Zone", "Erase all data"));
      resetCard.appendChild(spacer(8));
      var rp = document.createElement("div");
      rp.className = "p";
      rp.textContent = "This permanently deletes everything on this device. Export a backup first.";
      resetCard.appendChild(rp);
      resetCard.appendChild(spacer(12));
      var confI = makeInput("text", "", "Type RESET to confirm");
      resetCard.appendChild(fieldWrap("Confirmation", confI));
      resetCard.appendChild(spacer(12));
      var resetBtn = document.createElement("button");
      resetBtn.className = "btnGhost";
      resetBtn.type = "button";
      resetBtn.textContent = "Reset PERSONAL OS";
      resetBtn.onclick = async function () {
        if ((confI.value || "").trim().toUpperCase() !== "RESET") {
          toast("Type RESET to confirm.");
          return;
        }
        try {
          await DB.clearAllData();
          toast("All data cleared.");
          Router.go("dashboard");
        } catch (e) { toast("Reset failed."); }
      };
      resetCard.appendChild(resetBtn);
      root.appendChild(resetCard);

      // About
      var infoCard = document.createElement("div");
      infoCard.className = "glass card";
      infoCard.appendChild(textLine("About", "PERSONAL OS"));
      infoCard.appendChild(spacer(8));
      var v = document.createElement("div");
      v.className = "p";
      v.textContent = "Version " + APP_VERSION + " · The Architecture of Excellence.";
      infoCard.appendChild(v);
      root.appendChild(infoCard);

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
    if (hasNoSwFlag()) return;
    try { await navigator.serviceWorker.register("./sw.js?v=" + encodeURIComponent(APP_VERSION), { scope: "./" }); }
    catch (e) {}
  }

  // ---------- Boot ----------
  async function boot() {
    var d = new Date();
    var dateEl = $("today-date");
    if (dateEl) dateEl.textContent = formatNiceDate(d);

    var killed = await runKillSwitchIfNeeded();
    if (killed) return;

    try { await DB.open(); }
    catch (e) { toast("Storage unavailable. Avoid Private Mode on iOS Safari."); }

    var dashBtn = $("btn-dashboard");
    if (dashBtn) dashBtn.addEventListener("click", function () { Router.go("dashboard"); });

    var navBtns = document.querySelectorAll(".navbtn");
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].addEventListener("click", function (ev) {
        var r = ev.currentTarget.getAttribute("data-route");
        Router.go(r);
      });
    }

    Router.onChange(Router.render);

    if (!location.hash || location.hash === "#") Router.go("dashboard");
    else await Router.render();

    registerSW();
  }

  boot().catch(function (e) {
    var view = $("view");
    if (view) Screens.bootError(view, "Boot Error", String(e && e.message ? e.message : e));
  });
})();
