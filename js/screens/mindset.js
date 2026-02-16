// js/screens/mindset.js
// PERSONAL OS — Mindset (6-Minuten-Journal: Morning + Evening + Guardrails)
// Regeln:
// - morning: editierbar (Text + ToDos anlegen), danach "Complete Morning" => execution
// - execution: Journal read-only (Hinweis + Button "Start Evening Review" => evening)
// - evening: editierbar (Reflection/Rating/Gratitude), danach "Close Day" => closed + Vault Snapshot
// - closed: read-only (Hinweis + Button zu Vault)

ScreenRegistry.register("mindset", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const today = State.getTodayKey();
      const status = await State.getDayStatus();

      const focus = (Router.getParam("focus") || "").toString(); // "morning" | "evening" (optional)
      // focus param is one-shot
      if (focus) Router.clearParams();

      const root = document.createElement("div");
      root.className = "mindset";

      // Load or create journal entry via State API (single source of truth)
      let entry = await State.getJournal(today);
      entry = State.ensureJournalShape(entry, today);

      // Helper: save journal via State API
      async function saveEntry() {
        return await State.putJournal(entry);
      }

      // Helper UI: section title
      function h2(text) {
        const el = document.createElement("h2");
        el.textContent = text;
        return el;
      }

      // Helper UI: info block
      function info(text) {
        const el = document.createElement("div");
        el.style.padding = "12px";
        el.style.borderRadius = "14px";
        el.style.background = "rgba(255,255,255,0.62)";
        el.style.border = "1px solid rgba(0,0,0,0.08)";
        el.style.boxShadow = "0 10px 22px rgba(0,0,0,0.06)";
        el.style.fontSize = "13px";
        el.style.opacity = "0.85";
        el.textContent = text;
        return el;
      }

      // Helper: render todos (morning mode)
      function renderMorningTodos(listHost) {
        listHost.innerHTML = "";
        const todos = (entry.morning && Array.isArray(entry.morning.todos)) ? entry.morning.todos : [];
        if (todos.length === 0) {
          listHost.appendChild(info("Keine ToDos. Lege mindestens 1 ToDo an, damit Execution Sinn macht."));
          return;
        }

        for (let i = 0; i < todos.length; i++) {
          const t = todos[i];
          const row = document.createElement("div");
          row.className = "todo-row";
          row.style.justifyContent = "space-between";

          const left = document.createElement("div");
          left.style.display = "flex";
          left.style.alignItems = "center";
          left.style.gap = "10px";

          const dot = document.createElement("div");
          dot.style.width = "10px";
          dot.style.height = "10px";
          dot.style.borderRadius = "999px";
          dot.style.background = "rgba(18,18,18,0.25)";

          const text = document.createElement("div");
          text.textContent = String(t && t.text ? t.text : "");
          text.style.flex = "1";

          left.appendChild(dot);
          left.appendChild(text);

          const del = document.createElement("button");
          del.type = "button";
          del.textContent = "Remove";
          del.style.marginTop = "0";
          del.onclick = async function () {
            entry.morning.todos.splice(i, 1);
            await saveEntry();
            renderMorningTodos(listHost);
          };

          row.appendChild(left);
          row.appendChild(del);

          listHost.appendChild(row);
        }
      }

      // ---------- MORNING ----------
      if (status === "morning") {
        root.appendChild(h2("Morning Setup"));
        root.appendChild(info("Du definierst den Tag. Danach ist Journal gesperrt und Execution startet."));

        const t1 = document.createElement("textarea");
        t1.placeholder = "Ich freue mich auf …";
        t1.value = (entry.morning && entry.morning.lookingForward) ? entry.morning.lookingForward : "";

        const t2 = document.createElement("textarea");
        t2.placeholder = "Das mache ich heute gut …";
        t2.value = (entry.morning && entry.morning.planning) ? entry.morning.planning : "";

        root.appendChild(t1);
        root.appendChild(t2);

        // Todo add
        const todoInput = document.createElement("input");
        todoInput.placeholder = "ToDo hinzufügen";
        root.appendChild(todoInput);

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "Add ToDo";

        const todoList = document.createElement("div");

        addBtn.onclick = async function () {
          const text = String(todoInput.value || "").trim();
          if (!text) return;

          if (!entry.morning) entry.morning = { lookingForward: "", planning: "", todos: [] };
          if (!Array.isArray(entry.morning.todos)) entry.morning.todos = [];

          entry.morning.todos.push({ text: text, done: false });
          todoInput.value = "";

          // persist immediately (avoid data loss)
          entry.morning.lookingForward = t1.value;
          entry.morning.planning = t2.value;
          await saveEntry();

          renderMorningTodos(todoList);
        };

        root.appendChild(addBtn);
        root.appendChild(todoList);
        renderMorningTodos(todoList);

        // Complete morning
        const completeBtn = document.createElement("button");
        completeBtn.type = "button";
        completeBtn.textContent = "Complete Morning";

        const msg = document.createElement("div");
        msg.style.fontSize = "13px";
        msg.style.opacity = "0.75";
        msg.style.marginTop = "8px";

        completeBtn.onclick = async function () {
          msg.textContent = "";

          // persist text first
          entry.morning.lookingForward = t1.value;
          entry.morning.planning = t2.value;

          // require at least 1 todo (hard guardrail)
          const todos = (entry.morning && Array.isArray(entry.morning.todos)) ? entry.morning.todos : [];
          if (todos.length === 0) {
            msg.textContent = "Lege mindestens 1 ToDo an, bevor du Morning abschließt.";
            return;
          }

          const okSave = await saveEntry();
          if (!okSave) {
            msg.textContent = "Konnte Journal nicht speichern.";
            return;
          }

          const ok = await State.completeMorning();
          if (!ok) {
            msg.textContent = "Statuswechsel fehlgeschlagen.";
            return;
          }

          Router.go("path");
        };

        root.appendChild(completeBtn);
        root.appendChild(msg);

        container.appendChild(root);
        return;
      }

      // ---------- EXECUTION ----------
      if (status === "execution") {
        root.appendChild(h2("Execution Mode"));
        root.appendChild(info("Journal ist gesperrt. ToDos werden in Today’s Path abgehakt."));

        // Show read-only summary of morning
        const card = document.createElement("div");
        card.className = "dash-card";
        card.innerHTML = `
          <div class="dash-meta">Morning Summary</div>
          <div style="margin-top:8px; font-size:14px;"><strong>Ich freue mich auf:</strong><br>${escapeHtml(entry.morning && entry.morning.lookingForward ? entry.morning.lookingForward : "")}</div>
          <div style="margin-top:10px; font-size:14px;"><strong>Das mache ich gut:</strong><br>${escapeHtml(entry.morning && entry.morning.planning ? entry.morning.planning : "")}</div>
        `;
        root.appendChild(card);

        const toPath = document.createElement("button");
        toPath.type = "button";
        toPath.textContent = "Go to Today’s Path";
        toPath.onclick = () => Router.go("path");
        root.appendChild(toPath);

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

      // ---------- EVENING ----------
      if (status === "evening") {
        root.appendChild(h2("Evening Review"));
        root.appendChild(info("Reflexion abschließen. Danach wird der Tag geschlossen und im Vault archiviert."));

        const t1 = document.createElement("textarea");
        t1.placeholder = "Reflexion …";
        t1.value = (entry.evening && entry.evening.reflection) ? entry.evening.reflection : "";

        const t2 = document.createElement("input");
        t2.placeholder = "Tagesbewertung (z. B. 8/10)";
        t2.value = (entry.evening && entry.evening.rating) ? entry.evening.rating : "";

        const t3 = document.createElement("textarea");
        t3.placeholder = "Dankbarkeit …";
        t3.value = (entry.evening && entry.evening.gratitude) ? entry.evening.gratitude : "";

        root.appendChild(t1);
        root.appendChild(t2);
        root.appendChild(t3);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "Close Day";

        const msg = document.createElement("div");
        msg.style.fontSize = "13px";
        msg.style.opacity = "0.75";
        msg.style.marginTop = "8px";

        closeBtn.onclick = async function () {
          msg.textContent = "";

          entry.evening.reflection = t1.value;
          entry.evening.rating = t2.value;
          entry.evening.gratitude = t3.value;

          const okSave = await saveEntry();
          if (!okSave) {
            msg.textContent = "Konnte Evening nicht speichern.";
            return;
          }

          const ok = await State.closeDay();
          if (!ok) {
            msg.textContent = "Konnte Tag nicht schließen (Vault Snapshot fehlgeschlagen).";
            return;
          }

          Router.go("dashboard");
        };

        root.appendChild(closeBtn);
        root.appendChild(msg);

        container.appendChild(root);
        return;
      }

      // ---------- CLOSED ----------
      if (status === "closed") {
        root.appendChild(h2("Day Closed"));
        root.appendChild(info("Dieser Tag ist geschlossen und read-only. Details findest du im Vault."));

        const toVault = document.createElement("button");
        toVault.type = "button";
        toVault.textContent = "Open Vault";
        toVault.onclick = function () {
          Router.setParams({ viewVault: true });
          Router.go("vault");
        };
        root.appendChild(toVault);

        container.appendChild(root);
        return;
      }

      // Fallback
      root.appendChild(h2("Mindset"));
      root.appendChild(info("Unbekannter Status. Bitte zurück zum Dashboard."));
      container.appendChild(root);

    } catch (e) {
      console.error("Mindset mount error", e);
      container.innerHTML = "<div class='error'>Mindset failed to load</div>";
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
