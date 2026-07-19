import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey, monthKey, daysInMonth } from "../utils/date.js";
import { escapeHTML, money, download } from "../utils/format.js";
import { state } from "../state.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty } from "../components/ui.js";

let month = monthKey(), type = "all";

export async function renderFinance(root) {
  const [all, categories, budgets] = await Promise.all(["transactions", "financeCategories", "monthlyBudgets"].map(store => db.all(store)));
  const monthRows = expandTransactions(all, month);
  const rows = monthRows.filter(row => type === "all" || row.type === type).sort((a, b) => b.date.localeCompare(a.date));
  const income = total(monthRows.filter(row => row.type === "income"));
  const expense = total(monthRows.filter(row => row.type === "expense"));
  const exactBudget = budgets.find(row => row.month === month);
  const rolloverBudget = budgets.find(row => row.month === shiftMonth(month, -1) && row.rollover);
  const budget = exactBudget || (rolloverBudget ? { ...rolloverBudget, id: undefined, month, inherited: true } : null);
  const categorySpend = groupSpend(monthRows, categories);
  const previousExpense = total(expandTransactions(all, shiftMonth(month, -1)).filter(row => row.type === "expense"));
  const comparison = previousExpense ? (expense - previousExpense) / previousExpense * 100 : null;
  const max = Math.max(1, ...Object.values(categorySpend));

  root.innerHTML = `${pageHeader("Finance", "Private Übersicht – alle Daten bleiben auf diesem Gerät.", '<button class="button primary" data-add>＋ Buchung</button>')}
    <section class="finance-summary">
      <article><span>Einnahmen</span><b class="positive">${money(income, currency())}</b></article>
      <article><span>Ausgaben</span><b class="negative">${money(expense, currency())}</b><small>${comparison == null ? "Kein Vormonatswert" : `${comparison >= 0 ? "+" : ""}${comparison.toFixed(1)}% zum Vormonat`}</small></article>
      <article><span>Saldo</span><b>${money(income - expense, currency())}</b></article>
      <article><span>Budget übrig</span><b>${budget ? money(Number(budget.amount) - expense, currency()) : "–"}</b><small>${budget ? `${Math.round(expense / Math.max(1, Number(budget.amount)) * 100)}% genutzt${budget.inherited ? " · übernommen" : ""}` : "Budget einrichten"}</small></article>
    </section>
    <section class="card chart"><h2>Ausgaben nach Kategorie</h2>${Object.keys(categorySpend).length ? Object.entries(categorySpend).map(([name, value]) => `<div><span>${escapeHTML(name)}</span><i><b style="width:${value / max * 100}%"></b></i><strong>${money(value, currency())}</strong></div>`).join("") : "<p class='muted'>Keine Ausgaben in diesem Monat.</p>"}</section>
    ${budget?.categoryBudgets && Object.keys(budget.categoryBudgets).length ? `<section class="card category-budgets"><h2>Kategoriebudgets</h2>${Object.entries(budget.categoryBudgets).map(([id, amount]) => { const category = categories.find(row => row.id === id), spent = categorySpend[category?.name] || 0; return `<div><span>${escapeHTML(category?.name || "Gelöschte Kategorie")}</span><strong>${money(spent, currency())} / ${money(amount, currency())}</strong></div>`; }).join("")}</section>` : ""}
    <section class="toolbar"><input type="month" data-month value="${month}"><select data-type><option value="all">Alle</option><option value="expense">Ausgaben</option><option value="income">Einnahmen</option></select><button data-budget>Monatsbudget</button><button data-category>Kategorien</button><button data-export>CSV Export</button></section>
    <section class="card transaction-list">${rows.length ? rows.map(row => `<article><span class="transaction-icon ${row.type}">${row.type === "income" ? "＋" : "−"}</span><div><b>${escapeHTML(row.description)}</b><small>${escapeHTML(row.date)} · ${escapeHTML(categories.find(category => category.id === row.categoryId)?.name || "Unkategorisiert")}${row.merchant ? ` · ${escapeHTML(row.merchant)}` : ""}${row.virtual ? " · ↻" : ""}</small></div><strong>${row.type === "income" ? "+" : "−"}${money(row.amount, currency())}</strong><button data-edit="${row.sourceId || row.id}" aria-label="Buchung bearbeiten">✎</button><button data-delete="${row.sourceId || row.id}" aria-label="Buchung löschen">×</button></article>`).join("") : empty("Keine Buchungen", "Erfasse deine erste Einnahme oder Ausgabe.", '<button class="button primary" data-empty-add>Buchung erfassen</button>')}</section>`;

  root.querySelector("[data-type]").value = type;
  root.querySelector("[data-month]").onchange = event => { month = event.target.value; renderFinance(root); };
  root.querySelector("[data-type]").onchange = event => { type = event.target.value; renderFinance(root); };
  root.querySelector("[data-add]").onclick = () => transactionEditor({}, categories);
  root.querySelector("[data-empty-add]")?.addEventListener("click", () => transactionEditor({}, categories));
  root.querySelector("[data-budget]").onclick = () => budgetEditor(budget);
  root.querySelector("[data-category]").onclick = () => categoryManager(categories);
  root.querySelector("[data-export]").onclick = () => download(`personalos-finance-${month}.csv`, ["Datum,Typ,Beschreibung,Betrag,Kategorie", ...rows.map(row => [row.date, row.type, JSON.stringify(row.description), row.amount, JSON.stringify(categories.find(category => category.id === row.categoryId)?.name || "")].join(","))].join("\n"), "text/csv");
  root.querySelectorAll("[data-edit]").forEach(button => button.onclick = () => transactionEditor(all.find(row => row.id === button.dataset.edit), categories));
  root.querySelectorAll("[data-delete]").forEach(button => button.onclick = async () => {
    if (!await confirmDialog("Buchung löschen? Bei einer Wiederholung wird die gesamte Serie gelöscht.")) return;
    const deleted = all.find(row => row.id === button.dataset.delete);
    await removeEntity("transactions", button.dataset.delete);
    renderFinance(root);
    toast("Buchung gelöscht", "", { label: "Rückgängig", run: async () => { await saveEntity("transactions", deleted, "undo"); renderFinance(root); } });
  });
}

