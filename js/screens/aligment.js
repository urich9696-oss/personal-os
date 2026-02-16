(function () {
  "use strict";

  var Q = [
    "War ich heute die Person, die mein zukünftiges ICH respektieren würde?",
    "Was habe ich heute gelernt, verbessert oder trainiert, das mich stärker macht als gestern?",
    "Habe ich heute wie ein asset builder oder wie ein konsument gehandelt?",
    "Habe ich heute bewusst entschieden oder automatisch gehandelt?"
  ];

  ScreenRegistry.register("alignment", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var today = UI.formatDateISO(new Date());
      var action = (ctx && ctx.params) ? ctx.params.action : null;

      var header = UI.el("div", { className: "section-title", text: "Alignment" }, []);
      container.appendChild(header);

      // Top: Journal actions
      var journalCard = UI.el("div", { className: "card tile" }, []);
      journalCard.appendChild(UI.el("div", { className: "tile__label", text: "Journal" }, []));

      var row = UI.el("div", { className: "row" }, []);
      var btnStart = UI.el("button", { className: "btn", type: "button", text: "Start Journal" }, []);
      btnStart.addEventListener("click", function () { openJournalChooser(); });

      var btnVault = UI.el("button", { className: "btn", type: "button", text: "Open Vault" }, []);
      btnVault.addEventListener("click", function () { Router.go("vault", {}); });

      row.appendChild(btnStart);
      row.appendChild(btnVault);
      journalCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      journalCard.appendChild(row);

      container.appendChild(journalCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Inline panel depending on action
      if (action === "morning") {
        await renderMorning(container, today);
      } else if (action === "evening") {
        await renderEvening(container, today);
      } else if (action === "startJournal") {
        openJournalChooser();
      } else {
        // Default: small status hint
        var j = await State.getJournal(today);
        var morningDone = j && j.morning && Array.isArray(j.morning.todos) && j.morning.todos.length > 0;
        var eveningDone = j && j.evening && j.evening.completedAt;
        var statusText = "Morning: " + (morningDone ? "exists" : "empty") + " · Evening: " + (eveningDone ? "done" : "open");
        container.appendChild(UI.el("div", { className: "card tile" }, [
          UI.el("div", { className: "tile__label", text: "Status (Today)" }, []),
          UI.el("div", { className: "tile__value", text: statusText }, [])
        ]));
      }

      function openJournalChooser() {
        UI.modal({
          title: "Start Journal",
          bodyHtml: "<div class='ui-text'>Choose:</div>",
          buttons: [
            { text: "Morning", value: "morning", primary: true },
            { text: "Evening", value: "evening" },
            { text: "Cancel", value: "cancel" }
          ],
          onClose: function (v) {
            if (v === "morning") Router.go("alignment", { action: "morning" });
            if (v === "evening") Router.go("alignment", { action: "evening" });
          }
        });
      }
    }
  });

  async function renderMorning(container, dayKey) {
    var j = await State.getJournal(dayKey);
    var todos = (j && j.morning && Array.isArray(j.morning.todos)) ? j.morning.todos : [];
    var notes = (j && j.morning && typeof j.morning.notes === "string") ? j.morning.notes : "";

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Morning Journal (ToDos)" }, []));

    var list = UI.el("div", {}, []);
    function rerenderList() {
      list.innerHTML = "";
      if (!todos.length) {
        list.appendChild(UI.el("div", { className: "ui-text", text: "No ToDos yet." }, []));
        return;
      }

      todos.forEach(function (t) {
        var row = UI.el("div", { className: "todo-row" }, []);
        var left = UI.el("div", { className: "todo-left" }, []);
        var cb = UI.el("input", { type: "checkbox" }, []);
        cb.checked = !!t.done;
        cb.addEventListener("change", function () {
          t.done = cb.checked;
          State.setMorningTodos(dayKey, todos).then(function () {
            UI.toast("Saved");
          });
        });

        var text = UI.el("div", { className: "todo-text", text: t.text || "—" }, []);
        text.addEventListener("click", function () {
          UI.prompt("Edit ToDo", "Text", t.text || "", "e.g. 10k steps").then(function (v) {
            if (v === null) return;
            t.text = v.trim();
            State.setMorningTodos(dayKey, todos).then(function () {
              rerenderList();
              UI.toast("Saved");
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
            if (!vv) {
              delete t.scheduledTime;
              State.setMorningTodos(dayKey, todos).then(function () {
                rerenderList();
                UI.toast("Time removed");
              });
              return;
            }
            if (UI.timeToMinutes(vv) === null) {
              UI.toast("Invalid time. Use HH:MM");
              return;
            }
            t.scheduledTime = vv;
            State.setMorningTodos(dayKey, todos).then(function () {
              rerenderList();
              UI.toast("Saved (in-app reminder only)");
            });
          });
        });

        var delBtn = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
        delBtn.addEventListener("click", function () {
          UI.confirm("Delete ToDo", "Really delete this ToDo?").then(function (ok) {
            if (!ok) return;
            todos = todos.filter(function (x) { return x.id !== t.id; });
            State.setMorningTodos(dayKey, todos).then(function () {
              rerenderList();
              UI.toast("Deleted");
            });
          });
        });

        right.appendChild(timeBtn);
        right.appendChild(delBtn);

        row.appendChild(left);
        row.appendChild(right);
        list.appendChild(row);
      });
    }

    var addBtn = UI.el("button", { className: "btn", type: "button", text: "Add ToDo" }, []);
    addBtn.addEventListener("click", function () {
      UI.prompt("New ToDo", "Text", "", "e.g. Gym + Mobility").then(function (v) {
        if (v === null) return;
        var txt = v.trim();
        if (!txt) return;
        todos.push({ id: "t" + String(Date.now()), text: txt, done: false });
        State.setMorningTodos(dayKey, todos).then(function () {
          rerenderList();
          UI.toast("Added");
        });
      });
    });

    var notesBtn = UI.el("button", { className: "btn", type: "button", text: "Edit Morning Notes" }, []);
    notesBtn.addEventListener("click", function () {
      UI.prompt("Morning Notes", "Notes", notes || "", "Optional").then(function (v) {
        if (v === null) return;
        notes = v;
        State.getJournal(dayKey).then(function (j2) {
          j2.morning = j2.morning || {};
          j2.morning.notes = notes;
          State.saveJournal(dayKey, j2).then(function () {
            UI.toast("Saved");
          });
        });
      });
    });

    card.appendChild(UI.el("div", { style: "height:10px" }, []));
    card.appendChild(addBtn);
    card.appendChild(UI.el("div", { style: "height:10px" }, []));
    card.appendChild(notesBtn);
    card.appendChild(UI.el("div", { style: "height:12px" }, []));
    card.appendChild(list);

    rerenderList();
    container.appendChild(card);
  }

  async function renderEvening(container, dayKey) {
    var j = await State.getJournal(dayKey);
    var a = (j && j.evening && j.evening.answers) ? j.evening.answers : { q1: "", q2: "", q3: "", q4: "" };
    var notes = (j && j.evening && typeof j.evening.notes === "string") ? j.evening.notes : "";

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Evening Journal (4 Master Questions)" }, []));

    var fields = [];
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        var key = "q" + String(idx + 1);
        var block = UI.el("div", { className: "q-block" }, []);
        block.appendChild(UI.el("div", { className: "q-title", text: (idx + 1) + ". " + Q[idx] }, []));
        var ta = UI.el("textarea", { className: "ui-textarea", rows: "3" }, []);
        ta.value = a[key] || "";
        fields.push({ key: key, ta: ta });
        block.appendChild(ta);
        card.appendChild(block);
        card.appendChild(UI.el("div", { style: "height:10px" }, []));
      })(i);
    }

    var notesTitle = UI.el("div", { className: "q-title", text: "Notes (optional)" }, []);
    var notesTa = UI.el("textarea", { className: "ui-textarea", rows: "3" }, []);
    notesTa.value = notes || "";

    card.appendChild(notesTitle);
    card.appendChild(notesTa);
    card.appendChild(UI.el("div", { style: "height:12px" }, []));

    var doneBtn = UI.el("button", { className: "btn", type: "button", text: "Complete Evening" }, []);
    doneBtn.addEventListener("click", function () {
      var answers = {};
      fields.forEach(function (f) { answers[f.key] = (f.ta.value || "").trim(); });
      var n = (notesTa.value || "").trim();

      State.getJournal(dayKey).then(function (j2) {
        j2.evening = j2.evening || {};
        j2.evening.notes = n;
        State.saveJournal(dayKey, j2).then(function () {
          State.completeEvening(dayKey, answers).then(function () {
            UI.toast("Abendroutine einleiten", 2200);
            Router.go("vault", { dayKey: dayKey });
          });
        });
      });
    });

    card.appendChild(doneBtn);
    container.appendChild(card);
  }
})();
