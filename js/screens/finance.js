// js/screens/finance.js
// PERSONAL OS — Finance + Gatekeeper

ScreenRegistry.register("finance", {

  async mount(container, ctx) {

    try {

      container.innerHTML = "";

      const today = new Date().toISOString().split("T")[0];
      const monthKey = today.slice(0, 7);

      const root = document.createElement("div");
      root.className = "finance";

      const title = document.createElement("h2");
      title.innerText = "Finance";
      root.appendChild(title);

      // ===== LOAD DATA =====
      const db = await State.openDB();

      const categories = await new Promise(resolve => {
        const tx = db.transaction("financeCategories", "readonly");
        const req = tx.objectStore("financeCategories").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      const transactions = await new Promise(resolve => {
        const tx = db.transaction("financeTransactions", "readonly");
        const index = tx.objectStore("financeTransactions").index("month");
        const req = index.getAll(monthKey);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      let income = 0;
      let expense = 0;

      transactions.forEach(t => {
        const amt = Number(t.amount || 0);
        if (t.type === "income") income += amt;
        if (t.type === "expense") expense += amt;
      });

      const remaining = income - expense;

      const summary = document.createElement("div");
      summary.innerHTML = `
        <div>Income: ${income}</div>
        <div>Expense: ${expense}</div>
        <div><strong>Remaining: ${remaining}</strong></div>
      `;
      root.appendChild(summary);

      // ===== ADD TRANSACTION =====
      const typeSelect = document.createElement("select");
      typeSelect.innerHTML = `
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      `;

      const catSelect = document.createElement("select");

      function populateCategories(type) {
        catSelect.innerHTML = "";
        categories
          .filter(c => c.type === type)
          .forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.innerText = c.name;
            catSelect.appendChild(opt);
          });
      }

      populateCategories("expense");

      typeSelect.onchange = function () {
        populateCategories(typeSelect.value);
      };

      const amountInput = document.createElement("input");
      amountInput.placeholder = "Amount";

      const addBtn = document.createElement("button");
      addBtn.innerText = "Add Transaction";

      addBtn.onclick = async function () {

        const amt = Number(amountInput.value || 0);
        const catId = Number(catSelect.value);
        const type = typeSelect.value;

        if (!amt || !catId) return;

        await new Promise(resolve => {
          const tx = db.transaction("financeTransactions", "readwrite");
          tx.objectStore("financeTransactions").add({
            date: today,
            month: monthKey,
            type,
            categoryId: catId,
            amount: amt
          });
          tx.oncomplete = () => resolve(true);
        });

        Router.go("finance");
      };

      root.appendChild(typeSelect);
      root.appendChild(catSelect);
      root.appendChild(amountInput);
      root.appendChild(addBtn);

      // ===== GATEKEEPER =====
      const gkTitle = document.createElement("h3");
      gkTitle.innerText = "Gatekeeper";
      root.appendChild(gkTitle);

      const items = await new Promise(resolve => {
        const tx = db.transaction("gatekeeperItems", "readonly");
        const req = tx.objectStore("gatekeeperItems").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      const list = document.createElement("div");

      items.sort((a, b) => b.createdAt - a.createdAt);

      items.forEach(item => {

        const row = document.createElement("div");
        const unlockIn = Math.max(0, Math.ceil((item.unlockAt - Date.now()) / (1000*60*60)));
        const eligible = Date.now() >= item.unlockAt;

        row.innerHTML = `
          <div><strong>${item.name}</strong> (${item.price})</div>
          <div>${eligible ? "Eligible" : "Locked " + unlockIn + "h"}</div>
        `;

        if (eligible && item.status !== "purchased") {

          const buyBtn = document.createElement("button");
          buyBtn.innerText = "Bought";

          buyBtn.onclick = async function () {

            const tx = db.transaction(["gatekeeperItems", "financeTransactions"], "readwrite");

            tx.objectStore("gatekeeperItems").put({
              ...item,
              status: "purchased",
              purchasedAt: Date.now()
            });

            tx.objectStore("financeTransactions").add({
              date: today,
              month: monthKey,
              type: "expense",
              categoryId: item.categoryId,
              amount: Number(item.price || 0)
            });

            tx.oncomplete = () => Router.go("finance");
          };

          row.appendChild(buyBtn);
        }

        list.appendChild(row);
      });

      root.appendChild(list);

      // ===== ADD GATEKEEPER ITEM =====
      const nameInput = document.createElement("input");
      nameInput.placeholder = "Item name";

      const priceInput = document.createElement("input");
      priceInput.placeholder = "Price";

      const gkCatSelect = document.createElement("select");
      categories
        .filter(c => c.type === "expense")
        .forEach(c => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.innerText = c.name;
          gkCatSelect.appendChild(opt);
        });

      const addGkBtn = document.createElement("button");
      addGkBtn.innerText = "Add Gatekeeper Item";

      addGkBtn.onclick = async function () {

        const name = nameInput.value.trim();
        const price = Number(priceInput.value || 0);
        const catId = Number(gkCatSelect.value);

        if (!name || !price || !catId) return;

        const now = Date.now();

        await new Promise(resolve => {
          const tx = db.transaction("gatekeeperItems", "readwrite");
          tx.objectStore("gatekeeperItems").add({
            name,
            price,
            categoryId: catId,
            createdAt: now,
            unlockAt: now + 72 * 60 * 60 * 1000,
            status: "locked"
          });
          tx.oncomplete = () => resolve(true);
        });

        Router.go("finance");
      };

      root.appendChild(nameInput);
      root.appendChild(priceInput);
      root.appendChild(gkCatSelect);
      root.appendChild(addGkBtn);

      container.appendChild(root);

    } catch (e) {
      console.error("Finance mount error", e);
      container.innerHTML = "<div class='error'>Finance failed</div>";
    }

  }

});
