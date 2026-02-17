// js/screens/dashboard.js
(function () {
  "use strict";

  ScreenRegistry.register("dashboard", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var today = UI.formatDateISO(new Date());

      var j = await State.getJournal(today);
      var todos = (j && j.morning && Array.isArray(j.morning.todos)) ? j.morning.todos : [];
      var openTodos = todos.filter(function (t) { return !t.done; }).length;

      var blocks = await State.listBlocksByDate(today);
      var nextBlockText = computeNextBlock(blocks);

      var fin = await computeMonthFinanceSummary(today);
      var budgetRemainingText = fin.remainingText;

      var gatekeepers = await State.listGatekeepers();
      var activeCount = gatekeepers.filter(function (g) { return g.status !== "purchased" && g.status !== "cancelled"; }).length;

      var top = UI.el("div", { className: "grid-2" }, [
        tile("Performance (ToDos)", openTodos + " offen"),
        tile("Next Block", nextBlockText),
        tile("Budget Remaining", budgetRemainingText),
        tile("Gatekeeper", activeCount + " aktiv")
      ]);

      var quickTitle = UI.el("div", { className: "section-title", text: "Quick Add" }, []);
      var select = UI.el("select", { className: "select", "aria-label": "Quick Add" }, [
        UI.el("option", { value: "", text: "Choose…" }, []),
        UI.el("option", { value: "newBlock", text: "Create new Block" }, []),
        UI.el("option", { value: "addTx", text: "Add Transaction" }, []),
        UI.el("option", { value: "addGatekeeper", text: "Add Gatekeeper" }, [])
      ]);

      select.addEventListener("change", function () {
        var v = select.value;
        select.value = "";
        if (!v) return;

        if (v === "newBlock") Router.go("path", { action: "newBlock", date: today });
        if (v === "addTx") Router.go("finance", { action: "addTx" });
        if (v === "addGatekeeper") Router.go("finance", { action: "addGatekeeper" });
      });

      var journalBtn = UI.el("button", { className: "btn", type: "button", text: "Start Journal" }, []);
      journalBtn.addEventListener("click", function () {
        Router.go("alignment", { action: "startJournal" });
      });

      var wrap = UI.el("div", {}, [
        top,
        quickTitle,
        UI.el("div", { className: "card tile" }, [select]),
        UI.el("div", { style: "height:12px" }, []),
        journalBtn
      ]);

      container.appendChild(wrap);
    }
  });

  function tile(label, value) {
    return UI.el("div", { className: "card tile" }, [
      UI.el("div", { className: "tile__label", text: label }, []),
      UI.el("div", { className: "tile__value", text: value }, [])
    ]);
  }

  function computeNextBlock(blocks) {
    if (!blocks || !blocks.length) return "—";
    var now = new Date();
    var nowMins = now.getHours() * 60 + now.getMinutes();

    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var s = UI.timeToMinutes(b.startTime || b.start);
      if (s === null) continue;
      if (s >= nowMins) {
        return (b.startTime || b.start || "") + " " + (b.title || "Block");
      }
    }

    var first = blocks[0];
    return (first.startTime || first.start || "—") + " " + (first.title || "Block");
  }

  async function computeMonthFinanceSummary(todayISO) {
    var month = todayISO.slice(0, 7);
    var txs = await State.listTransactionsByMonth(month);
    var income = 0;
    var expense = 0;
    for (var i = 0; i < txs.length; i++) {
      var t = txs[i];
      var amt = Number(t.amount || 0);
      if (t.type === "income") income += amt;
      else expense += amt;
    }
    var remaining = income - expense;
    var txt = "CHF " + formatMoney(remaining);
    if (!txs.length) txt = "CHF —";
    return { income: income, expense: expense, remaining: remaining, remainingText: txt };
  }

  function formatMoney(n) {
    var x = Number(n || 0);
    return x.toFixed(2);
  }
})();