const currency = () => state.settings.profile.currency || "CHF";
const total = rows => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
function groupSpend(rows, categories) {
  return rows.filter(row => row.type === "expense").reduce((out, row) => {
    const name = categories.find(category => category.id === row.categoryId)?.name || "Unkategorisiert";
    out[name] = (out[name] || 0) + Number(row.amount);
    return out;
  }, {});
}

export function transactionEditor(entry = {}, categories = [], preset) {
  entry ||= {};
  modal({
    title: entry.id ? "Buchung bearbeiten" : "Neue Buchung",
    content: `<form class="form-grid">${field({ label: "Typ", name: "type", type: "select", value: entry.type || preset || "expense", options: [["expense", "Ausgabe"], ["income", "Einnahme"]] })}${field({ label: "Beschreibung", name: "description", value: entry.description, required: true })}<div class="two-col">${field({ label: `Betrag (${currency()})`, name: "amount", type: "number", value: entry.amount, min: 0.01, step: "0.01", required: true })}${field({ label: "Datum", name: "date", type: "date", value: entry.date || dateKey(), required: true })}</div>${field({ label: "Händler oder Quelle", name: "merchant", value: entry.merchant })}${field({ label: "Kategorie", name: "categoryId", type: "select", value: entry.categoryId || "", options: [["", "Unkategorisiert"], ...categories.map(category => [category.id, category.name])] })}<div class="three-col">${field({ label: "Wiederholung", name: "recurrence", type: "select", value: entry.recurrence || "none", options: [["none", "Keine"], ["daily", "Täglich"], ["weekly", "Wöchentlich"], ["monthly", "Monatlich"], ["yearly", "Jährlich"]] })}${field({ label: "Intervall", name: "recurrenceInterval", type: "number", value: entry.recurrenceInterval || 1, min: 1 })}${field({ label: "Enddatum", name: "recurrenceUntil", type: "date", value: entry.recurrenceUntil })}</div>${field({ label: "Notiz", name: "notes", type: "textarea", value: entry.notes })}<button class="button primary">Speichern</button></form>`,
    onOpen: sheet => sheet.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      await saveEntity("transactions", { ...entry, ...formValues(event.target) });
      closeModal(); toast("Buchung gespeichert");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  });
}

