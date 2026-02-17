/* app.js — Batch 3
   Adds:
   - Maintenance tab: manage Habits + Daily Tasks and check them off for today
   - Performance score on Dashboard:
     score = completed_today / total_active_today  (0..100)
   - Journal/Vault from Batch 2 retained
*/

(function () {
  "use strict";

  var APP_VERSION = "1.0.2";

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

      setNavActive(current);

      var view = $("view");
      if (!view) return;

      try {
        view.innerHTML = "";
        if (current === "dashboard") await Screens.dashboard(view);
        else if (current === "alignment") await Screens.alignment(view, parsed.params);
        else if (current === "maintenance") await Screens.maintenance(view);
        else if (current === "path") Screens.path(view);
        else if (current === "finance") Screens.finance(view);
        else if (current === "settings") Screens.settings(view);
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
      row1.appendChild(widgetCard("Next Block", "Today’s Path", "No blocks yet"));

      var row2 = document.createElement("div");
      row2.className = "row";
      row2.appendChild(widgetCard("Budget", "Remaining", "—"));
      row2.appendChild(widgetCard("Gatekeeper", "72h Lock", "No active lock"));

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
      p.textContent = "Batch 5 builds monthly budget control and impulse-purchase barrier with countdown and unlock logic.";
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
