(function () {
  "use strict";

  ScreenRegistry.register("path", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Today’s Path" }, []);
      container.appendChild(title);

      var params = (ctx && ctx.params) ? ctx.params : {};
      var action = params.action || null;

      var selectedDate = params.date || UI.formatDateISO(new Date());
      var viewMode = params.view || "day"; // day|week

      // Header Controls
      var controls = UI.el("div", { className: "card tile" }, []);
      controls.appendChild(UI.el("div", { className: "tile__label", text: "Planner" }, []));

      var row = UI.el("div", { className: "row" }, []);
      var dateBtn = UI.el("button", { className: "btn", type: "button", text: "Date: " + selectedDate }, []);
      dateBtn.addEventListener("click", function () {
        UI.prompt("Select Date", "YYYY-MM-DD", selectedDate, "2026-02-16").then(function (v) {
          if (v === null) return;
          var t = v.trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) { UI.toast("Invalid date"); return; }
          Router.go("path", { date: t, view: viewMode });
        });
      });

      var toggleBtn = UI.el("button", { className: "btn", type: "button", text: "View: " + (viewMode === "week" ? "Week" : "Day") }, []);
      toggleBtn.addEventListener("click", function () {
        var nv = (viewMode === "week") ? "day" : "week";
        Router.go("path", { date: selectedDate, view: nv });
      });

      row.appendChild(dateBtn);
      row.appendChild(toggleBtn);
      controls.appendChild(UI.el("div", { style: "height:10px" }, []));
      controls.appendChild(row);

      var newBlockBtn = UI.el("button", { className: "btn", type: "button", text: "Create new Block" }, []);
      newBlockBtn.addEventListener("click", function () { createNewBlock(selectedDate, container); });

      controls.appendChild(UI.el("div", { style: "height:10px" }, []));
      controls.appendChild(newBlockBtn);

      container.appendChild(controls);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Calendar card
      var calCard = UI.el("div", { className: "card tile" }, []);
      calCard.appendChild(UI.el("div", { className: "tile__label", text: "Kalender (" + (viewMode === "week" ? "Week" : "Day") + ")" }, []));

      if (viewMode === "day") {
        await renderDay(calCard, selectedDate);
      } else {
        await renderWeek(calCard, selectedDate);
      }

      container.appendChild(calCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Templates
      var tplCard = UI.el("div", { className: "card tile" }, []);
      tplCard.appendChild(UI.el("div", { className: "tile__label", text: "Templates" }, []));

      var tplRow = UI.el("div", { className: "row" }, []);
      var createTplBtn = UI.el("button", { className: "btn", type: "button", text: "Create Template" }, []);
      createTplBtn.addEventListener("click", function () { createTemplateFlow(container); });
      var applyTplBtn = UI.el("button", { className: "btn", type: "button", text: "Apply Template to Date" }, []);
      applyTplBtn.addEventListener("click", function () { applyTemplateFlow(selectedDate); });

      tplRow.appendChild(createTplBtn);
      tplRow.appendChild(applyTplBtn);
      tplCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      tplCard.appendChild(tplRow);

      container.appendChild(tplCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // ToDos (from Morning Journal)
      var todoCard = UI.el("div", { className: "card tile" }, []);
      todoCard.appendChild(UI.el("div", { className: "tile__label", text: "ToDos (from Morning Journal)" }, []));
      await renderTodos(todoCard, selectedDate);
      container.appendChild(todoCard);

      // Action from Dashboard quick add
      if (action === "newBlock") {
        // open create flow
        await createNewBlock(selectedDate, container);
      }
    }
  });

  async function renderDay(card, dateISO) {
    var blocks = await State.listBlocksByDate(dateISO);

    if (!blocks.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No blocks." }, []));
      return;
    }

    blocks.forEach(function (b) {
      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text", text: (b.start || "—") + "-" + (b.end || "—") + " · " + (b.title || "Block") }, [])
      ]);
      left.addEventListener("click", function () { editBlockFlow(b); });

      var right = UI.el("div", { className: "todo-right" }, []);
      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function () {
        UI.confirm("Delete Block", "Delete this block?").then(function (ok) {
          if (!ok) return;
          State.deleteBlock(b.id).then(function () { UI.toast("Deleted"); Router.go("path", { date: dateISO, view: "day" }); });
        });
      });

      right.appendChild(del);
      row.appendChild(left);
      row.appendChild(right);
      card.appendChild(UI.el("div", { style: "height:10px" }, []));
      card.appendChild(row);
    });
  }

  async function renderWeek(card, dateISO) {
    // Compute Monday of that week
    var d = new Date(dateISO + "T00:00:00");
    var day = d.getDay(); // 0 Sun ... 1 Mon
    var delta = (day === 0) ? -6 : (1 - day);
    d.setDate(d.getDate() + delta);

    for (var i = 0; i < 7; i++) {
      var dd = new Date(d.getTime());
      dd.setDate(d.getDate() + i);
      var key = UI.formatDateISO(dd);
      var blocks = await State.listBlocksByDate(key);

      var line = key + " — " + (blocks.length ? (blocks.length + " blocks") : "no blocks");
      var btn = UI.el("button", { className: "btn", type: "button", text: line }, []);
      (function (k) {
        btn.addEventListener("click", function () {
          Router.go("path", { date: k, view: "day" });
        });
      })(key);

      card.appendChild(btn);
      card.appendChild(UI.el("div", { style: "height:8px" }, []));
    }
  }

  async function createNewBlock(dateISO, container) {
    var start = await UI.prompt("New Block", "Start (HH:MM)", "", "09:00");
    if (start === null) return;
    start = start.trim();
    if (UI.timeToMinutes(start) === null) { UI.toast("Invalid start time"); return; }

    var end = await UI.prompt("New Block", "End (HH:MM)", "", "10:00");
    if (end === null) return;
    end = end.trim();
    if (UI.timeToMinutes(end) === null) { UI.toast("Invalid end time"); return; }

    var title = await UI.prompt("New Block", "Title", "", "e.g. Work Deep Focus");
    if (title === null) return;

    await State.addBlock({ date: dateISO, start: start, end: end, title: (title || "").trim() });
    UI.toast("Block added");
    Router.go("path", { date: dateISO, view: "day" });
  }

  async function editBlockFlow(block) {
    var start = await UI.prompt("Edit Block", "Start (HH:MM)", block.start || "", "09:00");
    if (start === null) return;
    start = start.trim();
    if (UI.timeToMinutes(start) === null) { UI.toast("Invalid time"); return; }

    var end = await UI.prompt("Edit Block", "End (HH:MM)", block.end || "", "10:00");
    if (end === null) return;
    end = end.trim();
    if (UI.timeToMinutes(end) === null) { UI.toast("Invalid time"); return; }

    var title = await UI.prompt("Edit Block", "Title", block.title || "", "");
    if (title === null) return;

    block.start = start;
    block.end = end;
    block.title = (title || "").trim();

    await State.updateBlock(block);
    UI.toast("Saved");
    Router.go("path", { date: block.date, view: "day" });
  }

  async function createTemplateFlow(container) {
    var name = await UI.prompt("Create Template", "Template name", "", "e.g. Weekday + Sport");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    // Build blocks interactively
    var blocks = [];
    while (true) {
      var addMore = await UI.confirm("Add Block", "Add a block to this template?");
      if (!addMore) break;

      var start = await UI.prompt("Template Block", "Start (HH:MM)", "", "09:00");
      if (start === null) break;
      start = start.trim();
      if (UI.timeToMinutes(start) === null) { UI.toast("Invalid time"); continue; }

      var end = await UI.prompt("Template Block", "End (HH:MM)", "", "10:00");
      if (end === null) break;
      end = end.trim();
      if (UI.timeToMinutes(end) === null) { UI.toast("Invalid time"); continue; }

      var title = await UI.prompt("Template Block", "Title", "", "e.g. Work");
      if (title === null) break;

      blocks.push({ start: start, end: end, title: (title || "").trim() });
    }

    await State.createTemplate(name, blocks);
    UI.toast("Template created");
    Router.go("path", { date: UI.formatDateISO(new Date()), view: "day" });
  }

  async function applyTemplateFlow(dateISO) {
    var tpls = await State.listTemplates();
    if (!tpls.length) { UI.toast("No templates"); return; }

    var html = "<div class='ui-text'>Choose template:</div>";
    tpls.forEach(function (t) {
      html += "<div class='ui-text'>• " + UI.escapeHtml(t.name) + " (id " + t.id + ")</div>";
    });
    html += "<div class='ui-text'>Enter template id:</div>";

    var idStr = await UI.prompt("Apply Template", "Template id", "", "e.g. 1");
    if (idStr === null) return;
    var id = Number(idStr);
    if (isNaN(id)) { UI.toast("Invalid id"); return; }

    await State.applyTemplateToDate(id, dateISO);
    UI.toast("Applied");
    Router.go("path", { date: dateISO, view: "day" });
  }

  async function renderTodos(card, dateISO) {
    var j = await State.getJournal(dateISO);
    var todos = (j && j.morning && Array.isArray(j.morning.todos)) ? j.morning.todos : [];

    if (!todos.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No ToDos. Add them in Alignment → Morning." }, []));
      return;
    }

    // in-app reminder check (when app open)
    scheduleInAppReminders(todos);

    todos.forEach(function (t) {
      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, []);
      var cb = UI.el("input", { type: "checkbox" }, []);
      cb.checked = !!t.done;
      cb.addEventListener("change", function () {
        t.done = cb.checked;
        State.setMorningTodos(dateISO, todos).then(function () { UI.toast("Saved"); });
      });

      var text = UI.el("div", { className: "todo-text", text: (t.text || "—") + (t.scheduledTime ? (" (@" + t.scheduledTime + ")") : "") }, []);
      text.addEventListener("click", function () {
        UI.prompt("Edit ToDo", "Text", t.text || "", "").then(function (v) {
          if (v === null) return;
          t.text = v.trim();
          State.setMorningTodos(dateISO, todos).then(function () { UI.toast("Saved"); Router.go("path", { date: dateISO, view: "day" }); });
        });
      });

      left.appendChild(cb);
      left.appendChild(text);

      var right = UI.el("div", { className: "todo-right" }, []);
      var timeBtn = UI.el("button", { className: "btn btn-mini", type: "button", text: t.scheduledTime ? ("+" + t.scheduledTime) : "+ time" }, []);
      timeBtn.addEventListener("click", function () {
        UI.prompt("Schedule ToDo", "Time (HH:MM)", t.scheduledTime || "", "09:30").then(function (v) {
          if (v === null) return;
          var vv = v.trim();
          if (!vv) { delete t.scheduledTime; }
          else {
            if (UI.timeToMinutes(vv) === null) { UI.toast("Invalid time"); return; }
            t.scheduledTime = vv;
          }
          State.setMorningTodos(dateISO, todos).then(function () { UI.toast("Saved (in-app reminder only)"); Router.go("path", { date: dateISO, view: "day" }); });
        });
      });

      right.appendChild(timeBtn);
      row.appendChild(left);
      row.appendChild(right);

      card.appendChild(UI.el("div", { style: "height:10px" }, []));
      card.appendChild(row);
    });
  }

  function scheduleInAppReminders(todos) {
    try {
      var now = new Date();
      var today = UI.formatDateISO(now);
      // Only for today
      if (UI.formatDateISO(new Date()) !== today) return;

      todos.forEach(function (t) {
        if (!t.scheduledTime) return;
        if (t.done) return;
        var mins = UI.timeToMinutes(t.scheduledTime);
        if (mins === null) return;

        var target = new Date();
        target.setHours(Math.floor(mins / 60), mins % 60, 0, 0);

        // 15 minutes before
        var remind = new Date(target.getTime() - 15 * 60 * 1000);
        var ms = remind.getTime() - Date.now();
        if (ms <= 0 || ms > 12 * 60 * 60 * 1000) return; // ignore past / too far

        window.setTimeout(function () {
          UI.toast("Reminder: " + (t.text || "ToDo") + " in 15 min");
        }, ms);
      });
    } catch (e) {}
  }
})();
