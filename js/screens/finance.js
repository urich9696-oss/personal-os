(function () {
  "use strict";

  ScreenRegistry.register("finance", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Finance" }, []);
      container.appendChild(title);

      var month = UI.formatDateISO(new Date()).slice(0, 7);

      // Month reminder (in-app)
      var ensure = await State.financeEnsureMonth();
      if (ensure && ensure.showReminder) {
        var banner = UI.el("div", { className: "card tile" }, []);
        banner.appendChild(UI.el("div", { className: "tile__label", text: "Reminder" }, []));
        banner.appendChild(UI.el("div", { className: "tile__value", text: "Monat ausfüllen" }, []));
        banner.appendChild(UI.el("div", { className: "ui-text", text: "Lege fixe Einnahmen/Ausgaben fest und wende sie auf den Monat an." }, []));
        banner.appendChild(UI.el("div", { style: "height:10px" }, []));

        var row = UI.el("div", { className: "row" }, []);
        var goFixed = UI.el("button", { className: "btn", type: "button", text: "Fixe Items öffnen" }, []);
        goFixed.addEventListener("click", function () {
          // just scroll; banner is above fixed section – simplest UX
          location.hash = "#finance?section=fixed";
        });

        var dismiss = UI.el("button", { className: "btn", type: "button", text: "Dismiss" }, []);
        dismiss.addEventListener("click", function () {
          State.financeDismissReminder(month).then(function () {
            UI.toast("Dismissed");
            Router.go("finance", {});
          });
        });

        row.appendChild(goFixed);
        row.appendChild(dismiss);
        banner.appendChild(row);

        container.appendChild(banner);
        container.appendChild(UI.el("div", { style: "height:12px" }, []));
      }

      var summary = await computeMonthSummary(month);

      // Summary
      var summaryCard = UI.el("div", { className: "card tile" }, []);
      summaryCard.appendChild(UI.el("div", { className: "tile__label", text: "Month: " + month }, []));
      summaryCard.appendChild(UI.el("div", { className: "tile__value", text: "Remaining: CHF " + formatMoney(summary.remaining) }, []));

      var pct = summary.income > 0 ? Math.max(0, Math.min(100, (summary.remaining / summary.income) * 100)) : 0;
      summaryCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      summaryCard.appendChild(UI.el("div", { className: "progress-wrap" }, [
        UI.el("div", { className: "progress-bar" }, [
          UI.el("div", { className: "progress-fill", style: "width:" + pct.toFixed(0) + "%" }, [])
        ]),
        UI.el("div", { className: "ui-text", text: "Income: CHF " + formatMoney(summary.income) + " · Expense: CHF " + formatMoney(summary.expense) + " · " + pct.toFixed(0) + "% remaining" }, [])
      ]));

      container.appendChild(summaryCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Fixed items
      var fixedCard = UI.el("div", { className: "card tile" }, []);
      fixedCard.appendChild(UI.el("div", { className: "tile__label", text: "Fixe Einnahmen/Ausgaben" }, []));
      fixedCard.appendChild(UI.el("div", { className: "ui-text", text: "Diese Items kannst du monatlich automatisch eintragen." }, []));
      fixedCard.appendChild(UI.el("div", { style: "height:10px" }, []));

      var fixedRow = UI.el("div", { className: "row" }, []);
      var addFixedBtn = UI.el("button", { className: "btn", type: "button", text: "Add Fixed Item" }, []);
      addFixedBtn.addEventListener("click", function () { addFixedItemFlow(); });

      var applyFixedBtn = UI.el("button", { className: "btn", type: "button", text: "Apply Fixed to Month" }, []);
      applyFixedBtn.addEventListener("click", function () { applyFixedFlow(month); });

      fixedRow.appendChild(addFixedBtn);
      fixedRow.appendChild(applyFixedBtn);
      fixedCard.appendChild(fixedRow);

      fixedCard.appendChild(UI.el("div", { style: "height:12px" }, []));
      await renderFixedItems(fixedCard);

      container.appendChild(fixedCard);
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

      // Transactions
      var txCard = UI.el("div", { className: "card tile" }, []);
      txCard.appendChild(UI.el("div", { className: "tile__label", text: "Transactions (this month)" }, []));
      await renderTransactions(txCard, month);
      container.appendChild(txCard);

      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Gatekeeper
      var gkCard = UI.el("div", { className: "card tile" }, []);
      gkCard.appendChild(UI.el("div", { className: "tile__label", text: "Gatekeeper (72h)" }, []));
      await renderGatekeepers(gkCard, summary.remaining);
      container.appendChild(gkCard);

      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Reports
      var repCard = UI.el("div", { className: "card tile" }, []);
      repCard.appendChild(UI.el("div", { className: "tile__label", text: "Monthly Financial Report" }, []));
      repCard.appendChild(UI.el("div", { className: "ui-text", text: "Erzeuge einen Monatsreport (Snapshot) und archiviere ihn." }, []));
      repCard.appendChild(UI.el("div", { style: "height:10px" }, []));

      var repRow = UI.el("div", { className: "row" }, []);
      var makeRep = UI.el("button", { className: "btn", type: "button", text: "Create Report (this month)" }, []);
      makeRep.addEventListener("click", function () { createReportFlow(month); });

      var showArchive = UI.el("button", { className: "btn", type: "button", text: "Open Report Archive" }, []);
      showArchive.addEventListener("click", function () { openArchiveFlow(); });

      repRow.appendChild(makeRep);
      repRow.appendChild(showArchive);
      repCard.appendChild(repRow);

      container.appendChild(repCard);
    }
  });

  async function computeMonthSummary(month) {
    var txs = await State.listTransactionsByMonth(month);
    var income = 0, expense = 0;
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

      left.addEventListener("click", function () { editTransactionFlow(t); });

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

    if (typeof remaining === "number" && price > remaining) UI.toast("Warning: price > remaining");

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
      var unlock = Date.parse(g.unlockAt || "");
      var eligible = (!isNaN(unlock)) && (now >= unlock);
      var status = g.status || "locked";
      var displayStatus = status;

      if (status === "locked" && eligible) displayStatus = "eligible";

      var remainingMs = (!isNaN(unlock)) ? Math.max(0, unlock - now) : null;
      var countdown = (remainingMs === null) ? "—" : (eligible ? "0h (eligible)" : formatCountdown(remainingMs));

      var impact = (typeof remaining === "number" && remaining > 0) ? ((Number(g.price || 0) / remaining) * 100) : null;
      var impactTxt = (impact !== null) ? (" · impact " + impact.toFixed(0) + "%") : "";

      var warn = (typeof remaining === "number" && Number(g.price || 0) > remaining);

      var line =
        (status === "purchased" ? "✓ " : "• ") +
        (g.name || "—") +
        " · CHF " + formatMoney(g.price) +
        " · " + displayStatus +
        " · " + countdown +
        impactTxt +
        (warn ? " · WARNING" : "");

      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text" + (warn ? " is-warn" : ""), text: line }, [])
      ]);

      var right = UI.el("div", { className: "todo-right" }, []);

      if (status !== "purchased" && status !== "cancelled") {
        var buy = UI.el("button", { className: "btn btn-mini", type: "button", text: "Gekauft" }, []);
        buy.addEventListener("click", function () {
          if (!eligible) {
            UI.confirm("Not eligible yet", "72h not passed. Override and mark as purchased anyway?").then(function (ok) {
              if (!ok) return;
              doPurchase(g.id);
            });
            return;
          }

          if (warn) {
            UI.confirm("Warning", "Price > remaining. Still mark as purchased?").then(function (ok) {
              if (!ok) return;
              doPurchase(g.id);
            });
            return;
          }

          doPurchase(g.id);
        });
        right.appendChild(buy);
      }

      var cancel = UI.el("button", { className: "btn btn-mini", type: "button", text: "Cancel" }, []);
      cancel.addEventListener("click", function () {
        UI.confirm("Cancel", "Cancel this gatekeeper item?").then(function (ok) {
          if (!ok) return;
          g.status = "cancelled";
          State.updateGatekeeper(g).then(function () { UI.toast("Cancelled"); Router.go("finance", {}); });
        });
      });
      right.appendChild(cancel);

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

  // Fixed Items UI
  async function renderFixedItems(card) {
    var items = await State.financeListFixedItems();
    if (!items.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "Noch keine fixen Items." }, []));
      return;
    }

    items.forEach(function (fi) {
      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text", text: (fi.type === "income" ? "↑ " : "↓ ") + (fi.name || "—") + " · CHF " + formatMoney(fi.amount) }, [])
      ]);

      left.addEventListener("click", function () { editFixedItemFlow(fi); });

      var right = UI.el("div", { className: "todo-right" }, []);
      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function () {
        UI.confirm("Delete Fixed Item", "Delete this fixed item?").then(function (ok) {
          if (!ok) return;
          State.financeDeleteFixedItem(fi.id).then(function () {
            UI.toast("Deleted");
            Router.go("finance", {});
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

  async function addFixedItemFlow() {
    var type = await chooseType();
    if (!type) return;

    var name = await UI.prompt("Fixed Item", "Name", "", "e.g. Rent / Salary");
    if (name === null) return;

    var amtStr = await UI.prompt("Fixed Item", "Amount (CHF)", "", "e.g. 1200");
    if (amtStr === null) return;
    var amt = Number(String(amtStr).replace(",", "."));
    if (isNaN(amt)) { UI.toast("Invalid amount"); return; }

    await State.financeAddFixedItem({ type: type, name: (name || "").trim(), amount: amt });
    UI.toast("Fixed item added");
    Router.go("finance", {});
  }

  async function editFixedItemFlow(fi) {
    var name = await UI.prompt("Edit Fixed Item", "Name", fi.name || "", "");
    if (name === null) return;

    var amtStr = await UI.prompt("Edit Fixed Item", "Amount (CHF)", String(fi.amount || ""), "");
    if (amtStr === null) return;
    var amt = Number(String(amtStr).replace(",", "."));
    if (isNaN(amt)) { UI.toast("Invalid amount"); return; }

    var type = await chooseType();
    if (!type) return;

    await State.financeUpdateFixedItem({ id: fi.id, type: type, name: (name || "").trim(), amount: amt });
    UI.toast("Saved");
    Router.go("finance", {});
  }

  async function applyFixedFlow(month) {
    UI.confirm("Apply Fixed", "Apply fixed items to " + month + " as transactions? (only once per month)").then(function (ok) {
      if (!ok) return;
      State.financeApplyFixedForMonth(month).then(function (res) {
        if (res && res.applied) UI.toast("Applied: " + res.count + " items");
        else UI.toast("Not applied: " + (res.reason || "unknown"));
        Router.go("finance", {});
      });
    });
  }

  async function createReportFlow(month) {
    var rep = await State.financeBuildReport(month);
    await State.financeSaveReport(month, rep);
    UI.toast("Report saved to archive");
    Router.go("finance", {});
  }

  async function openArchiveFlow() {
    var reps = await State.financeListReports();
    if (!reps.length) { UI.toast("No reports"); return; }

    var html = "<div class='ui-text'>Saved reports:</div><div style='height:10px'></div>";
    for (var i = 0; i < reps.length; i++) {
      var r = reps[i];
      html += "<div class='ui-text'>• " + UI.escapeHtml(r.month) + " — Remaining CHF " + formatMoney(r.totals.remaining) + "</div>";
    }
    html += "<div style='height:10px'></div><div class='ui-text'>Enter month (YYYY-MM):</div>";

    var picked = await UI.prompt("Report Archive", "Month (YYYY-MM)", reps[0].month || "", "2026-02");
    if (picked === null) return;
    var m = picked.trim();
    if (!/^\d{4}-\d{2}$/.test(m)) { UI.toast("Invalid month"); return; }

    var rep = await State.financeGetReport(m);
    if (!rep) { UI.toast("Not found"); return; }

    var body =
      "<div class='ui-text'><b>" + UI.escapeHtml(rep.month) + "</b></div>" +
      "<div class='ui-text'>Income: CHF " + formatMoney(rep.totals.income) + "</div>" +
      "<div class='ui-text'>Expense: CHF " + formatMoney(rep.totals.expense) + "</div>" +
      "<div class='ui-text'>Remaining: CHF " + formatMoney(rep.totals.remaining) + " (" + rep.totals.remainingPct.toFixed(0) + "%)</div>" +
      "<div style='height:10px'></div>" +
      "<div class='ui-text'>Fixed Income: CHF " + formatMoney(rep.fixed.income) + "</div>" +
      "<div class='ui-text'>Fixed Expense: CHF " + formatMoney(rep.fixed.expense) + "</div>" +
      "<div class='ui-text'>Variable Expense: CHF " + formatMoney(rep.variable.expense) + "</div>" +
      "<div class='ui-text'>Gatekeeper purchases: " + (rep.gatekeeper.purchases || 0) + "</div>";

    UI.modal({
      title: "Monthly Report",
      bodyHtml: body,
      buttons: [{ text: "Close", value: "close", primary: true }],
      onClose: function () {}
    });
  }

  function formatCountdown(ms) {
    var totalMin = Math.ceil(ms / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return h + "h " + m + "m";
  }

  function formatMoney(n) {
    var x = Number(n || 0);
    return x.toFixed(2);
  }
})();
