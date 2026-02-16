// js/screens/mindset.js
// PERSONAL OS — Mindset (6-Minuten-Journal: Morning + Evening, status-enforced)
// Regeln umgesetzt:
// - Morning editierbar nur in "morning"
// - Todos abhaken nur in "execution" (das passiert in path.js, hier read-only)
// - Evening editierbar nur in "evening"
// - Closed = read-only (Hinweis + Button zu Vault)
// - Keine direkten IndexedDB-Calls: nur State APIs
// - "Complete Morning" -> State.completeMorning() + Router.go("path")
// - "Start Evening" (wenn execution) -> State.startEvening() + rerender
// - "Close Day" (evening) -> State.closeDay() + Router.go("vault")

ScreenRegistry.register("mindset", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const today = State.getTodayKey();
      const status = await State.getDayStatus();

      const root = document.createElement("div");
      root.className = "mindset";

      // Top header
      const header = document.createElement("div");
      header.className = "dash-card";
      header.innerHTML = `
        <div style="font-weight:900; margin-bottom:4px;">Mindset</div>
        <div style="font-size:13px; opacity:0.75;">Status: <strong>${escapeHtml(String(status || ""))}</strong> · ${escapeHtml(today)}</div>
      `;
      root.appendChild(header);

      // Load journal entry (or default)
      let entry = await State.getJournal(today);
      entry = State.ensureJournalShape(entry, today);

      // Status blocks
      if (status === "morning") {
        root.appendChild(renderMorning(entry, async function onSave(updatedEntry) {
          const ok = await State.putJournal(updatedEntry);
          return !!ok;
        }, async function onComplete(updatedEntry) {
          // save first
          await State.putJournal(updatedEntry);
          const ok = await State.completeMorning();
          if (!ok) {
            alert("Konnte Morning nicht abschließen.");
            return;
          }
          Router.go("path");
        }));
      }

      if (status === "execution") {
        root.appendChild(renderExecutionLocked(entry, async function onStartEvening() {
          const ok = await State.startEvening();
          if (!ok) {
            alert("Kann Evening nur aus Execution starten.");
            return;
          }
          Router.go("mindset");
        }));
      }

      if (status === "evening") {
        root.appendChild(renderEvening(entry, async function onSave(updatedEntry) {
          const ok = await State.putJournal(updatedEntry);
          return !!ok;
        }, async function onCloseDay(updatedEntry) {
          await State.putJournal(updatedEntry);
          const ok = await State.closeDay();
          if (!ok) {
            alert("Close Day fehlgeschlagen. Prüfe Status/DB.");
            return;
          }
          Router.go("vault");
        }));
      }

      if (status === "closed") {
        root.appendChild(renderClosed(entry));
      }

      container.appendChild(root);

    } catch (e) {
      console.error("Mindset mount error", e);
      container.innerHTML = "<div class='error'>Mindset failed to load</div>";
    }
  }
});

