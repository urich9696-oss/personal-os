// js/screens/mindset.js
// PERSONAL OS — Mindset (6-Minuten-Journal: Morning + Evening + Guardrails)
// Ziele:
// - Morning editierbar nur in "morning"
// - ToDo-Abhaken nur in "execution" (passiert im Path Screen)
// - Evening editierbar nur in "evening"
// - Closed = read-only + CTA "View Vault"
// - Keine direkte IndexedDB-Nutzung hier (nur State API)
// - Optionaler Fokus via Router params: focus="morning" | "evening"

ScreenRegistry.register("mindset", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const today = State.getTodayKey();
      const status = await State.getDayStatus();
      const focus = String(Router.getParam("focus") || "");
      // One-shot param consumption
      if (focus) Router.clearParams();

      let entry = await State.getJournal(today);
      entry = State.ensureJournalShape(entry, today);

      const root = document.createElement("div");
      root.className = "mindset";

      const title = document.createElement("h2");
      title.textContent = "Mindset";
      root.appendChild(title);

      // Status indicator
      const statusCard = document.createElement("div");
      statusCard.className = "dash-card";
      statusCard.innerHTML = `
        <div class="dash-meta">Status</div>
        <div style="font-size:14px; font-weight:900; margin-top:6px;">${escapeHtml(String(status || "").toUpperCase())}</div>
        <div style="font-size:12px; opacity:0.75; margin-top:4px;">${escapeHtml(today)}</div>
      `;
      root.appendChild(statusCard);

      // Closed guardrail: read-only info + vault CTA
      if (status === "closed") {
        const info = document.createElement("div");
        info.className = "dash-card";
        info.innerHTML = `
          <div style="font-weight:900; margin-bottom:6px;">Day Closed</div>
          <div style="font-size:13px; opacity:0.75;">Dieser Tag ist abgeschlossen und read-only.</div>
        `;
        root.appendChild(info);

        const vBtn = document.createElement("button");
        vBtn.type = "button";
        vBtn.textContent = "View Vault";
        vBtn.onclick = function () { Router.go("vault"); };
        root.appendChild(vBtn);

        container.appendChild(root);
        return;
      }

      // Execution guardrail: Journal locked
      if (status === "execution") {
        const info2 = document.createElement("div");
        info2.className = "dash-card";
        info2.innerHTML = `
          <div style="font-weight:900; margin-bottom:6px;">Execution Mode</div>
          <div style="font-size:13px; opacity:0.75;">Journal ist gesperrt. ToDos werden in Today’s Path abgehakt.</div>
        `;
        root.appendChild(info2);

        const goPath = document.createElement("button");
        goPath.type = "button";
        goPath.textContent = "Go to Today’s Path";
        goPath.onclick = function () { Router.go("path"); };
        root.appendChild(goPath);

        const startEveningBtn = document.createElement("button");
        startEveningBtn.type = "button";
        startEveningBtn.textContent = "Start Evening Review";
        startEveningBtn.onclick = async function () {
          const ok = await State.startEvening();
          if (ok) Router.go("mindset");
        };
        root.appendChild(startEveningBtn);

        container.appendChild(root);
        return;
      }

      // =========================
      // MORNING (editable)
      // =========================
      if (status === "morning") {
        const sec = document.createElement("div");
        sec.className = "dash-card";
        sec.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Morning Setup</div>`;

        const lf = document.createElement("textarea");
        lf.placeholder = "Ich freue mich auf...";
        lf.value = String((entry.morning && entry.morning.lookingForward) || "");

        const pl = document.createElement("textarea");
        pl.placeholder = "Das mache ich heute gut...";
        pl.value = String((entry.morning && entry.morning.planning) || "");

        sec.appendChild(lf);
        sec.appendChild(pl);

        // ToDos builder (unlimited)
        const todoCard = document.createElement("div");
        todoCard.style.marginTop = "10px";

        const todoLabel = document.createElement("div");
        todoLabel.style.fontWeight = "900";
        todoLabel.style.marginBottom = "8px";
        todoLabel.textContent = "ToDos";
        todoCard.appendChild(todoLabel);

        const todoInput = document.createElement("input");
        todoInput.placeholder = "Neues ToDo hinzufügen";
        todoCard.appendChild(todoInput);

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "Add ToDo";
        todoCard.appendChild(addBtn);

        const todoList = document.createElement("div");
        todoList.style.marginTop = "10px";
        todoCard.appendChild(todoList);

        function ensureTodosArray() {
          if (!entry.morning) entry.morning = { lookingForward: "", planning: "", todos: [] };
          if (!Array.isArray(entry.morning.todos)) entry.morning.todos = [];
          return entry.morning.todos;
        }

        function renderTodos() {
          const todos = ensureTodosArray();
          todoList.innerHTML = "";

          if (todos.length === 0) {
            const empty = document.createElement("div");
            empty.style.fontSize = "13px";
            empty.style.opacity = "0.75";
            empty.textContent = "Noch keine ToDos. Mindestens 1 ToDo setzen.";
            todoList.appendChild(empty);
            return;
          }

          for (let i = 0; i < todos.length; i++) {
            const t = todos[i] || {};
            const row = document.createElement("div");
            row.className = "todo-row";

            const text = document.createElement("span");
            text.textContent = String(t.text || "");

            const del = document.createElement("button");
            del.type = "button";
            del.textContent = "Delete";
            del.style.marginTop = "0";
            del.onclick = function () {
              const arr = ensureTodosArray();
              arr.splice(i, 1);
              entry.morning.todos = arr;
              renderTodos();
            };

            row.appendChild(text);
            row.appendChild(del);
            todoList.appendChild(row);
          }
        }

        addBtn.onclick = function () {
          const txt = String(todoInput.value || "").trim();
          if (!txt) return;
          const todos = ensureTodosArray();
          todos.push({ text: txt, done: false });
          entry.morning.todos = todos;
          todoInput.value = "";
          renderTodos();
        };

        renderTodos();
        sec.appendChild(todoCard);

        root.appendChild(sec);

        // Complete Morning
        const completeBtn = document.createElement("button");
        completeBtn.type = "button";
        completeBtn.textContent = "Complete Morning";
        completeBtn.onclick = async function () {
          // write entry
          entry.date = today;
          if (!entry.morning) entry.morning = {};
          entry.morning.lookingForward = lf.value;
          entry.morning.planning = pl.value;

          // Ensure todos exist even if empty
          if (!Array.isArray(entry.morning.todos)) entry.morning.todos = [];

          const okJ = await State.putJournal(entry);
          if (!okJ) {
            renderInlineError(root, "Konnte Journal nicht speichern.");
            return;
          }

          const ok = await State.completeMorning();
          if (!ok) {
            renderInlineError(root, "Konnte Status nicht auf execution setzen.");
            return;
          }

          Router.go("dashboard");
        };
        root.appendChild(completeBtn);

        // Optional: if user came with focus="morning", scroll
        if (focus === "morning") {
          try { completeBtn.scrollIntoView({ behavior: "smooth", block: "end" }); } catch (_) {}
        }

        container.appendChild(root);
        return;
      }

      // =========================
      // EVENING (editable)
      // =========================
      if (status === "evening") {
        const sec2 = document.createElement("div");
        sec2.className = "dash-card";
        sec2.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Evening Review</div>`;

        const rf = document.createElement("textarea");
        rf.placeholder = "Reflexion...";
        rf.value = String((entry.evening && entry.evening.reflection) || "");

        const rt = document.createElement("input");
        rt.placeholder = "Tagesbewertung (z. B. 8/10)";
        rt.value = String((entry.evening && entry.evening.rating) || "");

        const gr = document.createElement("textarea");
        gr.placeholder = "Dankbarkeit...";
        gr.value = String((entry.evening && entry.evening.gratitude) || "");

        sec2.appendChild(rf);
        sec2.appendChild(rt);
        sec2.appendChild(gr);

        root.appendChild(sec2);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "Close Day";
        closeBtn.onclick = async function () {
          entry.date = today;
          if (!entry.evening) entry.evening = {};
          entry.evening.reflection = rf.value;
          entry.evening.rating = rt.value;
          entry.evening.gratitude = gr.value;

          const okJ = await State.putJournal(entry);
          if (!okJ) {
            renderInlineError(root, "Konnte Journal nicht speichern.");
            return;
          }

          const ok = await State.closeDay();
          if (!ok) {
            renderInlineError(root, "Close Day fehlgeschlagen (Vault/Status).");
            return;
          }

          Router.go("dashboard");
        };
        root.appendChild(closeBtn);

        if (focus === "evening") {
          try { closeBtn.scrollIntoView({ behavior: "smooth", block: "end" }); } catch (_) {}
        }

        container.appendChild(root);
        return;
      }

      // Fallback (unknown status)
      const fb = document.createElement("div");
      fb.className = "error";
      fb.textContent = "Unbekannter Status: " + String(status || "");
      root.appendChild(fb);

      container.appendChild(root);

    } catch (e) {
      console.error("Mindset mount error", e);
      container.innerHTML = "<div class='error'>Mindset failed to load</div>";
    }

    function renderInlineError(rootEl, msg) {
      try {
        const err = document.createElement("div");
        err.className = "error";
        err.style.marginTop = "12px";
        err.textContent = String(msg || "Error");
        rootEl.appendChild(err);
      } catch (_) {}
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
