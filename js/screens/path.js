// js/screens/path.js
(function () {
  "use strict";

  ScreenRegistry.register("path", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Today’s Path" }, []);
      container.appendChild(title);

      var params = (ctx && ctx.params) ? ctx.params : {};
      var selectedDate = params.date || UI.formatDateISO(new Date());
      var viewMode = params.view || "day"; // day|week
      var action = params.action || null;

      var controls = UI.el("div", { className: "card tile" }, []);
      controls.appendChild(UI.el("div", { className: "tile__label", text: "Planner" }, []));

      var row = UI.el("div", { className: "row" }, []);
      var dateBtn = UI.el("button", { className: "btn", type: "button", text: "Date: " + selectedDate }, []);
      dateBtn.addEventListener("click", function () { pickDate(selectedDate, viewMode); });

      var toggleBtn = UI.el("button", { className: "btn", type: "button", text: "View: " + (viewMode === "week" ? "Week" : "Day") }, []);
      toggleBtn.addEventListener("click", function () {
        Router.go("path", { date: selectedDate, view: (viewMode === "week" ? "day" : "week") });
      });

      row.appendChild(dateBtn);
      row.appendChild(toggleBtn);
      controls.appendChild(UI.el("div", { style: "height:10px" }, []));
      controls.appendChild(row);

      var actionsRow = UI.el("div", { className: "row" }, []);
      var newBlockBtn = UI.el("button", { className: "btn", type: "button", text: "Create new Block" }, []);
      newBlockBtn.addEventListener("click", function () { createNewBlock(selectedDate); });

      var tplBtn = UI.el("button", { className: "btn", type: "button", text: "Templates" }, []);
      tplBtn.addEventListener("click", function () { openTemplatesHub(selectedDate); });

      actionsRow.appendChild(newBlockBtn);
      actionsRow.appendChild(tplBtn);

      controls.appendChild(UI.el("div", { style: "height:10px" }, []));
      controls.appendChild(actionsRow);

      container.appendChild(controls);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      var calCard = UI.el("div", { className: "card tile" }, []);
      calCard.appendChild(UI.el("div", { className: "tile__label", text: "Kalender (" + (viewMode === "week" ? "Week" : "Day") + ")" }, []));
      if (viewMode === "day") await renderDay(calCard, selectedDate);
      else await renderWeek(calCard, selectedDate);
      container.appendChild(calCard);

      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      var todoCard = UI.el("div", { className: "card tile" }, []);
      todoCard.appendChild(UI.el("div", { className: "tile__label", text: "ToDos (from Morning Journal)" }, []));
      await renderTodos(todoCard, selectedDate);
      container.appendChild(todoCard);

      if (action === "newBlock") {
        await createNewBlock(selectedDate);
      }
    }
  });

  async function pickDate(currentDate, viewMode) {
    var v = await UI.prompt("Select Date", "YYYY-MM-DD", currentDate, "2026-02-16");
    if (v === null) return;
    var t = v.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) { UI.toast("Invalid date"); return; }
    Router.go("path", { date: t, view: viewMode });
  }

  async function renderDay(card, dateISO) {
    var blocks = await State.listBlocksByDate(dateISO);

    if (!blocks.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No blocks." }, []));
      return;
    }

    blocks.forEach(function (b) {
      var s = (b.startTime || "—");
      var e = (b.endTime || "—");
      var t = (b.title || "Block");
      var type = (b.type || "block");
      var note = (b.note || "").trim();

      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text", text: s + "-" + e + " · " + t }, []),
        UI.el("div", { className: "ui-text", text: "Type: " + type }, [])
      ]);

      if (note) {
        left.appendChild(UI.el("div", { className: "ui-text", text: note }, []));
      }

      left.addEventListener("click", function () { editBlockFlow(b); });

      var row = UI.el("div", { className: "todo-row" }, []);
      var right = UI.el("div", { className: "todo-right" }, []);
      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        UI.confirm("Delete Block", "Delete this block?").then(function (ok) {
          if (!ok) return;
          State.deleteBlock(b.id).then(function () {
            UI.toast("Deleted");
            Router.go("path", { date: dateISO, view: "day" });
          });
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
    var d = new Date(dateISO + "T00:00:00");
    var day = d.getDay();
    var delta = (day === 0) ? -6 : (1 - day);
    d.setDate(d.getDate() + delta);

    for (var i = 0; i < 7; i++) {
      var dd = new Date(d.getTime());
      dd.setDate(d.getDate() + i);
      var key = UI.formatDateISO(dd);
      var blocks = await State.listBlocksByDate(key);

      var label = key + " — " + (blocks.length ? (blocks.length + " blocks") : "no blocks");
      var btn = UI.el("button", { className: "btn", type: "button", text: label }, []);
      (function (k) {
        btn.addEventListener("click", function () {
          Router.go("path", { date: k, view: "day" });
        });
      })(key);

      card.appendChild(btn);
      card.appendChild(UI.el("div", { style: "height:8px" }, []));
    }
  }

  async function createNewBlock(dateISO) {
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

    var type = await UI.prompt("New Block", "Type (Focus/Work/Personal/Other)", "Work", "Work");
    if (type === null) return;

    var note = await UI.prompt("New Block", "Note (optional)", "", "");
    if (note === null) return;

    await State.addBlock({
      date: dateISO,
      title: (title || "").trim(),
      startTime: start,
      endTime: end,
      type: (type || "block").trim() || "block",
      note: (note || "").trim()
    });

    UI.toast("Block added");
    Router.go("path", { date: dateISO, view: "day" });
  }

  async function editBlockFlow(block) {
    var start = await UI.prompt("Edit Block", "Start (HH:MM)", block.startTime || "", "09:00");
    if (start === null) return;
    start = start.trim();
    if (UI.timeToMinutes(start) === null) { UI.toast("Invalid time"); return; }

    var end = await UI.prompt("Edit Block", "End (HH:MM)", block.endTime || "", "10:00");
    if (end === null) return;
    end = end.trim();
    if (UI.timeToMinutes(end) === null) { UI.toast("Invalid time"); return; }

    var title = await UI.prompt("Edit Block", "Title", block.title || "", "");
    if (title === null) return;

    var type = await UI.prompt("Edit Block", "Type (Focus/Work/Personal/Other)", block.type || "Work", "Work");
    if (type === null) return;

    var note = await UI.prompt("Edit Block", "Note (optional)", block.note || "", "");
    if (note === null) return;

    await State.updateBlock(block.id, {
      startTime: start,
      endTime: end,
      title: (title || "").trim(),
      type: (type || "block").trim() || "block",
      note: (note || "").trim()
    });

    UI.toast("Saved");
    Router.go("path", { date: block.date, view: "day" });
  }

  async function openTemplatesHub(dateISO) {
    var templates = await State.listTemplates();

    var body = "<div class='ui-text'>Templates manage standard days.</div>";
    if (!templates.length) body += "<div class='ui-text' style='margin-top:10px;'>No templates yet.</div>";
    else body += "<div class='ui-text' style='margin-top:10px;'>Choose an action:</div>";

    UI.modal({
      title: "Templates",
      bodyHtml: body,
      buttons: [
        { text: "Create Template", value: "create", primary: true },
        { text: "Apply to " + dateISO, value: "apply" },
        { text: "Close", value: "close" }
      ],
      onClose: function (v) {
        if (v === "create") createTemplateFlow(dateISO);
        if (v === "apply") applyTemplatePicker(dateISO);
      }
    });
  }

  async function createTemplateFlow(dateISO) {
    var name = await UI.prompt("Create Template", "Template name", "", "e.g. Weekday + Sport");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    var blocks = [];
    while (true) {
      var addMore = await UI.confirm("Add Block", "Add another block to this template?");
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

      var type = await UI.prompt("Template Block", "Type (Focus/Work/Personal/Other)", "Work", "Work");
      if (type === null) break;

      var note = await UI.prompt("Template Block", "Note (optional)", "", "");
      if (note === null) break;

      blocks.push({
        startTime: start,
        endTime: end,
        title: (title || "").trim(),
        type: (type || "block").trim() || "block",
        note: (note || "").trim()
      });
    }

    await State.createTemplate(name, blocks);
    UI.toast("Template created");
    Router.go("path", { date: dateISO, view: "day" });
  }

  async function applyTemplatePicker(dateISO) {
    var templates = await State.listTemplates();
    if (!templates.length) { UI.toast("No templates"); return; }

    var name = await UI.prompt("Apply Template", "Template name", templates[0].name || "", "");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    var picked = null;
    for (var j = 0; j < templates.length; j++) {
      if (templates[j].name === name) { picked = templates[j]; break; }
    }
    if (!picked) { UI.toast("Template not found"); return; }

    var wipe = await UI.confirm("Apply Template", "Delete existing blocks on " + dateISO + " first?");
    if (wipe) {
      var existing = await State.listBlocksByDate(dateISO);
      for (var k = 0; k < existing.length; k++) {
        await State.deleteBlock(existing[k].id);
      }
    }

    await State.applyTemplateToDate(picked.id, dateISO);
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

    todos.forEach(function (t) {
      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, []);
      var cb = UI.el("input", { type: "checkbox" }, []);
      cb.checked = !!t.done;
      cb.addEventListener("change", function () {
        t.done = cb.checked;
        State.setMorningTodos(dateISO, todos).then(function () { UI.toast("Saved"); });
      });

      var label = (t.text || "—") + (t.scheduledTime ? (" (@" + t.scheduledTime + ")") : "");
      var text = UI.el("div", { className: "todo-text", text: label }, []);
      text.addEventListener("click", function () {
        UI.prompt("Edit ToDo", "Text", t.text || "", "").then(function (v) {
          if (v === null) return;
          t.text = v.trim();
          State.setMorningTodos(dateISO, todos).then(function () {
            UI.toast("Saved");
            Router.go("path", { date: dateISO, view: "day" });
          });
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
          State.setMorningTodos(dateISO, todos).then(function () {
            UI.toast("Saved (in-app reminder only)");
            Router.go("path", { date: dateISO, view: "day" });
          });
        });
      });

      right.appendChild(timeBtn);
      row.appendChild(left);
      row.appendChild(right);

      card.appendChild(UI.el("div", { style: "height:10px" }, []));
      card.appendChild(row);
    });
  }
})();