function renderMorning(entry, onSave, onComplete) {
  const card = document.createElement("div");
  card.className = "dash-card";

  const title = document.createElement("h2");
  title.textContent = "Morning Setup";
  card.appendChild(title);

  const lf = document.createElement("textarea");
  lf.placeholder = "Ich freue mich auf …";
  lf.value = safeGet(entry, ["morning", "lookingForward"], "");
  card.appendChild(lf);

  const plan = document.createElement("textarea");
  plan.placeholder = "Das mache ich heute gut …";
  plan.value = safeGet(entry, ["morning", "planning"], "");
  card.appendChild(plan);

  // Todos
  const todoWrap = document.createElement("div");
  todoWrap.style.marginTop = "10px";
  todoWrap.innerHTML = "<div style='font-weight:800; margin-bottom:6px;'>ToDos</div>";
  card.appendChild(todoWrap);

  const todoInput = document.createElement("input");
  todoInput.placeholder = "Neues ToDo";
  todoWrap.appendChild(todoInput);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add ToDo";
  todoWrap.appendChild(addBtn);

  const list = document.createElement("div");
  list.style.marginTop = "10px";
  todoWrap.appendChild(list);

  function renderList() {
    list.innerHTML = "";
    const todos = safeGet(entry, ["morning", "todos"], []);
    if (!Array.isArray(todos) || todos.length === 0) {
      const empty = document.createElement("div");
      empty.style.fontSize = "13px";
      empty.style.opacity = "0.75";
      empty.textContent = "Noch keine ToDos. Erstelle 3–7 konkrete Aufgaben.";
      list.appendChild(empty);
      return;
    }

    for (let i = 0; i < todos.length; i++) {
      const t = todos[i];
      const row = document.createElement("div");
      row.className = "todo-row";
      row.style.opacity = "0.92";

      const dot = document.createElement("div");
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "999px";
      dot.style.background = "rgba(18,18,18,0.25)";

      const text = document.createElement("div");
      text.style.flex = "1";
      text.style.fontSize = "14px";
      text.textContent = String(t && t.text ? t.text : "");

      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Remove";
      del.style.marginTop = "0";
      del.style.padding = "10px 12px";

      del.onclick = async function () {
        try {
          const todos2 = safeGet(entry, ["morning", "todos"], []);
          todos2.splice(i, 1);
          entry.morning.todos = todos2;
          await onSave(entry);
          renderList();
        } catch (_) {}
      };

      row.appendChild(dot);
      row.appendChild(text);
      row.appendChild(del);

      list.appendChild(row);
    }
  }

  addBtn.onclick = async function () {
    const text = String(todoInput.value || "").trim();
    if (!text) return;

    if (!entry.morning) entry.morning = { lookingForward: "", planning: "", todos: [] };
    if (!Array.isArray(entry.morning.todos)) entry.morning.todos = [];

    entry.morning.todos.push({ text: text, done: false });
    todoInput.value = "";

    // Do not force save per keystroke, but save on add
    await onSave(entry);
    renderList();
  };

  renderList();

  // Buttons
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.onclick = async function () {
    entry.morning.lookingForward = lf.value;
    entry.morning.planning = plan.value;
    const ok = await onSave(entry);
    if (!ok) alert("Speichern fehlgeschlagen.");
  };
  card.appendChild(saveBtn);

  const completeBtn = document.createElement("button");
  completeBtn.type = "button";
  completeBtn.textContent = "Complete Morning";
  completeBtn.onclick = async function () {
    entry.morning.lookingForward = lf.value;
    entry.morning.planning = plan.value;
    await onComplete(entry);
  };
  card.appendChild(completeBtn);

  const hint = document.createElement("div");
  hint.style.fontSize = "13px";
  hint.style.opacity = "0.75";
  hint.style.marginTop = "10px";
  hint.textContent =
    "Guardrail: Morning ist nur jetzt editierbar. Nach Complete Morning sind ToDos nur noch in Execution abhakbar.";
  card.appendChild(hint);

  return card;
}

function renderExecutionLocked(entry, onStartEvening) {
  const card = document.createElement("div");
  card.className = "dash-card";

  const title = document.createElement("h2");
  title.textContent = "Execution Mode";
  card.appendChild(title);

  const info = document.createElement("div");
  info.style.fontSize = "13px";
  info.style.opacity = "0.8";
  info.textContent =
    "Journal ist gesperrt. ToDos abhaken passiert in Today’s Path. Wenn du fertig bist: starte Evening.";
  card.appendChild(info);

  // Read-only recap
  const recap = document.createElement("div");
  recap.style.marginTop = "12px";
  recap.style.fontSize = "13px";
  recap.style.opacity = "0.85";
  recap.innerHTML =
    "<div style='font-weight:800; margin-bottom:6px;'>Morning Recap</div>" +
    "<div style='opacity:0.9; margin-bottom:6px;'><strong>Ich freue mich auf:</strong> " + escapeHtml(safeGet(entry, ["morning", "lookingForward"], "")) + "</div>" +
    "<div style='opacity:0.9;'><strong>Das mache ich heute gut:</strong> " + escapeHtml(safeGet(entry, ["morning", "planning"], "")) + "</div>";
  card.appendChild(recap);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Start Evening Review";
  btn.onclick = async function () {
    await onStartEvening();
  };
  card.appendChild(btn);

  return card;
}

