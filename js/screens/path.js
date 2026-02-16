// js/screens/path.js
// PERSONAL OS — Today’s Path (Execution Mode)
// Requirements implemented:
// - Hard Status Enforcement: only interactive in "execution"
// - ToDos anzeigen (aus Journal), abhaken, Performance live
// - Kalenderblöcke (heute) anzeigen
// - Quick Add Block (via State API)
// - Keine Templates im Daily Flow

ScreenRegistry.register("path", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const today = State.getTodayKey();
      const status = await State.getDayStatus();

      const root = document.createElement("div");
      root.className = "path";

      const title = document.createElement("h2");
      title.textContent = "Today’s Path";
      root.appendChild(title);

      // Hard guardrail
      if (status !== "execution") {
        const msg = document.createElement("div");
        msg.className = "error";
        msg.innerHTML =
          "<div style='font-weight:800; margin-bottom:6px;'>Execution ist gesperrt</div>" +
          "<div style='font-size:14px; opacity:0.85;'>Du bist aktuell in <strong>" + escapeHtml(String(status)) + "</strong>. " +
          "Execution ist nur im Status <strong>execution</strong> möglich.</div>";
        root.appendChild(msg);

        const toMindset = document.createElement("button");
        toMindset.type = "button";
        toMindset.textContent = "Go to Mindset";
        toMindset.onclick = () => Router.go("mindset");
        root.appendChild(toMindset);

        container.appendChild(root);
        return;
      }

      // ===== Load journal (source of ToDos) =====
      let entry = await State.getJournal(today);
      entry = State.ensureJournalShape(entry, today);

      const todos = (entry.morning && Array.isArray(entry.morning.todos)) ? entry.morning.todos : [];

      // ===== Performance =====
      const perfCard = document.createElement("div");
      perfCard.className = "dash-card";

      function calcPerf() {
        const total = todos.length;
        const done = todos.filter((t) => t && t.done).length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        return { total, done, pct };
      }

      function renderPerf() {
        const p = calcPerf();
        perfCard.innerHTML = `
          <div class="dash-meta">Performance</div>
          <div class="dash-value">${p.pct}%</div>
          <div style="font-size:13px; opacity:0.75; margin-top:6px;">Done: ${p.done}/${p.total}</div>
        `;
      }

      renderPerf();
      root.appendChild(perfCard);

      // ===== ToDo List =====
      const todoCard = document.createElement("div");
      todoCard.className = "dash-card";
      todoCard.innerHTML = `<div style="font-weight:800; margin-bottom:8px;">ToDos</div>`;
      root.appendChild(todoCard);

      const todoList = document.createElement("div");
      todoCard.appendChild(todoList);

      const todoHint = document.createElement("div");
      todoHint.style.fontSize = "13px";
      todoHint.style.opacity = "0.75";
      todoHint.style.marginTop = "8px";
      todoCard.appendChild(todoHint);

      async function saveEntry() {
        await State.putJournal(entry);
      }

      function renderTodos() {
        todoList.innerHTML = "";

        if (!todos || todos.length === 0) {
          const empty = document.createElement("div");
          empty.style.fontSize = "13px";
          empty.style.opacity = "0.75";
          empty.textContent = "Keine ToDos gefunden. Lege ToDos im Morning Setup an.";
          todoList.appendChild(empty);
          todoHint.textContent = "";
          return;
        }

        for (let i = 0; i < todos.length; i++) {
          const t = todos[i] || {};
          const row = document.createElement("div");
          row.className = "todo-row";

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!t.done;

          const text = document.createElement("span");
          text.textContent = String(t.text || "");

          cb.onchange = async function () {
            t.done = cb.checked;
            todos[i] = t;
            entry.morning.todos = todos;

            await saveEntry();
            renderPerf();
            renderTodos(); // keep UI consistent
          };

          // strike-through when done
          if (t.done) {
            text.style.textDecoration = "line-through";
            text.style.opacity = "0.65";
          }

          row.appendChild(cb);
          row.appendChild(text);
          todoList.appendChild(row);
        }

        const p = calcPerf();
        todoHint.textContent = p.total === 0 ? "" : ("Nächster Schritt: Alles abhaken → dann Evening starten.");
      }

      renderTodos();

      // ===== Blocks =====
      const blocksTitle = document.createElement("h3");
      blocksTitle.textContent = "Today’s Blocks";
      root.appendChild(blocksTitle);

      const blocksWrap = document.createElement("div");
      root.appendChild(blocksWrap);

      async function renderBlocks() {
        blocksWrap.innerHTML = "";
        const blocks = await State.listBlocks(today).catch(() => []);

        if (!blocks || blocks.length === 0) {
          const empty = document.createElement("div");
          empty.style.fontSize = "13px";
          empty.style.opacity = "0.75";
          empty.textContent = "Keine Blöcke. Füge unten einen Block hinzu.";
          blocksWrap.appendChild(empty);
          return;
        }

        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i] || {};
          const div = document.createElement("div");
          div.className = "todo-row";
          div.style.justifyContent = "space-between";

          const left = document.createElement("div");
          left.style.display = "flex";
          left.style.flexDirection = "column";

          const top = document.createElement("div");
          top.style.fontWeight = "800";
          top.textContent = (b.start || "?") + "–" + (b.end || "?");

          const bot = document.createElement("div");
          bot.style.fontSize = "13px";
          bot.style.opacity = "0.75";
          bot.textContent = String(b.title || "");

          left.appendChild(top);
          left.appendChild(bot);

          const del = document.createElement("button");
          del.type = "button";
          del.textContent = "Delete";
          del.style.marginTop = "0";
          del.onclick = async function () {
            if (b.id == null) return;
            const ok = await State.deleteBlock(b.id);
            if (ok) await renderBlocks();
          };

          div.appendChild(left);
          div.appendChild(del);

          blocksWrap.appendChild(div);
        }
      }

      await renderBlocks();

      // ===== Quick Add Block =====
      const addCard = document.createElement("div");
      addCard.className = "dash-card";
      addCard.innerHTML = `<div style="font-weight:800; margin-bottom:8px;">Quick Add Block</div>`;

      const startInput = document.createElement("input");
      startInput.placeholder = "Start (HH:MM)";
      startInput.inputMode = "numeric";

      const endInput = document.createElement("input");
      endInput.placeholder = "End (HH:MM)";
      endInput.inputMode = "numeric";

      const titleInput = document.createElement("input");
      titleInput.placeholder = "Title";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "Add Block";

      const addMsg = document.createElement("div");
      addMsg.style.fontSize = "13px";
      addMsg.style.opacity = "0.75";
      addMsg.style.marginTop = "8px";

      addBtn.onclick = async function () {
        addMsg.textContent = "";
        const s = String(startInput.value || "").trim();
        const e = String(endInput.value || "").trim();
        const t = String(titleInput.value || "").trim();

        if (!s || !e || !t) {
          addMsg.textContent = "Bitte Start/Ende/Titel ausfüllen.";
          return;
        }

        const id = await State.addBlock({ date: today, start: s, end: e, title: t }).catch(() => null);
        if (!id) {
          addMsg.textContent = "Konnte Block nicht speichern.";
          return;
        }

        startInput.value = "";
        endInput.value = "";
        titleInput.value = "";
        addMsg.textContent = "Block gespeichert.";

        await renderBlocks();
      };

      addCard.appendChild(startInput);
      addCard.appendChild(endInput);
      addCard.appendChild(titleInput);
      addCard.appendChild(addBtn);
      addCard.appendChild(addMsg);

      root.appendChild(addCard);

      // ===== Evening Transition =====
      const eveningBtn = document.createElement("button");
      eveningBtn.type = "button";
      eveningBtn.textContent = "Start Evening Review";
      eveningBtn.onclick = async function () {
        const ok = await State.startEvening();
        if (ok) Router.go("mindset");
      };
      root.appendChild(eveningBtn);

      container.appendChild(root);
    } catch (e) {
      console.error("Path mount error", e);
      container.innerHTML = "<div class='error'>Execution failed</div>";
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
