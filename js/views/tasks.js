import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey } from "../utils/date.js";
import { escapeHTML, tags } from "../utils/format.js";
import { modal, field, formValues, closeModal, toast, confirmDialog, empty, pageHeader } from "../components/ui.js";

const priorities = { high: "Hoch", medium: "Mittel", low: "Niedrig" };
let filters = { query: "", status: "open", priority: "all" };

export async function renderTasks(root) {
  const [tasks, goals, milestones] = await Promise.all(["tasks", "goals", "milestones"].map(name => db.all(name)));
  const visible = tasks.filter(task =>
    (!filters.query || JSON.stringify(task).toLowerCase().includes(filters.query.toLowerCase())) &&
    (filters.status === "all" || (filters.status === "open" ? task.status !== "done" : task.status === filters.status)) &&
    (filters.priority === "all" || task.priority === filters.priority)
  ).sort((a, b) => `${a.status === "done"}${a.due || "9999"}`.localeCompare(`${b.status === "done"}${b.due || "9999"}`));
  root.innerHTML = `${pageHeader("Aufgaben", "Alles, was als Nächstes wichtig ist.", '<button class="button primary" data-add>＋ Aufgabe</button>')}
    <section class="toolbar">
      <input type="search" data-query value="${escapeHTML(filters.query)}" placeholder="Aufgaben suchen…">
      <select data-status><option value="open">Offen</option><option value="all">Alle</option><option value="todo">Geplant</option><option value="doing">In Arbeit</option><option value="done">Erledigt</option></select>
      <select data-priority><option value="all">Alle Prioritäten</option>${Object.entries(priorities).map(([v,l]) => `<option value="${v}">${l}</option>`).join("")}</select>
    </section>
    <section class="list">${visible.length ? visible.map(task => taskRow(task, goals, milestones)).join("") : empty("Keine Aufgaben", "Passe die Filter an oder lege deine erste Aufgabe an.")}</section>`;
  root.querySelector("[data-status]").value = filters.status;
  root.querySelector("[data-priority]").value = filters.priority;
  root.querySelector("[data-add]").onclick = () => taskEditor(null, goals, milestones);
  root.querySelector("[data-query]").oninput = event => { filters.query = event.target.value; renderTasks(root); };
  root.querySelector("[data-status]").onchange = event => { filters.status = event.target.value; renderTasks(root); };
  root.querySelector("[data-priority]").onchange = event => { filters.priority = event.target.value; renderTasks(root); };
  root.querySelectorAll("[data-toggle]").forEach(button => button.onclick = async () => {
    const task = tasks.find(item => item.id === button.dataset.toggle);
    await saveEntity("tasks", { ...task, status: task.status === "done" ? "todo" : "done", completedAt: task.status === "done" ? null : new Date().toISOString() }, "toggle");
    renderTasks(root);
  });
  root.querySelectorAll("[data-edit]").forEach(button => button.onclick = () => taskEditor(tasks.find(item => item.id === button.dataset.edit), goals, milestones));
  root.querySelectorAll("[data-duplicate]").forEach(button => button.onclick = async () => {
    const { id, createdAt, updatedAt, ...copy } = tasks.find(item => item.id === button.dataset.duplicate);
    await saveEntity("tasks", { ...copy, title: `${copy.title} (Kopie)`, status: "todo" }, "duplicate");
    toast("Aufgabe dupliziert"); renderTasks(root);
  });
  root.querySelectorAll("[data-move]").forEach(button => button.onclick = () => {
    const task = tasks.find(item => item.id === button.dataset.move);
    modal({
      title: "Aufgabe verschieben",
      content: `<form class="form-grid">${field({ label: "Neues Datum & Zeit", name: "due", type: "datetime-local", value: task.due || `${dateKey()}T09:00`, required: true })}<button class="button primary">Verschieben</button></form>`,
      onOpen: sheet => sheet.querySelector("form").onsubmit = async event => {
        event.preventDefault();
        await saveEntity("tasks", { ...task, ...formValues(event.target) }, "move");
        closeModal(); toast("Aufgabe verschoben"); renderTasks(root);
      }
    });
  });
  root.querySelectorAll("[data-delete]").forEach(button => button.onclick = async () => {
    if (await confirmDialog("Diese Aufgabe endgültig löschen?")) { await removeEntity("tasks", button.dataset.delete); renderTasks(root); }
  });
}

function taskRow(task, goals, milestones) {
  const target = milestones.find(item => item.id === task.milestoneId)?.title || goals.find(item => item.id === task.goalId)?.title;
  return `<article class="list-item task ${task.status === "done" ? "done" : ""}">
    <button class="check" data-toggle="${task.id}" aria-label="${task.status === "done" ? "Wieder öffnen" : "Erledigen"}">${task.status === "done" ? "✓" : ""}</button>
    <div class="item-main"><h3>${escapeHTML(task.title)}</h3><div class="meta"><span class="priority ${task.priority}">${priorities[task.priority] || "Mittel"}</span>${task.due ? `<span>◷ ${escapeHTML(task.due.replace("T", " "))}</span>` : ""}${target ? `<span>◇ ${escapeHTML(target)}</span>` : ""}</div>${task.tags?.length ? `<div class="tags">${task.tags.map(tag => `<span>#${escapeHTML(tag)}</span>`).join("")}</div>` : ""}</div>
    <div class="item-actions"><button data-edit="${task.id}" aria-label="Bearbeiten">✎</button><button data-move="${task.id}" aria-label="Verschieben">→</button><button data-duplicate="${task.id}" aria-label="Duplizieren">⧉</button><button data-delete="${task.id}" aria-label="Löschen">×</button></div>
  </article>`;
}

export function taskEditor(task = {}, goals = [], milestones = []) {
  task ||= {};
  modal({
    title: task.id ? "Aufgabe bearbeiten" : "Neue Aufgabe",
    content: `<form id="task-form" class="form-grid">
      ${field({ label: "Titel", name: "title", value: task.title, required: true })}
      <div class="two-col">${field({ label: "Priorität", name: "priority", type: "select", value: task.priority || "medium", options: Object.entries(priorities) })}
      ${field({ label: "Status", name: "status", type: "select", value: task.status || "todo", options: [["todo","Geplant"],["doing","In Arbeit"],["done","Erledigt"]] })}</div>
      ${field({ label: "Datum & Zeit", name: "due", type: "datetime-local", value: task.due || `${dateKey()}T09:00` })}
      ${field({ label: "Ziel", name: "goalId", type: "select", value: task.goalId || "", options: [["","Kein Ziel"], ...goals.map(g => [g.id,g.title])] })}
      ${field({ label: "Meilenstein", name: "milestoneId", type: "select", value: task.milestoneId || "", options: [["","Kein Meilenstein"], ...milestones.map(m => [m.id,m.title])] })}
      ${field({ label: "Tags (Komma getrennt)", name: "tags", value: task.tags?.join(", ") })}
      ${field({ label: "Notizen", name: "notes", type: "textarea", value: task.notes })}
      <button class="button primary" type="submit">Speichern</button>
    </form>`,
    onOpen: sheet => sheet.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      const values = formValues(event.target);
      values.tags = tags(values.tags);
      await saveEntity("tasks", { ...task, ...values });
      closeModal(); toast("Aufgabe gespeichert"); window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  });
}