function renderEvening(entry, onSave, onCloseDay) {
  const card = document.createElement("div");
  card.className = "dash-card";

  const title = document.createElement("h2");
  title.textContent = "Evening Review";
  card.appendChild(title);

  const refl = document.createElement("textarea");
  refl.placeholder = "Reflexion …";
  refl.value = safeGet(entry, ["evening", "reflection"], "");
  card.appendChild(refl);

  const rating = document.createElement("input");
  rating.placeholder = "Tagesbewertung (z. B. 8/10)";
  rating.value = safeGet(entry, ["evening", "rating"], "");
  card.appendChild(rating);

  const grat = document.createElement("textarea");
  grat.placeholder = "Dankbarkeit …";
  grat.value = safeGet(entry, ["evening", "gratitude"], "");
  card.appendChild(grat);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.onclick = async function () {
    if (!entry.evening) entry.evening = {};
    entry.evening.reflection = refl.value;
    entry.evening.rating = rating.value;
    entry.evening.gratitude = grat.value;

    const ok = await onSave(entry);
    if (!ok) alert("Speichern fehlgeschlagen.");
  };
  card.appendChild(saveBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close Day";
  closeBtn.onclick = async function () {
    if (!entry.evening) entry.evening = {};
    entry.evening.reflection = refl.value;
    entry.evening.rating = rating.value;
    entry.evening.gratitude = grat.value;

    await onCloseDay(entry);
  };
  card.appendChild(closeBtn);

  const hint = document.createElement("div");
  hint.style.fontSize = "13px";
  hint.style.opacity = "0.75";
  hint.style.marginTop = "10px";
  hint.textContent =
    "Guardrail: Evening ist nur in 'evening' editierbar. Close Day erzeugt Vault Snapshot und setzt Status auf 'closed'.";
  card.appendChild(hint);

  return card;
}

function renderClosed(entry) {
  const card = document.createElement("div");
  card.className = "dash-card";

  const title = document.createElement("h2");
  title.textContent = "Day Closed";
  card.appendChild(title);

  const info = document.createElement("div");
  info.style.fontSize = "13px";
  info.style.opacity = "0.8";
  info.textContent =
    "Heute ist abgeschlossen und read-only. Details findest du im Vault.";
  card.appendChild(info);

  const btnVault = document.createElement("button");
  btnVault.type = "button";
  btnVault.textContent = "Open Vault";
  btnVault.onclick = function () {
    Router.go("vault");
  };
  card.appendChild(btnVault);

  // Read-only recap of journal
  const recap = document.createElement("div");
  recap.style.marginTop = "12px";
  recap.style.fontSize = "13px";
  recap.style.opacity = "0.9";
  recap.innerHTML =
    "<div style='font-weight:800; margin-bottom:6px;'>Journal (read-only)</div>" +
    "<div style='margin-bottom:6px;'><strong>Morning:</strong> " +
      escapeHtml(safeGet(entry, ["morning", "lookingForward"], "")) + " · " +
      escapeHtml(safeGet(entry, ["morning", "planning"], "")) +
    "</div>" +
    "<div><strong>Evening:</strong> " +
      escapeHtml(safeGet(entry, ["evening", "reflection"], "")) + " · " +
      escapeHtml(safeGet(entry, ["evening", "rating"], "")) +
    "</div>";
  card.appendChild(recap);

  return card;
}

function safeGet(obj, path, fallback) {
  try {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (!cur) return fallback;
      cur = cur[path[i]];
    }
    return (typeof cur === "undefined") ? fallback : cur;
  } catch (_) {
    return fallback;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
