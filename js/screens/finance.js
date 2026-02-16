// js/screens/finance.js
// PERSONAL OS — Finance + Category Management + Gatekeeper (State-first, no direct IndexedDB)
// Anforderungen umgesetzt:
// A) Category Management: Income/Expense hinzufügen + Löschen (minimal)
// B) Monatsübersicht: Income/Expense/Remaining + Remaining% + Progressbar
// C) Gatekeeper: 72h Countdown, Eligible Anzeige, Budget Impact (% vom Remaining),
//    Warnung wenn Preis > Remaining, "Gekauft" erzeugt Transaction
// D) Router params: focus="addTransaction" | "addGatekeeper"

ScreenRegistry.register("finance", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const today = State.getTodayKey();
      const monthKey = today.slice(0, 7);

      const focus = String(Router.getParam("focus") || "");
      if (focus) Router.clearParams();

      const root = document.createElement("div");
      root.className = "finance";

      const title = document.createElement("h2");
      title.textContent = "Finance";
      root.appendChild(title);

      // ===== Monthly Summary =====
      const summary = await State.getMonthlySummary(monthKey);
      const sumCard = document.createElement("div");
      sumCard.className = "dash-card";

      const income = Number(summary.income || 0);
      const expense = Number(summary.expense || 0);
      const remaining = Number(summary.remaining || 0);
      const spentPct = clampPct(summary.spentPct);
      const remainingPct = clampPct(summary.remainingPct);

      sumCard.innerHTML = `
        <div class="dash-meta">Month</div>
        <div style="font-size:14px; font-weight:900; margin-top:6px;">${escapeHtml(summary.month || monthKey)}</div>

        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px;">
          <div style="flex:1; min-width:140px;">
            <div class="dash-meta">Income</div>
            <div style="font-size:18px; font-weight:900; margin-top:6px;">${formatMoney(income)}</div>
          </div>
          <div style="flex:1; min-width:140px;">
            <div class="dash-meta">Expense</div>
            <div style="font-size:18px; font-weight:900; margin-top:6px;">${formatMoney(expense)}</div>
          </div>
        </div>

        <div style="margin-top:12px;">
          <div class="dash-meta">Remaining</div>
          <div style="font-size:22px; font-weight:950; margin-top:6px;">${formatMoney(remaining)}</div>
          <div style="font-size:12px; opacity:0.75; margin-top:4px;">
            Spent ${spentPct}% · Remaining ${remainingPct}%
          </div>
          <div style="height:10px; background: rgba(18,18,18,0.08); border-radius: 999px; overflow:hidden; margin-top:10px;">
            <div style="height:10px; width:${spentPct}%; background: rgba(18,18,18,0.35);"></div>
          </div>
        </div>
      `;
      root.appendChild(sumCard);

      // ===== Load Categories (State) =====
      const categories = await State.listFinanceCategories();

      // ===== Add Transaction =====
      const txnCard = document.createElement("div");
      txnCard.className = "dash-card";
      txnCard.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Add Transaction</div>`;

      const typeSelect = document.createElement("select");
      typeSelect.innerHTML = `
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      `;

      const catSelect = document.createElement("select");
      const amountInput = document.createElement("input");
      amountInput.placeholder = "Amount";
      amountInput.inputMode = "decimal";

      function populateCategories(type) {
        catSelect.innerHTML = "";
        const list = (categories || []).filter((c) => String(c.type) === String(type));
        if (list.length === 0) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "No categories";
          catSelect.appendChild(opt);
          catSelect.disabled = true;
          return;
        }
        catSelect.disabled = false;
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          const opt2 = document.createElement("option");
          opt2.value = String(c.id);
          opt2.textContent = String(c.name || "");
          catSelect.appendChild(opt2);
        }
      }

      populateCategories("expense");
      typeSelect.onchange = function () { populateCategories(typeSelect.value); };

      const addTxnBtn = document.createElement("button");
      addTxnBtn.type = "button";
      addTxnBtn.textContent = "Add";

      const txnMsg = document.createElement("div");
      txnMsg.style.fontSize = "13px";
      txnMsg.style.opacity = "0.75";
      txnMsg.style.marginTop = "8px";

      addTxnBtn.onclick = async function () {
        txnMsg.textContent = "";

        const type = String(typeSelect.value || "expense");
        const catId = Number(catSelect.value || 0);
        const amt = Number(String(amountInput.value || "").replace(",", "."));

        if (!amt || amt <= 0 || !catId) {
          txnMsg.textContent = "Bitte Amount + Category wählen.";
          return;
        }

        const id = await State.addTransaction({
          date: today,
          month: monthKey,
          type: type,
          categoryId: catId,
          amount: amt
        });

        if (!id) {
          txnMsg.textContent = "Konnte Transaction nicht speichern.";
          return;
        }

        amountInput.value = "";
        txnMsg.textContent = "Gespeichert.";
        Router.go("finance");
      };

      txnCard.appendChild(typeSelect);
      txnCard.appendChild(catSelect);
      txnCard.appendChild(amountInput);
      txnCard.appendChild(addTxnBtn);
      txnCard.appendChild(txnMsg);
      root.appendChild(txnCard);

      // Auto-focus for dashboard quick action
      if (focus === "addTransaction") {
        try { amountInput.focus(); } catch (_) {}
      }

      // ===== Category Management =====
      const catCard = document.createElement("div");
      catCard.className = "dash-card";
      catCard.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Categories</div>`;

      const catType = document.createElement("select");
      catType.innerHTML = `
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      `;

      const catName = document.createElement("input");
      catName.placeholder = "New category name";

      const addCatBtn = document.createElement("button");
      addCatBtn.type = "button";
      addCatBtn.textContent = "Add Category";

      const catMsg = document.createElement("div");
      catMsg.style.fontSize = "13px";
      catMsg.style.opacity = "0.75";
      catMsg.style.marginTop = "8px";

      addCatBtn.onclick = async function () {
        catMsg.textContent = "";
        const t = String(catType.value || "expense");
        const name = String(catName.value || "").trim();
        if (!name) { catMsg.textContent = "Name fehlt."; return; }

        const id = await State.addFinanceCategory({ type: t, name: name, order: 999 });
        if (!id) { catMsg.textContent = "Konnte Kategorie nicht speichern."; return; }

        catName.value = "";
        catMsg.textContent = "Kategorie gespeichert.";
        Router.go("finance");
      };

      catCard.appendChild(catType);
      catCard.appendChild(catName);
      catCard.appendChild(addCatBtn);
      catCard.appendChild(catMsg);

      // List existing categories (minimal delete)
      const listWrap = document.createElement("div");
      listWrap.style.marginTop = "10px";

      if (!categories || categories.length === 0) {
        const empty = document.createElement("div");
        empty.style.fontSize = "13px";
        empty.style.opacity = "0.75";
        empty.textContent = "Keine Kategorien gefunden.";
        listWrap.appendChild(empty);
      } else {
        const grouped = { income: [], expense: [] };
        for (let i = 0; i < categories.length; i++) {
          const c = categories[i];
          const t = String(c.type || "");
          if (t === "income") grouped.income.push(c);
          else grouped.expense.push(c);
        }

        function renderGroup(name, arr) {
          const h = document.createElement("div");
          h.style.fontWeight = "900";
          h.style.marginTop = "10px";
          h.textContent = name;
          listWrap.appendChild(h);

          for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            const row = document.createElement("div");
            row.className = "todo-row";

            const left = document.createElement("span");
            left.textContent = String(c.name || "");

            const del = document.createElement("button");
            del.type = "button";
            del.textContent = "Delete";
            del.style.marginTop = "0";
            del.onclick = async function () {
              // Minimal: delete only if your State supports it; otherwise no-op message.
              if (typeof State.deleteFinanceCategory !== "function") {
                alert("DeleteFinanceCategory fehlt in State. Kommt in der nächsten State-Version.");
                return;
              }
              const ok = await State.deleteFinanceCategory(c.id);
              if (!ok) { alert("Löschen fehlgeschlagen."); return; }
              Router.go("finance");
            };

            row.appendChild(left);
            row.appendChild(del);
            listWrap.appendChild(row);
          }
        }

        renderGroup("Expense", grouped.expense);
        renderGroup("Income", grouped.income);
      }

      catCard.appendChild(listWrap);
      root.appendChild(catCard);

      // ===== Gatekeeper =====
      const gkCard = document.createElement("div");
      gkCard.className = "dash-card";
      gkCard.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Gatekeeper</div>`;

      // counts
      const counts = await State.getGatekeeperCounts();
      const countsDiv = document.createElement("div");
      countsDiv.style.fontSize = "13px";
      countsDiv.style.opacity = "0.85";
      countsDiv.textContent =
        "Locked: " + Number(counts.locked || 0) +
        " · Eligible: " + Number(counts.eligible || 0) +
        " · Purchased: " + Number(counts.purchased || 0);
      gkCard.appendChild(countsDiv);

      // list
      const items = await State.listGatekeeper();
      const list = document.createElement("div");
      list.style.marginTop = "10px";

      if (!items || items.length === 0) {
        const empty = document.createElement("div");
        empty.style.fontSize = "13px";
        empty.style.opacity = "0.75";
        empty.textContent = "Keine Gatekeeper Items. Füge eines hinzu.";
        list.appendChild(empty);
      } else {
        const now = Date.now();
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (!it) continue;

          const unlockAt = Number(it.unlockAt || 0);
          const eligible = now >= unlockAt;
          const statusTxt = String(it.status || "locked");

          const row = document.createElement("div");
          row.className = "vault-card";

          const price = Number(it.price || 0);
          const impactPct = remaining > 0 ? clampPct(Math.round((price / remaining) * 100)) : 0;

          const countdown = eligible ? "Eligible" : ("Locked · " + formatHoursLeft(unlockAt - now));
          const warn = (remaining >= 0 && price > remaining) ? "WARNUNG: Preis > Remaining" : "";

          row.innerHTML = `
            <div style="display:flex; justify-content:space-between; gap:10px;">
              <div><strong>${escapeHtml(it.name || "")}</strong></div>
              <div style="font-weight:900;">${formatMoney(price)}</div>
            </div>
            <div style="font-size:12px; opacity:0.75; margin-top:6px;">
              ${escapeHtml(countdown)} · Impact: ${impactPct}%
            </div>
            ${warn ? `<div style="font-size:12px; margin-top:6px; color:#5b0f0a; font-weight:800;">${escapeHtml(warn)}</div>` : ``}
          `;

          // Buy button if eligible and not purchased
          if (eligible && statusTxt !== "purchased") {
            const buyBtn = document.createElement("button");
            buyBtn.type = "button";
            buyBtn.textContent = "Gekauft";
            buyBtn.onclick = async function () {
              // Update item + create expense txn
              const updated = Object.assign({}, it, { status: "purchased", purchasedAt: Date.now() });
              const ok1 = await State.updateGatekeeperItem(updated);
              if (!ok1) { alert("Gatekeeper Update fehlgeschlagen."); return; }

              const ok2 = await State.addTransaction({
                date: today,
                month: monthKey,
                type: "expense",
                categoryId: Number(it.categoryId || 0),
                amount: Number(it.price || 0)
              });

              if (!ok2) { alert("Transaction konnte nicht erstellt werden."); return; }

              Router.go("finance");
            };
            row.appendChild(buyBtn);
          }

          list.appendChild(row);
        }
      }

      gkCard.appendChild(list);

      // Add GK item UI
      const addWrap = document.createElement("div");
      addWrap.style.marginTop = "12px";
      addWrap.style.fontWeight = "900";
      addWrap.textContent = "Add Gatekeeper Item";
      gkCard.appendChild(addWrap);

      const nameInput = document.createElement("input");
      nameInput.placeholder = "Item name";

      const priceInput = document.createElement("input");
      priceInput.placeholder = "Price";
      priceInput.inputMode = "decimal";

      const gkCatSelect = document.createElement("select");
      // expense cats only
      const expCats = (categories || []).filter((c) => String(c.type) === "expense");
      if (expCats.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No expense categories";
        gkCatSelect.appendChild(opt);
        gkCatSelect.disabled = true;
      } else {
        for (let i = 0; i < expCats.length; i++) {
          const c = expCats[i];
          const opt2 = document.createElement("option");
          opt2.value = String(c.id);
          opt2.textContent = String(c.name || "");
          gkCatSelect.appendChild(opt2);
        }
      }

      const addGkBtn = document.createElement("button");
      addGkBtn.type = "button";
      addGkBtn.textContent = "Add";

      const gkMsg = document.createElement("div");
      gkMsg.style.fontSize = "13px";
      gkMsg.style.opacity = "0.75";
      gkMsg.style.marginTop = "8px";

      addGkBtn.onclick = async function () {
        gkMsg.textContent = "";

        const nm = String(nameInput.value || "").trim();
        const pr = Number(String(priceInput.value || "").replace(",", "."));
        const catId = Number(gkCatSelect.value || 0);

        if (!nm || !pr || pr <= 0 || !catId) {
          gkMsg.textContent = "Bitte Name + Price + Category wählen.";
          return;
        }

        // Warning if exceeds remaining (still allow)
        if (remaining >= 0 && pr > remaining) {
          gkMsg.textContent = "Warnung: Preis > Remaining. Item wird trotzdem angelegt.";
        }

        const id = await State.addGatekeeperItem({ name: nm, price: pr, categoryId: catId });
        if (!id) {
          gkMsg.textContent = "Konnte Gatekeeper Item nicht speichern.";
          return;
        }

        nameInput.value = "";
        priceInput.value = "";
        gkMsg.textContent = "Gespeichert.";
        Router.go("finance");
      };

      gkCard.appendChild(nameInput);
      gkCard.appendChild(priceInput);
      gkCard.appendChild(gkCatSelect);
      gkCard.appendChild(addGkBtn);
      gkCard.appendChild(gkMsg);

      root.appendChild(gkCard);

      // Auto-focus for dashboard quick action
      if (focus === "addGatekeeper") {
        try { nameInput.focus(); } catch (_) {}
      }

      container.appendChild(root);

    } catch (e) {
      console.error("Finance mount error", e);
      container.innerHTML = "<div class='error'>Finance failed</div>";
    }

    function clampPct(n) {
      const x = Number(n || 0);
      if (x < 0) return 0;
      if (x > 100) return 100;
      return Math.round(x);
    }

    function formatHoursLeft(ms) {
      const h = Math.max(0, Math.ceil(Number(ms || 0) / (1000 * 60 * 60)));
      return h + "h";
    }

    function formatMoney(n) {
      const v = Number(n || 0);
      const sign = v < 0 ? "-" : "";
      const abs = Math.abs(v);
      const s = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
      return sign + s;
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }
});
