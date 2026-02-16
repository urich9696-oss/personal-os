// js/screens/dashboard.js
// PERSONAL OS — Dashboard (Command Engine)

ScreenRegistry.register("dashboard", {

  async mount(container, ctx) {

    try {

      container.innerHTML = "";

      const today = new Date().toISOString().split("T")[0];
      const status = await State.getDayStatus();

      const root = document.createElement("div");
      root.className = "dashboard";

      // ===== HEADER =====
      const header = document.createElement("div");
      header.className = "dash-header";
      header.innerHTML = `
        <div class="dash-title">Personal OS</div>
        <div class="dash-sub">The Architecture of Excellence.</div>
      `;

      // ===== STATUS =====
      const statusBlock = document.createElement("div");
      statusBlock.className = "dash-card";

      statusBlock.innerHTML = `
        <div class="dash-meta">Today</div>
        <div class="dash-date">${today}</div>
        <div class="dash-status">${status.toUpperCase()}</div>
      `;

      // ===== PERFORMANCE =====
      let performance = 0;

      try {
        const journal = await new Promise(resolve => {
          const tx = State.openDB ? null : null;
        });
      } catch (_) {}

      // We calculate performance from journalEntries
      const journal = await new Promise(resolve => {
        const tx = window.indexedDB
          .open("personalOS");

        tx.onsuccess = function (e) {
          const db = e.target.result;
          const t = db.transaction("journalEntries", "readonly");
          const store = t.objectStore("journalEntries");
          const req = store.get(today);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        };
      });

      if (journal?.morning?.todos) {
        const total = journal.morning.todos.length;
        const done = journal.morning.todos.filter(t => t.done).length;
        performance = total === 0 ? 0 : Math.round((done / total) * 100);
      }

      const perfBlock = document.createElement("div");
      perfBlock.className = "dash-card";
      perfBlock.innerHTML = `
        <div class="dash-meta">Performance</div>
        <div class="dash-value">${performance}%</div>
      `;

      // ===== PRIMARY ACTION =====
      const primary = document.createElement("button");
      primary.className = "primary-action";
      primary.id = "primary-action";

      if (status === "morning") {
        primary.innerText = "Start Morning Setup";
        primary.onclick = () => Router.go("mindset");
      }

      if (status === "execution") {
        primary.innerText = "Go to Execution";
        primary.onclick = () => Router.go("path");
      }

      if (status === "evening") {
        primary.innerText = "Continue Evening Review";
        primary.onclick = () => Router.go("mindset");
      }

      if (status === "closed") {
        primary.innerText = "View Day Summary";
        primary.onclick = () => {
          Router.setParam("viewVault", true);
          Router.go("mindset");
        };
      }

      // ===== QUICK ACTIONS =====
      const quickRow = document.createElement("div");
      quickRow.className = "dash-quick";

      const btnJournal = document.createElement("button");
      btnJournal.innerText = "Journal";
      btnJournal.onclick = () => Router.go("mindset");

      const btnBlock = document.createElement("button");
      btnBlock.innerText = "Add Block";
      btnBlock.onclick = () => Router.go("path");

      const btnFinance = document.createElement("button");
      btnFinance.innerText = "Add Transaction";
      btnFinance.onclick = () => Router.go("finance");

      quickRow.appendChild(btnJournal);
      quickRow.appendChild(btnBlock);
      quickRow.appendChild(btnFinance);

      // ===== RENDER =====
      root.appendChild(header);
      root.appendChild(statusBlock);
      root.appendChild(perfBlock);
      root.appendChild(primary);
      root.appendChild(quickRow);

      container.appendChild(root);

    } catch (e) {
      console.error("Dashboard mount error", e);
      container.innerHTML = "<div class='error'>Dashboard failed to load</div>";
    }

  }

});