async function budgetEditor(entry = {}) {
  const categories = await db.all("financeCategories");
  modal({
    title: "Monatsbudget",
    content: `<form class="form-grid">${field({ label: "Monat", name: "month", type: "month", value: entry?.month || month, required: true })}${field({ label: `Gesamtbudget (${currency()})`, name: "amount", type: "number", value: entry?.amount, min: 0, step: "0.01", required: true })}${field({ label: "In den Folgemonat übernehmen", name: "rollover", type: "checkbox", value: entry?.rollover })}<h3>Optionale Kategoriebudgets</h3>${categories.map(category => field({ label: category.name, name: `category-${category.id}`, type: "number", value: entry?.categoryBudgets?.[category.id] || "", min: 0, step: "0.01" })).join("")}<button class="button primary">Speichern</button></form>`,
    onOpen: sheet => sheet.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      const values = formValues(event.target), categoryBudgets = {};
      categories.forEach(category => {
        if (values[`category-${category.id}`] !== "") categoryBudgets[category.id] = Number(values[`category-${category.id}`]);
        delete values[`category-${category.id}`];
      });
      await saveEntity("monthlyBudgets", { ...(entry || {}), ...values, categoryBudgets });
      closeModal(); toast("Budget gespeichert"); renderFinance(document.querySelector("#main"));
    }
  });
}

function categoryManager(categories) {
  modal({
    title: "Finanzkategorien",
    content: `<form class="inline-form"><input name="name" required placeholder="Neue Kategorie"><input name="color" type="color" value="#4d7c68"><button class="button primary">＋</button></form><div class="manage-list">${categories.map(category => `<div><i style="background:${category.color}"></i><span>${escapeHTML(category.name)}</span><button data-edit-category="${category.id}" aria-label="Kategorie bearbeiten">✎</button><button data-remove="${category.id}" aria-label="Kategorie löschen">×</button></div>`).join("")}</div>`,
    onOpen: sheet => {
      sheet.querySelector("form").onsubmit = async event => { event.preventDefault(); await saveEntity("financeCategories", formValues(event.target)); categoryManager(await db.all("financeCategories")); };
      sheet.querySelectorAll("[data-edit-category]").forEach(button => button.onclick = () => categoryEditor(categories.find(category => category.id === button.dataset.editCategory)));
      sheet.querySelectorAll("[data-remove]").forEach(button => button.onclick = async () => {
        if (await confirmDialog("Kategorie löschen? Bestehende Buchungen bleiben unkategorisiert erhalten.")) {
          await removeEntity("financeCategories", button.dataset.remove);
          categoryManager(await db.all("financeCategories"));
        }
      });
    }
  });
}

function categoryEditor(category) {
  modal({
    title: "Kategorie bearbeiten",
    content: `<form class="form-grid">${field({ label: "Name", name: "name", value: category.name, required: true })}${field({ label: "Farbe", name: "color", type: "color", value: category.color || "#4d7c68" })}<button class="button primary">Speichern</button></form>`,
    onOpen: sheet => sheet.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      await saveEntity("financeCategories", { ...category, ...formValues(event.target) });
      categoryManager(await db.all("financeCategories"));
    }
  });
}

function expandTransactions(transactions, targetMonth) {
  const [year, monthIndex] = targetMonth.split("-").map(Number);
  const from = `${targetMonth}-01`, to = `${targetMonth}-${String(new Date(year, monthIndex, 0).getDate()).padStart(2, "0")}`, rows = [];
  for (const transaction of transactions) {
    if (!transaction.date || transaction.date > to || (transaction.recurrenceUntil && transaction.recurrenceUntil < from)) continue;
    if (!transaction.recurrence || transaction.recurrence === "none") {
      if (transaction.date.startsWith(targetMonth)) rows.push(transaction);
      continue;
    }
    const interval = Math.max(1, Number(transaction.recurrenceInterval) || 1);
    const original = new Date(`${transaction.date}T12:00`);
    for (let cursor = new Date(original), guard = 0; dateKey(cursor) <= to && guard++ < 1200; cursor = nextOccurrence(cursor, transaction.recurrence, interval, original.getDate())) {
      const occurrenceDate = dateKey(cursor);
      if (occurrenceDate >= from && (!transaction.recurrenceUntil || occurrenceDate <= transaction.recurrenceUntil)) {
        rows.push({ ...transaction, id: `${transaction.id}:${occurrenceDate}`, sourceId: transaction.id, date: occurrenceDate, virtual: occurrenceDate !== transaction.date });
      }
    }
  }
  return rows;
}

function nextOccurrence(date, rule, interval, preferredDay) {
  const next = new Date(date);
  if (rule === "daily") next.setDate(next.getDate() + interval);
  else if (rule === "weekly") next.setDate(next.getDate() + 7 * interval);
  else if (rule === "monthly") { next.setDate(1); next.setMonth(next.getMonth() + interval); next.setDate(Math.min(preferredDay, daysInMonth(next))); }
  else next.setFullYear(next.getFullYear() + interval);
  return next;
}

function shiftMonth(value, amount) {
  const [year, monthValue] = value.split("-").map(Number), date = new Date(year, monthValue - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
