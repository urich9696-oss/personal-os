(function () {
  "use strict";

  ScreenRegistry.register("vault", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Vault (Archiv)" }, []);
      container.appendChild(title);

      var dayKey = (ctx && ctx.params) ? ctx.params.dayKey : null;

      if (dayKey) {
        await renderDetail(container, dayKey);
      } else {
        await renderList(container);
      }
    }
  });

  async function renderList(container) {
    var entries = await State.listVault();

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Entries" }, []));

    if (!entries.length) {
      card.appendChild(UI.el("div", { className: "tile__value", text: "No snapshots yet." }, []));
      container.appendChild(card);
      return;
    }

    var list = UI.el("div", {}, []);
    entries.forEach(function (e) {
      var btn = UI.el("button", { className: "btn vault-item", type: "button", text: e.dayKey }, []);
      btn.addEventListener("click", function () {
        Router.go("vault", { dayKey: e.dayKey });
      });
      list.appendChild(btn);
      list.appendChild(UI.el("div", { style: "height:8px" }, []));
    });

    card.appendChild(UI.el("div", { style: "height:10px" }, []));
    card.appendChild(list);
    container.appendChild(card);
  }

  async function renderDetail(container, dayKey) {
    var snap = await State.getVaultSnapshot(dayKey);

    var back = UI.el("button", { className: "btn", type: "button", text: "Back to Vault" }, []);
    back.addEventListener("click", function () { Router.go("vault", {}); });
    container.appendChild(back);
    container.appendChild(UI.el("div", { style: "height:12px" }, []));

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Snapshot: " + dayKey }, []));

    if (!snap || !snap.journal) {
      card.appendChild(UI.el("div", { className: "tile__value", text: "Snapshot empty." }, []));
      container.appendChild(card);
      return;
    }

    var j = snap.journal;
    var mTodos = (j.morning && Array.isArray(j.morning.todos)) ? j.morning.todos : [];
    var eAnswers = (j.evening && j.evening.answers) ? j.evening.answers : {};
    var eDone = j.evening && j.evening.completedAt;

    card.appendChild(UI.el("div", { className: "section-title", text: "Morning" }, []));
    if (!mTodos.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No ToDos." }, []));
    } else {
      mTodos.forEach(function (t) {
        var line = (t.done ? "✓ " : "• ") + (t.text || "—") + (t.scheduledTime ? (" (" + t.scheduledTime + ")") : "");
        card.appendChild(UI.el("div", { className: "ui-text", text: line }, []));
      });
    }

    card.appendChild(UI.el("div", { style: "height:12px" }, []));
    card.appendChild(UI.el("div", { className: "section-title", text: "Evening" }, []));
    card.appendChild(UI.el("div", { className: "ui-text", text: "Completed: " + (eDone ? "yes" : "no") }, []));

    ["q1", "q2", "q3", "q4"].forEach(function (k, idx) {
      card.appendChild(UI.el("div", { className: "ui-text", text: (idx + 1) + ". " + (eAnswers[k] || "—") }, []));
    });

    container.appendChild(card);
  }
})();
