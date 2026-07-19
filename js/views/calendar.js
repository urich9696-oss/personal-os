import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey, daysInMonth, eventOccurrences, startOfWeek, addDays, localDateTime } from "../utils/date.js";
import { escapeHTML, formatTime } from "../utils/format.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty } from "../components/ui.js";
import { state } from "../state.js";

let cursor = new Date();
let mode;

export async function renderCalendar(root) {
  mode ||= state.settings.profile.calendarView || "month";
  const events = await db.all("calendarEvents");
  const [from, to, days] = range();
  const occurrences = events.flatMap(event => eventOccurrences(event, from, to));
  root.innerHTML = `${pageHeader("Kalender", cursor.toLocaleDateString("de-DE", { month: "long", year: "numeric" }), '<button class="button primary" data-add>＋ Termin</button>')}
    <div class="calendar-controls"><button data-prev aria-label="Zurück">‹</button><button data-today>Heute</button><div class="segmented">${["month","week","day"].map(value => `<button data-mode="${value}" class="${mode === value ? "active" : ""}">${{month:"Monat",week:"Woche",day:"Tag"}[value]}</button>`).join("")}</div><button data-next aria-label="Weiter">›</button></div>
    ${mode === "month" ? monthGrid(days, occurrences) : agenda(days, occurrences)}
    <section class="card agenda-list"><h2>Termine im Zeitraum</h2>${occurrences.length ? occurrences.sort((a,b) => a.occurrenceStart-b.occurrenceStart).map(eventRow).join("") : empty("Keine Termine", "Für diesen Zeitraum sind keine Termine eingetragen.")}</section>`;
  root.querySelector("[data-add]").onclick = () => eventEditor();
  root.querySelector("[data-today]").onclick = () => { cursor = new Date(); renderCalendar(root); };
  root.querySelector("[data-prev]").onclick = () => move(-1, root);
  root.querySelector("[data-next]").onclick = () => move(1, root);
  root.querySelectorAll("[data-mode]").forEach(button => button.onclick = () => { mode = button.dataset.mode; renderCalendar(root); });
  root.querySelectorAll("[data-day]").forEach(button => button.onclick = () => { cursor = new Date(`${button.dataset.day}T12:00`); mode = "day"; renderCalendar(root); });
  root.querySelectorAll("[data-event]").forEach(button => button.onclick = () => eventEditor(events.find(event => event.id === button.dataset.event)));
  root.querySelectorAll("[data-delete]").forEach(button => button.onclick = async event => {
    event.stopPropagation();
    if (await confirmDialog("Termin samt Wiederholungsserie löschen?")) { await removeEntity("calendarEvents", button.dataset.delete); renderCalendar(root); }
  });
}

function range() {
  if (mode === "day") {
    const from = new Date(`${dateKey(cursor)}T00:00`), to = new Date(`${dateKey(cursor)}T23:59`);
    return [from, to, [from]];
  }
  if (mode === "week") {
    const from = startOfWeek(cursor, state.settings.profile.weekStart === "monday");
    return [from, new Date(addDays(from, 7).getTime() - 1), Array.from({ length: 7 }, (_, i) => addDays(from, i))];
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const from = startOfWeek(first, state.settings.profile.weekStart === "monday");
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  return [from, new Date(addDays(from, 42).getTime() - 1), days];
}

function monthGrid(days, events) {
  return `<section class="calendar-grid">${["Mo","Di","Mi","Do","Fr","Sa","So"].map(day => `<b>${day}</b>`).join("")}${days.map(day => {
    const items = events.filter(event => dateKey(event.occurrenceStart) === dateKey(day));
    return `<button class="calendar-day ${day.getMonth() !== cursor.getMonth() ? "muted" : ""} ${dateKey(day) === dateKey() ? "today" : ""}" data-day="${dateKey(day)}"><span>${day.getDate()}</span>${items.slice(0,3).map(e => `<i style="--event:${escapeHTML(e.color || "#4d7c68")}">${escapeHTML(e.title)}</i>`).join("")}${items.length > 3 ? `<small>+${items.length - 3}</small>` : ""}</button>`;
  }).join("")}</section>`;
}

function agenda(days, events) {
  return `<section class="agenda">${days.map(day => `<div class="agenda-day"><header><b>${day.toLocaleDateString("de-DE",{weekday:"short"})}</b><span>${day.getDate()}</span></header><div>${events.filter(e => dateKey(e.occurrenceStart) === dateKey(day)).map(eventRow).join("") || "<p>Frei</p>"}</div></div>`).join("")}</section>`;
}

function eventRow(event) {
  const hour12 = state.settings.profile.timeFormat === "12";
  return `<button class="event-row" data-event="${event.id}"><i style="background:${escapeHTML(event.color || "#4d7c68")}"></i><span><b>${escapeHTML(event.title)}</b><small>${event.allDay ? "Ganztägig" : `${formatTime(event.occurrenceStart, hour12)}–${formatTime(event.occurrenceEnd, hour12)}`} ${event.recurrence !== "none" ? " · ↻" : ""}</small></span><span data-delete="${event.id}" aria-label="Löschen">×</span></button>`;
}

export function eventEditor(event = {}) {
  const now = new Date();
  const start = event.start || localDateTime(new Date(now.setMinutes(Math.ceil(now.getMinutes()/30)*30)));
  modal({
    title: event.id ? "Termin bearbeiten" : "Neuer Termin",
    content: `<form id="event-form" class="form-grid">
      ${field({label:"Titel",name:"title",value:event.title,required:true})}
      ${field({label:"Ganztägig",name:"allDay",type:"checkbox",value:event.allDay})}
      <div class="two-col">${field({label:"Beginn",name:"start",type:"datetime-local",value:start,required:true})}${field({label:"Ende",name:"end",type:"datetime-local",value:event.end || start,required:true})}</div>
      ${field({label:"Ort",name:"location",value:event.location})}
      <div class="two-col">${field({label:"Wiederholung",name:"recurrence",type:"select",value:event.recurrence || "none",options:[["none","Keine"],["daily","Täglich"],["weekly","Wöchentlich"],["monthly","Monatlich"],["yearly","Jährlich"]]})}${field({label:"Ende der Serie",name:"recurrenceUntil",type:"date",value:event.recurrenceUntil})}</div>
      ${field({label:"Farbe",name:"color",type:"color",value:event.color || "#4d7c68"})}
      ${field({label:"Notizen",name:"notes",type:"textarea",value:event.notes})}
      <button class="button primary">Speichern</button>
    </form>`,
    onOpen: sheet => sheet.querySelector("form").onsubmit = async e => {
      e.preventDefault(); const values = formValues(e.target);
      if (values.end < values.start) return toast("Ende muss nach dem Beginn liegen", "error");
      await saveEntity("calendarEvents", { ...event, ...values });
      closeModal(); toast("Termin gespeichert"); window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  });
}

function move(direction, root) {
  if (mode === "month") cursor.setMonth(cursor.getMonth() + direction);
  else cursor.setDate(cursor.getDate() + direction * (mode === "week" ? 7 : 1));
  renderCalendar(root);
}
