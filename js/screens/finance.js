(function () {
  "use strict";

  ScreenRegistry.register("finance", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Finance" }, []);
      container.appendChild(title);

      var params = (ctx && ctx.params) ? ctx.params : {};
      var action = params.action || null;

      var month = UI.formatDateISO(new Date()).slice(0, 7);

      // Summary
      var summary = await computeMonthSummary(month);

      var summaryCard = UI.el("div", { className: "card tile" }, []);
      summaryCard.appendChild(UI.el("div", { className: "tile__label", text: "Month: " + month }, []));
      summaryCard.appendChild(UI.el("div", { className: "tile__value", text: "Remaining: CHF " + formatMoney(summary.remaining) }, []));

      var prog = UI.el("div", { className: "progress-wrap" }, []);
      var pct = summary.income > 0 ? Math.max(0, Math.min(100, (summary.remaining / summary.income) * 100)) : 0;
      prog.appendChild(UI.el("div", { className: "progress-bar" }, [
        UI.el("div", { className: "progress-fill", style: "width:" + pct.toFixed(0) + "%" }, [])
      ]));
      prog.appendChild(UI.el("div", { className: "ui-text", text: "Income: CHF " + formatMoney(summary.income) + " · Expense: CHF " + formatMoney(summary.expense) + " · " + pct.toFixed(0) + "% remaining" }, []));
      summaryCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      summaryCard.appendChild(prog);

      container.appendChild(summaryCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Actions
      var actionsCard = UI.el("div", { className: "card tile" }, []);
      actionsCard.appendChild(UI.el("div", { className: "tile__label", text: "Actions" }, []));

      var row = UI.el("div", { className: "row" }, []);
      var addTx = UI.el("button", { className: "btn", type: "button", text: "Add Transaction" }, []);
      addTx.addEventListener("click", function () { addTransactionFlow(month); });

      var addGk = UI.el("button", { className: "btn", type: "button", text: "Add Gatekeeper" }, []);
      addGk.addEventListener("click", function () { addGatekeeperFlow(summary.remaining); });

      row.appendChild(addTx);
      row.appendChild(addGk);

      actionsCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      actionsCard.appendChild(row);

      container.appendChild(actionsCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Transactions list
      var txCard = UI.el("div", { className: "card tile" }, []);
      txCard.appendChild(UI.el("div", { className: "tile__label", text: "Transactions (this month)" }, []));
      await renderTransactions(txCard, month);
      container.appendChild(txCard);

      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Gatekeeper list
      var gkCard = UI.el("div", { className: "card tile" }, []);
      gkCard.appendChild(UI.el("div", { className: "tile__label", text: "Gatekeeper" }, []));
      await renderGatekeepers(gkCard, summary.remaining);
      container.appendChild(gkCard);

      // Action from dashboard
      if (action === "addTx") {
        await addTransactionFlow(month);
        Router.go("finance", {});
      }
      if (action === "addGatekeeper") {
        await addGatekeeperFlow(summary.remaining);
        Router.go("finance", {});
      }
    }
  });

  async function computeMonthSummary(month) {
    var txs = await State.listTransactionsByMonth(month);
    var income = 0;
    var expense = 0;
    for (var i = 0; i < txs.length; i++) {
      var t = txs[i];
      var amt = Number(t.amount || 0);
      if (t.type === "income") income += amt;
      else expense += amt;
    }
    return { income: income, expense: expense, remaining: income - expense };
  }

  async function addTransactionFlow(month) {
    var type = await chooseType();
    if (!type) return;

    var name = await UI.prompt("Transaction", "Name", "", "e.g. Rent / Salary");
    if (name === null) return;

    var amtStr = await UI.prompt("Transaction", "Amount (CHF)", "", "e.g. 1200");
    if (amtStr === null) return;
    var amt = Number(String(amtStr).replace(",", "."));
    if (isNaN(amt)) { UI.toast("Invalid amount"); return; }

    var fixed = await UI.confirm("Fixed?", "Is this a fixed transaction?");
    var date = UI.formatDateISO(new Date());

    await State.addTransaction({
      month: month,
      date: date,
      type: type,
      categoryId: null,
      name: (name || "").trim(),
      amount: amt,
      fixed: fixed
    });

    UI.toast("Transaction added");
    Router.go("finance", {});
  }

  async function chooseType() {
    return new Promise(function (resolve) {
      UI.modal({
        title: "Transaction Type",
        bodyHtml: "<div class='ui-text'>Choose:</div>",
        buttons: [
          { text: "Income", value: "income", primary: true },
          { text: "Expense", value: "expense" },
          { text: "Cancel", value: null }
        ],
        onClose: function (v) { resolve(v); }
      });
    });
  }

  async function renderTransactions(card, month) {
    var txs = await State.listTransactionsByMonth(month);
    if (!txs.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No transactions yet." }, []));
      return;
    }

    txs.forEach(function (t) {
      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text", text: (t.type === "income" ? "↑ " : "↓ ") + (t.name || "—") + " · CHF " + formatMoney(t.amount) + (t.fixed ? " (fixed)" : "") }, [])
      ]);

      left.addEventListener("click", function () {
        editTransactionFlow(t);
      });

      var right = UI.el("div", { className: "todo-right" }, []);
      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function () {
        UI.confirm("Delete", "Delete this transaction?").then(function (ok) {
          if (!ok) return;
          State.deleteTransaction(t.id).then(function () { UI.toast("Deleted"); Router.go("finance", {}); });
        });
      });

      right.appendChild(del);
      row.appendChild(left);
      row.appendChild(right);

      card.appendChild(UI.el("div", { style: "height:10px" }, []));
      card.appendChild(row);
    });
  }

  async function editTransactionFlow(t) {
    var name = await UI.prompt("Edit Transaction", "Name", t.name || "", "");
    if (name === null) return;

    var amtStr = await UI.prompt("Edit Transaction", "Amount (CHF)", String(t.amount || ""), "");
    if (amtStr === null) return;
    var amt = Number(String(amtStr).replace(",", "."));
    if (isNaN(amt)) { UI.toast("Invalid amount"); return; }

    var fixed = await UI.confirm("Fixed?", "Set fixed?");
    t.name = (name || "").trim();
    t.amount = amt;
    t.fixed = fixed;

    await State.updateTransaction(t);
    UI.toast("Saved");
    Router.go("finance", {});
  }

  async function addGatekeeperFlow(remaining) {
    var name = await UI.prompt("Gatekeeper", "Name", "", "e.g. Headphones");
    if (name === null) return;

    var priceStr = await UI.prompt("Gatekeeper", "Price (CHF)", "", "e.g. 199");
    if (priceStr === null) return;
    var price = Number(String(priceStr).replace(",", "."));
    if (isNaN(price)) { UI.toast("Invalid price"); return; }

    if (typeof remaining === "number" && price > remaining) {
      UI.toast("Warning: price > remaining");
    }

    await State.addGatekeeper({ name: (name || "").trim(), price: price, status: "locked" });
    UI.toast("Gatekeeper added (72h)");
    Router.go("finance", {});
  }

  async function renderGatekeepers(card, remaining) {
    var items = await State.listGatekeepers();
    if (!items.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No gatekeeper items." }, []));
      return;
    }

    var now = Date.now();

    items.forEach(function (g) {
      // auto-mark eligible in UI (persist optional in later)
      var unlock = Date.parse(g.unlockAt || "");
      var eligible = !isNaN(unlock) && now >= unlock;
      var status = g.status || "locked";
      if (status === "locked" && eligible) status = "eligible";

      var impact = (typeof remaining === "number" && remaining > 0) ? ((Number(g.price || 0) / remaining) * 100) : null;

      var line = (status === "purchased" ? "✓ " : "• ") +
        (g.name || "—") +
        " · CHF " + formatMoney(g.price) +
        " · " + status +
        (impact !== null ? (" · impact " + impact.toFixed(0) + "%") : "");

      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text", text: line }, [])
      ]);

      var right = UI.el("div", { className: "todo-right" }, []);

      if (status !== "purchased") {
        var buy = UI.el("button", { className: "btn btn-mini", type: "button", text: "Gekauft" }, []);
        buy.addEventListener("click", function () {
          if (typeof remaining === "number" && Number(g.price || 0) > remaining) {
            UI.confirm("Warning", "Price > remaining. Still mark as purchased?").then(function (ok) {
              if (!ok) return;
              doPurchase(g.id);
            });
          } else {
            doPurchase(g.id);
          }
        });
        right.appendChild(buy);
      }

      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function () {
        UI.confirm("Delete", "Delete this gatekeeper item?").then(function (ok) {
          if (!ok) return;
          // delete: we don't have direct delete API; use update status cancelled
          g.status = "cancelled";
          State.updateGatekeeper(g).then(function () { UI.toast("Cancelled"); Router.go("finance", {}); });
        });
      });
      right.appendChild(del);

      row.appendChild(left);
      row.appendChild(right);

      card.appendChild(UI.el("div", { style: "height:10px" }, []));
      card.appendChild(row);
    });

    function doPurchase(id) {
      State.markGatekeeperPurchased(id).then(function () {
        UI.toast("Purchased + expense added");
        Router.go("finance", {});
      }).catch(function (e) {
        UI.toast("Error: " + (e && e.message ? e.message : String(e)));
      });
    }
  }

  function formatMoney(n) {
    var x = Number(n || 0);
    return x.toFixed(2);
  }
})();
