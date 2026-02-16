// js/screens/path.js
// PERSONAL OS — Today’s Path (Execution Mode)
// Ziele:
// - Status Enforcement: nur in execution interaktiv, sonst Guidance + Links
// - ToDos aus Journal anzeigen und abhaken (nur execution)
// - Performance live
// - Kalenderblöcke anzeigen (heute)
// - Quick Add Block (nur execution)
// - Keine direkten IndexedDB calls: nur State APIs
// - Quick Nav: Dashboard / Mindset

ScreenRegistry.register("path", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const today = State.getTodayKey();
      const status = await State.getDayStatus();

      const root = document.createElement("div");
      root.className = "path";

      // Header / Actions
      const actions = document.createElement("div");
      actions.className = "dash-quick";
      actions.style.marginBottom = "10px";

      const btnDash = document.createElement("button");
      btnDash.type = "button";
      btnDash.textContent = "Dashboard";
      btnDash.onclick = function () { Router.go("dashboard"); };

      const btnMindset = document.createElement("button");
      btnMindset.type = "button";
      btnMindset.textContent = "Mindset";
      btnMindset.onclick = function () { Router.go("mindset"); };

      actions.appendChild(btnDash);
      actions.appendChild(btnMindset);
      root.appendChild(actions);

      // Title card
      const header = document.createElement("div");
      header.className = "dash-card";
      header.innerHTML = `
        <div style="font-weight:900; margin-bottom:4px;">Today’s Path</div>
        <div style="font-size:13px; opacity:0.75;">${escapeHtml(today)} · Status: <strong>${escapeHtml(String(status))}</strong></div>
      `;
      root.appendChild(header);

      // Status enforcement
      if (status !== "execution") {
        const lock = document.createElement("div");
        lock.className = "dash-card";

        let msg = "";
        let ctaText = "";
        let ctaTarget = "";

        if (status === "morning") {
          msg = "Execution ist gesperrt. Erst Morning Setup abschließen.";
          ctaText = "Go to Morning Setup";
          ctaTarget = "mindset";
        } else if (status === "evening") {
          msg = "Execution ist vorbei. Du bist im Evening Review.";
          ctaText = "Go to Evening Review";
          ctaTarget = "mindset";
        } else if (status === "closed") {
          msg = "Der Tag ist abgeschlossen (read-only).";
          ctaText = "Open Vault";
          ctaTarget = "vault";
        } else {
          msg = "Execution ist aktuell nicht verfügbar.";
          ctaText = "Back to Dashboard";
          ctaTarget = "dashboard";
        }

        lock.innerHTML = `
          <h2 style="margin-top:0;">Execution Locked</h2>
          <div style="font-size:13px; opacity:0.8;">${escapeHtml(msg)}</div>
        `;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = ctaText;
        btn.onclick = function () { Router.go(ctaTarget); };

        lock.appendChild(btn);
        root.appendChild(lock);
        container.appendChild(root);
        return;
      }

      // ===== Execution Mode UI =====

      // Load journal (source of truth)
      let journal = await State.getJournal(today);
      journal = State.ensureJournalShape(journal, today);

      if (!journal.morning || !Array.isArray(journal.morning.todos)) {
        journal.morning = journal.morning || {};
        journal.morning.todos = [];
      }

      const todos = journal.morning.todos;

      // Performance card
      const perfCard = document.createElement("div");
      perfCard.className = "dash-card";
      root.appendChild(perfCard);

      function computePerformance() {
        const total = todos.length;
        const done = todos.filter((t) => !!(t && t.done)).length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        return { total, done, pct };
      }

      function renderPerformance() {
        const p = computePerformance();
        perfCard.innerHTML = `
          <div class="dash-meta">Performance</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">${p.pct}%</div>
          <div style="font-size:12px; opacity:0.75; margin-top:4px;">Todos ${p.done}/${p.total}</div>
        `;
      }

      renderPerformance();

      // Todos card
      const todoCard = document.createElement("div");
      todoCard.className = "dash-card";
      todoCard.innerHTML = `<div style="font-weight:900; margin-bottom:8px;">ToDos</div>`;
      root.appendChild(todoCard);

      const todoList = document.createElement("div");
      todoCard.appendChild(todoList);

      async function persistJournal() {
        const ok = await State.putJournal(journal);
        return !!ok;
      }

      function renderTodos() {
        todoList.innerHTML = "";

        if (!todos || todos.length === 0) {
          const empty = document.createElement("div");
          empty.style.fontSize = "13px";
          empty.style.opacity = "0.75";
          empty.textContent = "Keine ToDos vorhanden. Erstelle sie im Morning Setup.";
          todoList.appendChild(empty);
          return;
        }

        for (let i = 0; i < todos.length; i++) {
          const t = todos[i] || {};
          const row = document.createElement("div");
          row.className = "todo-row";

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!t.done;

          const text = document.createElement("div");
          text.style.flex = "1";
          text.style.fontSize = "14px";
          text.style.opacity = cb.checked ? "0.55" : "0.95";
          text.style.textDecoration = cb.checked ? "line-through" : "none";
          text.textContent = String(t.text || "");

          cb.onchange = async function () {
            t.done = !!cb.checked;
            todos[i] = t;
            await persistJournal();
            renderTodos();
            renderPerformance();
          };

          row.appendChild(cb);
          row.appendChild(text);
          todoList.appendChild(row);
        }
      }

      renderTodos();

      // Blocks card
      const blocksCard = document.createElement("div");
      blocksCard.className = "dash-card";
      blocksCard.innerHTML = `<div style="font-weight:900; margin-bottom:8px;">Today’s Blocks</div>`;
      root.appendChild(blocksCard);

      const blocksList = document.createElement("div");
      blocksCard.appendChild(blocksList);

      async function loadBlocks() {
        const blocks = await State.listBlocks(today);
        return Array.isArray(blocks) ? blocks : [];
      }

      async function renderBlocks() {
        blocksList.innerHTML = "";

        const blocks = await loadBlocks();
        if (!blocks || blocks.length === 0) {
          const empty = document.createElement("div");
          empty.style.fontSize = "13px";
          empty.style.opacity = "0.75";
          empty.textContent = "Noch keine Blöcke. Füge unten einen Block hinzu.";
          blocksList.appendChild(empty);
          return;
        }

        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i] || {};
          const line = document.createElement("div");
          line.style.fontSize = "13px";
          line.style.opacity = "0.9";
          line.style.marginTop = "6px";
          line.textContent = (b.start || "") + "–" + (b.end || "") + " | " + (b.title || "");
          blocksList.appendChild(line);
        }
      }

      await renderBlocks();

      // Quick Add Block (execution only)
      const addCard = document.createElement("div");
      addCard.className = "dash-card";
      addCard.innerHTML = `<div style="font-weight:900; margin-bottom:8px;">Quick Add Block</div>`;
      root.appendChild(addCard);

      const startInput = document.createElement("input");
      startInput.placeholder = "Start (HH:MM)";

      const endInput = document.createElement("input");
      endInput.placeholder = "End (HH:MM)";

      const titleInput = document.createElement("input");
      titleInput.placeholder = "Title";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "Add Block";

      addBtn.onclick = async function () {
        const start = String(startInput.value || "").trim();
        const end = String(endInput.value || "").trim();
        const title = String(titleInput.value || "").trim();

        if (!isTimeHHMM(start) || !isTimeHHMM(end) || !title) {
          alert("Bitte gültige Zeiten (HH:MM) und einen Titel eingeben.");
          return;
        }

        const id = await State.addBlock({ date: today, start: start, end: end, title: title });
        if (!id) {
          alert("Block konnte nicht gespeichert werden.");
          return;
        }

        startInput.value = "";
        endInput.value = "";
        titleInput.value = "";

        await renderBlocks();
      };

      addCard.appendChild(startInput);
      addCard.appendChild(endInput);
      addCard.appendChild(titleInput);
      addCard.appendChild(addBtn);

      container.appendChild(root);

    } catch (e) {
      console.error("Path mount error", e);
      container.innerHTML = "<div class='error'>Execution failed</div>";
    }
  }
});

function isTimeHHMM(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s || "").trim());
  return !!m;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
