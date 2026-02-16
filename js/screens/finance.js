(function () {
  "use strict";

  ScreenRegistry.register("finance", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Finance" }, []);
      container.appendChild(title);

      var params = (ctx && ctx.params) ? ctx.params : {};
      var selectedMonth = params.month || UI.formatDateISO(new Date()).slice(0, 7);

      // Ensure month logic + reminder
      var ensure = await State.financeEnsureMonth();

      // Month selector
      var monthCard = UI.el("div", { className: "card tile" }, []);
      monthCard.appendChild(UI.el("div", { className: "tile__label", text: "Month" }, []));
      var monthRow = UI.el("div", { className: "row" }, []);
      var pickBtn = UI.el("button", { className: "btn", type: "button", text: selectedMonth }, []);
      pickBtn.addEventListener("click", function () { pickMonth(selectedMonth); });

      var closeBtn = UI.el("button", { className: "btn", type: "button", text: "Close Month" }, []);
      closeBtn.addEventListener("click", function () { closeMonthFlow(selectedMonth); });

      monthRow.appendChild(pickBtn);
      monthRow.appendChild(closeBtn);
      monthCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      monthCard.appendChild(monthRow);
      container.appendChild(monthCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      if (ensure && ensure.showReminder && selectedMonth === UI.formatDateISO(new Date()).slice(0, 7)) {
        var banner = UI.el("div", { className: "card tile" }, []);
        banner.appendChild(UI.el("div", { className: "tile__label", text: "Reminder" }, []));
        banner.appendChild(UI.el("div", { className: "tile__value", text: "Monat ausfüllen" }, []));
        banner.appendChild(UI.el("div", { className: "ui-text", text: "Lege fixe Items fest und wende sie einmalig auf den Monat an." }, []));
        banner.appendChild(UI.el("div", { style: "height:10px" }, []));

        var br = UI.el("div", { className: "row" }, []);
        var dismiss = UI.el("button", { className: "btn", type: "button", text: "Dismiss" }, []);
        dismiss.addEventListener("click", function () {
          State.financeDismissReminder(selectedMonth).then(function () {
            UI.toast("Dismissed");
            Router.go("finance", { month: selectedMonth });
          });
        });
        br.appendChild(dismiss);
        banner.appendChild(br);

        container.appendChild(banner);
        container.appendChild(UI.el("div", { style: "height:12px" }, []));
      }

      // Summary
      var summary = await computeMonthSummary(selectedMonth);
      var summaryCard = UI.el("div", { className: "card tile" }, []);
      summaryCard.appendChild(UI.el("div", { className: "tile__label", text: "Summary" }, []));
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

      // Categories
      var catCard = UI.el("div", { className: "card tile" }, []);
      catCard.appendChild(UI.el("div", { className: "tile__label", text: "Categories" }, []));
      catCard.appendChild(UI.el("div", { className: "ui-text", text: "Kategorien sind Pflicht für sauberes Tracking." }, []));
      catCard.appendChild(UI.el("div", { style: "height:10px" }, []));

      var catRow = UI.el("div", { className: "row" }, []);
      var addCat = UI.el("button", { className: "btn", type: "button", text: "Add Category" }, []);
      addCat.addEventListener("click", function () { addCategoryFlow(); });
      var listCat = UI.el("button", { className: "btn", type: "button", text: "Manage Categories" }, []);
      listCat.addEventListener("click", function () { manageCategoriesFlow(); });

      catRow.appendChild(addCat);
      catRow.appendChild(listCat);
      catCard.appendChild(catRow);
      container.appendChild(catCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Fixed Items
      var fixedCard = UI.el("div", { className: "card tile" }, []);
      fixedCard.appendChild(UI.el("div", { className: "tile__label", text: "Fixe Einnahmen/Ausgaben" }, []));
      fixedCard.appendChild(UI.el("div", { className: "ui-text", text: "Einmal pro Monat anwenden → Transactions werden erzeugt." }, []));
      fixedCard.appendChild(UI.el("div", { style: "height:10px" }, []));

      var fixedRow = UI.el("div", { className: "row" }, []);
      var addFixed = UI.el("button", { className: "btn", type: "button", text: "Add Fixed Item" }, []);
      addFixed.addEventListener("click", function () { addFixedItemFlow(); });

      var applyFixed = UI.el("button", { className: "btn", type: "button", text: "Apply Fixed to Month" }, []);
      applyFixed.addEventListener("click", function () { applyFixedFlow(selectedMonth); });

      fixedRow.appendChild(addFixed);
      fixedRow.appendChild(applyFixed);
      fixedCard.appendChild(fixedRow);
      fixedCard.appendChild(UI.el("div", { style: "height:12px" }, []));
      await renderFixedItems(fixedCard);
      container.appendChild(fixedCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Add Tx + Gatekeeper
      var actions = UI.el("div", { className: "card tile" }, []);
      actions.appendChild(UI.el("div", { className: "tile__label", text: "Actions" }, []));
      actions.appendChild(UI.el("div", { style: "height:10px" }, []));
      var ar = UI.el("div", { className: "row" }, []);
      var addTx = UI.el("button", { className: "btn", type: "button", text: "Add Transaction" }, []);
      addTx.addEventListener("click", function () { addTransactionFlow(selectedMonth); });
      var addGk = UI.el("button", { className: "btn", type: "button", text: "Add Gatekeeper" }, []);
      addGk.addEventListener("click", function () { addGatekeeperFlow(summary.remaining); });
      ar.appendChild(addTx);
      ar.appendChild(addGk);
      actions.appendChild(ar);
      container.appendChild(actions);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Transactions list
      var txCard = UI.el("div", { className: "card tile" }, []);
      txCard.appendChild(UI.el("div", { className: "tile__label", text: "Transactions" }, []));
      await renderTransactions(txCard, selectedMonth);
      container.appendChild(txCard);

      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Gatekeeper list
      var gkCard = UI.el("div", { className: "card tile" }, []);
      gkCard.appendChild(UI.el("div", { className: "tile__label", text: "Gatekeeper (72h)" }, []));
      await renderGatekeepers(gkCard, summary.remaining);
      container.appendChild(gkCard);

      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Reports
      var repCard = UI.el("div", { className: "card tile" }, []);
      repCard.appendChild(UI.el("div", { className: "tile__label", text: "Reports" }, []));
      repCard.appendChild(UI.el("div", { className: "ui-text", text: "Close Month erzeugt und archiviert automatisch." }, []));
      repCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      var rr = UI.el("div", { className: "row" }, []);
      var openArchive = UI.el("button", { className: "btn", type: "button", text: "Open Report Archive" }, []);
      openArchive.addEventListener("click", function () { openArchiveFlow(); });
      rr.appendChild(openArchive);
      repCard.appendChild(rr);
      container.appendChild(repCard);

      // --- helpers ---
      async function pickMonth(current) {
        var v = await UI.prompt("Select Month", "YYYY-MM", current, "2026-02");
        if (v === null) return;
        v = v.trim();
        if (!/^\d{4}-\d{2}$/.test(v)) { UI.toast("Invalid month"); return; }
        Router.go("finance", { month: v });
      }
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

  async function pickCategory(type) {
    var cats = await State.listFinanceCategories(type);
    if (!cats.length) return null;

    var body = "<div class='ui-text'>Pick a category:</div><div style='height:10px'></div>";
    for (var i = 0; i < cats.length; i++) {
      body += "<div class='ui-text'>• " + UI.escapeHtml(cats[i].name) + "</div>";
    }
    body += "<div style='height:10px'></div><div class='ui-text'>Enter exact name:</div>";

    var name = await UI.prompt("Category", "Name", cats[0].name, "");
    if (name === null) return null;
    name = name.trim();

    for (var j = 0; j < cats.length; j++) {
      if (cats[j].name === name) return cats[j];
    }
    UI.toast("Category not found");
    return null;
  }

  async function addTransactionFlow(month) {
    var type = await chooseType();
    if (!type) return;

    var cat = await pickCategory(type);
    if (!cat) { UI.toast("Create category first"); return; }

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
      categoryId: cat.id,
      name: (name || "").trim(),
      amount: amt,
      fixed: fixed
    });

    UI.toast("Transaction added");
    Router.go("finance", { month: month });
  }

  async function editTransactionFlow(month, t) {
    var type = await chooseType();
    if (!type) return;

    var cat = await pickCategory(type);
    if (!cat) { UI.toast("Create category first"); return; }

    var name = await UI.prompt("Edit Transaction", "Name", t.name || "", "");
    if (name === null) return;

    var amtStr = await UI.prompt("Edit Transaction", "Amount (CHF)", String(t.amount || ""), "");
    if (amtStr === null) return;
    var amt = Number(String(amtStr).replace(",", "."));
    if (isNaN(amt)) { UI.toast("Invalid amount"); return; }

    var fixed = await UI.confirm("Fixed?", "Set fixed?");
    t.type = type;
    t.categoryId = cat.id;
    t.name = (name || "").trim();
    t.amount = amt;
    t.fixed = fixed;

    await State.updateTransaction(t);
    UI.toast("Saved");
    Router.go("finance", { month: month });
  }

  async function renderTransactions(card, month) {
    var txs = await State.listTransactionsByMonth(month);
    if (!txs.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No transactions yet." }, []));
      return;
    }

    // Category name cache
    var catNameCache = {};
    async function catName(id) {
      if (id === null || id === undefined) return "—";
      if (catNameCache[id]) return catNameCache[id];
      var c = await State.getFinanceCategory(id);
      catNameCache[id] = c ? c.name : "—";
      return catNameCache[id];
    }

    for (var i = 0; i < txs.length; i++) {
      var t = txs[i];
      var cname = await catName(t.categoryId);

      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text", text:
          (t.type === "income" ? "↑ " : "↓ ") +
          (t.name || "—") +
          " · " + cname +
          " · CHF " + formatMoney(t.amount) +
          (t.fixed ? " (fixed)" : "")
        }, [])
      ]);

      (function (tx) {
        left.addEventListener("click", function () { editTransactionFlow(month, tx); });
      })(t);

      var right = UI.el("div", { className: "todo-right" }, []);
      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      (function (id) {
        del.addEventListener("click", function () {
          UI.confirm("Delete", "Delete this transaction?").then(function (ok) {
            if (!ok) return;
            State.deleteTransaction(id).then(function () {
              UI.toast("Deleted");
              Router.go("finance", { month: month });
            });
          });
        });
      })(t.id);

      right.appendChild(del);
      row.appendChild(left);
      row.appendChild(right);

      card.appendChild(UI.el("div", { style: "height:10px" }, []));
      card.appendChild(row);
    }
  }

  async function chooseType() {
    return new Promise(function (resolve) {
      UI.modal({
        title: "Type",
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

  // ---- Categories management ----
  async function addCategoryFlow() {
    var type = await chooseType();
    if (!type) return;

    var name = await UI.prompt("Add Category", "Name", "", "e.g. Rent");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    var orderStr = await UI.prompt("Add Category", "Order (number)", "50", "50");
    if (orderStr === null) return;
    var order = Number(String(orderStr).trim());
    if (isNaN(order)) order = 999;

    await State.addFinanceCategory({ type: type, name: name, order: order });
    UI.toast("Category added");
    Router.go("finance", {});
  }

  async function manageCategoriesFlow() {
    var type = await chooseType();
    if (!type) return;

    var cats = await State.listFinanceCategories(type);
    if (!cats.length) { UI.toast("No categories"); return; }

    var html = "<div class='ui-text'>Categories (" + type + "):</div><div style='height:10px'></div>";
    for (var i = 0; i < cats.length; i++) {
      html += "<div class='ui-text'>• " + UI.escapeHtml(cats[i].name) + " (order " + (cats[i].order || 0) + ")</div>";
    }
    html += "<div style='height:10px'></div><div class='ui-text'>Enter exact name to edit/delete:</div>";

    var pick = await UI.prompt("Manage Categories", "Name", cats[0].name, "");
    if (pick === null) return;
    pick = pick.trim();

    var found = null;
    for (var j = 0; j < cats.length; j++) {
      if (cats[j].name === pick) { found = cats[j]; break; }
    }
    if (!found) { UI.toast("Not found"); return; }

    UI.modal({
      title: "Category",
      bodyHtml: "<div class='ui-text'>" + UI.escapeHtml(found.name) + "</div>",
      buttons: [
        { text: "Edit", value: "edit", primary: true },
        { text: "Delete", value: "delete" },
        { text: "Close", value: "close" }
      ],
      onClose: function (v) {
        if (v === "edit") editCategoryFlow(found);
        if (v === "delete") deleteCategoryFlow(found);
      }
    });
  }

  async function editCategoryFlow(cat) {
    var name = await UI.prompt("Edit Category", "Name", cat.name || "", "");
    if (name === null) return;

    var orderStr = await UI.prompt("Edit Category", "Order (number)", String(cat.order || 0), "");
    if (orderStr === null) return;
    var order = Number(String(orderStr).trim());
    if (isNaN(order)) order = cat.order || 999;

    cat.name = (name || "").trim() || cat.name;
    cat.order = order;

    await State.updateFinanceCategory(cat);
    UI.toast("Saved");
    Router.go("finance", {});
  }

  async function deleteCategoryFlow(cat) {
    var ok = await UI.confirm("Delete Category", "Delete category '" + cat.name + "'? (Transactions keep categoryId but name may show as —)");
    if (!ok) return;
    await State.deleteFinanceCategory(cat.id);
    UI.toast("Deleted");
    Router.go("finance", {});
  }

  // ---- Fixed Items ----
  async function renderFixedItems(card) {
    var items = await State.financeListFixedItems();
    if (!items.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "Noch keine fixen Items." }, []));
      return;
    }

    // quick cache for category names
    var catNameCache = {};
    async function cname(id) {
      if (id === null || id === undefined) return "—";
      if (catNameCache[id]) return catNameCache[id];
      var c = await State.getFinanceCategory(id);
      catNameCache[id] = c ? c.name : "—";
      return catNameCache[id];
    }

    for (var i = 0; i < items.length; i++) {
      var fi = items[i];
      var labelCat = await cname(fi.categoryId);

      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text", text:
          (fi.type === "income" ? "↑ " : "↓ ") + (fi.name || "—") + " · " + labelCat + " · CHF " + formatMoney(fi.amount)
        }, [])
      ]);

      (function (x) {
        left.addEventListener("click", function () { editFixedItemFlow(x); });
      })(fi);

      var right = UI.el("div", { className: "todo-right" }, []);
      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      (function (id) {
        del.addEventListener("click", function () {
          UI.confirm("Delete Fixed Item", "Delete this fixed item?").then(function (ok) {
            if (!ok) return;
            State.financeDeleteFixedItem(id).then(function () {
              UI.toast("Deleted");
              Router.go("finance", {});
            });
          });
        });
      })(fi.id);

      right.appendChild(del);
      row.appendChild(left);
      row.appendChild(right);

      card.appendChild(UI.el("div", { style: "height:10px" }, []));
      card.appendChild(row);
    }
  }

  async function addFixedItemFlow() {
    var type = await chooseType();
    if (!type) return;

    var cat = await pickCategory(type);
    if (!cat) { UI.toast("Create category first"); return; }

    var name = await UI.prompt("Fixed Item", "Name", "", "e.g. Rent / Salary");
    if (name === null) return;

    var amtStr = await UI.prompt("Fixed Item", "Amount (CHF)", "", "e.g. 1200");
    if (amtStr === null) return;
    var amt = Number(String(amtStr).replace(",", "."));
    if (isNaN(amt)) { UI.toast("Invalid amount"); return; }

    await State.financeAddFixedItem({ type: type, categoryId: cat.id, name: (name || "").trim(), amount: amt });
    UI.toast("Fixed item added");
    Router.go("finance", {});
  }

  async function editFixedItemFlow(fi) {
    var type = await chooseType();
    if (!type) return;

    var cat = await pickCategory(type);
    if (!cat) { UI.toast("Create category first"); return; }

    var name = await UI.prompt("Edit Fixed Item", "Name", fi.name || "", "");
    if (name === null) return;

    var amtStr = await UI.prompt("Edit Fixed Item", "Amount (CHF)", String(fi.amount || ""), "");
    if (amtStr === null) return;
    var amt = Number(String(amtStr).replace(",", "."));
    if (isNaN(amt)) { UI.toast("Invalid amount"); return; }

    await State.financeUpdateFixedItem({ id: fi.id, type: type, categoryId: cat.id, name: (name || "").trim(), amount: amt });
    UI.toast("Saved");
    Router.go("finance", {});
  }

  async function applyFixedFlow(month) {
    UI.confirm("Apply Fixed", "Apply fixed items to " + month + " as transactions? (only once per month)").then(function (ok) {
      if (!ok) return;
      State.financeApplyFixedForMonth(month).then(function (res) {
        if (res && res.applied) UI.toast("Applied: " + res.count + " items");
        else UI.toast("Not applied: " + (res.reason || "unknown"));
        Router.go("finance", { month: month });
      });
    });
  }

  // ---- Close Month / Reports ----
  async function closeMonthFlow(month) {
    var ok = await UI.confirm("Close Month", "Close " + month + "? This creates a report snapshot and marks month as closed.");
    if (!ok) return;

    var res = await State.financeCloseMonth(month);
    if (res && res.closed) {
      UI.toast("Month closed + report archived");
    } else {
      UI.toast("Not closed: " + (res.reason || "unknown"));
    }
    Router.go("finance", { month: month });
  }

  async function openArchiveFlow() {
    var reps = await State.financeListReports();
    if (!reps.length) { UI.toast("No reports"); return; }

    var body = "<div class='ui-text'>Saved reports:</div><div style='height:10px'></div>";
    for (var i = 0; i < reps.length; i++) {
      body += "<div class='ui-text'>• " + UI.escapeHtml(reps[i].month) + " — Remaining CHF " + formatMoney(reps[i].totals.remaining) + "</div>";
    }
    body += "<div style='height:10px'></div><div class='ui-text'>Enter month (YYYY-MM):</div>";

    var picked = await UI.prompt("Report Archive", "Month (YYYY-MM)", reps[0].month || "", "2026-02");
    if (picked === null) return;
    var m = picked.trim();
    if (!/^\d{4}-\d{2}$/.test(m)) { UI.toast("Invalid month"); return; }

    var rep = await State.financeGetReport(m);
    if (!rep) { UI.toast("Not found"); return; }

    var repHtml =
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
      bodyHtml: repHtml,
      buttons: [{ text: "Close", value: "close", primary: true }],
      onClose: function () {}
    });
  }

  // ---- Gatekeeper (unchanged UX) ----
  async function addGatekeeperFlow(remaining) {
    var name = await UI.prompt("Gatekeeper", "Name", "", "e.g. Headphones");
    if (name === null) return;

    var priceStr = await UI.prompt("Gatekeeper", "Price (CHF)", "", "e.g. 199");
    if (priceStr === null) return;
    var price = Number(String(priceStr).replace(",", "."));
    if (isNaN(price)) { UI.toast("Invalid price"); return; }

    if (typeof remaining === "number" && price > remaining) UI.toast("Warning: price > remaining");

    // category is optional; user can set later (not exposed here yet)
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
