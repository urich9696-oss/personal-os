import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey, eventOccurrences, startOfWeek, addDays, localDateTime, maintenanceDue } from "../utils/date.js";
import { escapeHTML, formatTime } from "../utils/format.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty } from "../components/ui.js";
import { state } from "../state.js";

let cursor = new Date();
let mode;
const typeMeta = {
  event: ["Termin", "#477b68", "▦"], task: ["Aufgabe", "#9d6534", "✓"],
  block: ["Block", "#536fa4", "◫"], maintenance: ["Maintenance", "#8b598f", "↻"]
};

export async function renderCalendar(root) {
  mode ||= state.settings.profile.calendarView || "month";
  const [events, tasks, plans, maintenance] = await Promise.all(["calendarEvents","tasks","dayPlans","maintenanceTemplates"].map(db.all));
  const [from, to, days] = range();
  const entries = [
    ...events.flatMap(event => eventOccurrences(event, from, to)).map(event => ({
      type:"event", id:event.id, source:event, title:event.title, date:dateKey(event.occurrenceStart),
      start:event.allDay ? "" : event.occurrenceStart, end:event.occurrenceEnd, allDay:event.allDay
    })),
    ...tasks.filter(task => task.status !== "archived" && taskDate(task) >= dateKey(from) && taskDate(task) <= dateKey(to)).map(task => ({
      type:"task", id:task.id, source:task, title:task.title, date:taskDate(task),
      start:task.startTime ? new Date(`${taskDate(task)}T${task.startTime}`) : null, end:task.endTime ? new Date(`${taskDate(task)}T${task.endTime}`) : null
    })),
    ...plans.filter(plan => plan.date >= dateKey(from) && plan.date <= dateKey(to)).flatMap(plan => (plan.items || []).map((item,index) => ({
      type:"block", id:`${plan.id}:${index}`, source:{ plan, item, index }, title:item.title, date:plan.date,
      start:item.start ? new Date(`${plan.date}T${item.start}`) : null
    }))),
    ...days.flatMap(day => maintenance.filter(template => maintenanceDue(template, day)).map(template => ({
      type:"maintenance", id:template.id, source:template, title:template.title, date:dateKey(day),
      start:template.preferredTime ? new Date(`${dateKey(day)}T${template.preferredTime}`) : null
    })))
  ];
  root.innerHTML = `${pageHeader("Kalender", cursor.toLocaleDateString("de-DE", { month:"long", year:"numeric" }), '<button class="button primary" data-add>＋ Termin</button>')}
    <div class="calendar-controls"><button data-prev aria-label="Zurück">‹</button><button data-today>Heute</button><div class="segmented">${["month","week","day"].map(value => `<button data-mode="${value}" class="${mode===value?"active":""}">${{month:"Monat",week:"Woche",day:"Tag"}[value]}</button>`).join("")}</div><button data-next aria-label="Weiter">›</button></div>
    <div class="calendar-legend">${Object.entries(typeMeta).map(([type,[label,color,mark]]) => `<span><i style="background:${color}"></i>${mark} ${label}</span>`).join("")}</div>
    ${mode==="month" ? monthGrid(days,entries) : mode==="day" ? dayView(days[0],entries) : weekView(days,entries)}
    <section class="card agenda-list"><h2>Einträge im Zeitraum</h2>${entries.length ? entries.sort(sortEntries).map(entryRow).join("") : empty("Keine Einträge","Lege einen Termin oder eine datierte Aufgabe an.",'<button class="button primary" data-empty-add>Termin anlegen</button>')}</section>`;
  root.querySelector("[data-add]").onclick = () => eventEditor();
  root.querySelector("[data-empty-add]")?.addEventListener("click", () => eventEditor());
  root.querySelector("[data-today]").onclick=()=>{cursor=new Date();renderCalendar(root);};
  root.querySelector("[data-prev]").onclick=()=>move(-1,root);
  root.querySelector("[data-next]").onclick=()=>move(1,root);
  root.querySelectorAll("[data-mode]").forEach(button=>button.onclick=async()=>{mode=button.dataset.mode;await state.save({profile:{...state.settings.profile,calendarView:mode}});renderCalendar(root);});
  root.querySelectorAll("[data-day]").forEach(button=>button.onclick=()=>{cursor=new Date(`${button.dataset.day}T12:00`);mode="day";renderCalendar(root);});
  root.querySelectorAll("[data-event]").forEach(button=>button.onclick=()=>eventEditor(events.find(event=>event.id===button.dataset.event)));
  root.querySelectorAll("[data-duplicate]").forEach(button=>button.onclick=async event=>{
    event.stopPropagation(); const source=events.find(item=>item.id===button.dataset.duplicate);
    const {id,createdAt,updatedAt,...copy}=source; await saveEntity("calendarEvents",{...copy,title:`${copy.title} (Kopie)`},"duplicate");toast("Termin dupliziert");renderCalendar(root);
  });
  root.querySelectorAll("[data-delete]").forEach(button=>button.onclick=async event=>{event.stopPropagation();if(await confirmDialog("Termin samt Wiederholungsserie löschen?")){await removeEntity("calendarEvents",button.dataset.delete);renderCalendar(root);}});
}

const taskDate = task => task.dueDate || task.due?.slice(0,10) || "";
const sortEntries = (a,b) => a.date.localeCompare(b.date) || Number(!a.start)-Number(!b.start) || (a.start||0)-(b.start||0);

function range(){
  if(mode==="day"){const from=new Date(`${dateKey(cursor)}T00:00`);return[from,new Date(`${dateKey(cursor)}T23:59`),[from]];}
  if(mode==="week"){const from=startOfWeek(cursor,state.settings.profile.weekStart==="monday");return[from,new Date(addDays(from,7).getTime()-1),Array.from({length:7},(_,i)=>addDays(from,i))];}
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1),from=startOfWeek(first,state.settings.profile.weekStart==="monday"),days=Array.from({length:42},(_,i)=>addDays(from,i));
  return[from,new Date(addDays(from,42).getTime()-1),days];
}

function monthGrid(days,entries){
  const weekdays=state.settings.profile.weekStart==="monday"?["Mo","Di","Mi","Do","Fr","Sa","So"]:["So","Mo","Di","Mi","Do","Fr","Sa"];
  return `<section class="calendar-grid">${weekdays.map(day=>`<b>${day}</b>`).join("")}${days.map(day=>{const items=entries.filter(entry=>entry.date===dateKey(day));return `<button class="calendar-day ${day.getMonth()!==cursor.getMonth()?"muted":""} ${dateKey(day)===dateKey()?"today":""}" data-day="${dateKey(day)}"><span>${day.getDate()}</span><div class="calendar-markers">${items.slice(0,5).map(item=>`<i title="${typeMeta[item.type][0]}: ${escapeHTML(item.title)}" style="background:${typeMeta[item.type][1]}">${typeMeta[item.type][2]}</i>`).join("")}</div>${items.length>5?`<small>+${items.length-5}</small>`:""}</button>`}).join("")}</section>`;
}
function weekView(days,entries){return `<section class="agenda">${days.map(day=>`<div class="agenda-day"><header><b>${day.toLocaleDateString("de-DE",{weekday:"short"})}</b><button data-day="${dateKey(day)}">${day.getDate()}</button></header><div>${entries.filter(e=>e.date===dateKey(day)).sort(sortEntries).map(entryRow).join("")||"<p class='muted'>Frei</p>"}</div></div>`).join("")}</section>`;}
function dayView(day,entries){
  const current=entries.filter(e=>e.date===dateKey(day)).sort(sortEntries),timed=current.filter(e=>e.start),free=current.filter(e=>!e.start);
  return `<section class="day-calendar"><div class="card"><h2>Zeitgebunden</h2>${timed.map(entryRow).join("")||empty("Keine Zeiten belegt","Füge einen Termin oder Block hinzu.")}</div><div class="card"><h2>Ohne Uhrzeit</h2>${free.map(entryRow).join("")||empty("Keine ungebundenen Einträge","Datierte Aufgaben und Maintenance erscheinen hier.")}</div></section>`;
}
function entryRow(entry){
  const [label,color,mark]=typeMeta[entry.type],hour12=state.settings.profile.timeFormat==="12";
  return `<div class="event-row calendar-entry" style="--entry:${color}"><i></i><span><b>${mark} ${escapeHTML(entry.title)}</b><small>${label}${entry.start?` · ${formatTime(entry.start,hour12)}${entry.end?`–${formatTime(entry.end,hour12)}`:""}`:" · ohne Uhrzeit"}</small></span>${entry.type==="event"?`<button data-event="${entry.id}" aria-label="Termin bearbeiten">✎</button><button data-duplicate="${entry.id}" aria-label="Termin duplizieren">⧉</button><button data-delete="${entry.id}" aria-label="Termin löschen">×</button>`:""}</div>`;
}

export function eventEditor(event={}){
  event ||= {};
  const now=new Date(),start=event.start||localDateTime(new Date(now.setMinutes(Math.ceil(now.getMinutes()/30)*30)));
  modal({title:event.id?"Termin bearbeiten":"Neuer Termin",content:`<form class="form-grid">
    ${field({label:"Titel",name:"title",value:event.title,required:true})}
    <div class="two-col">${field({label:"Kategorie",name:"category",value:event.category})}${field({label:"Ganztägig",name:"allDay",type:"checkbox",value:event.allDay})}</div>
    <div class="two-col">${field({label:"Beginn",name:"start",type:"datetime-local",value:start,required:true})}${field({label:"Ende",name:"end",type:"datetime-local",value:event.end||start,required:true})}</div>
    ${field({label:"Ort",name:"location",value:event.location})}${field({label:"Beschreibung",name:"description",type:"textarea",value:event.description})}
    <div class="two-col">${field({label:"Wiederholung",name:"recurrence",type:"select",value:event.recurrence||"none",options:[["none","Keine"],["daily","Tage"],["weekly","Wochen"],["monthly","Monate"],["yearly","Jahre"],["customDays","Benutzerdefiniert (Tage)"]]})}${field({label:"Intervall",name:"recurrenceInterval",type:"number",value:event.recurrenceInterval||1,min:1})}</div>
    ${field({label:"Ende der Serie",name:"recurrenceUntil",type:"date",value:event.recurrenceUntil})}${field({label:"Farbe",name:"color",type:"color",value:event.color||"#477b68"})}${field({label:"Notiz",name:"notes",type:"textarea",value:event.notes})}
    <button class="button primary">Speichern</button></form>`,onOpen:sheet=>sheet.querySelector("form").onsubmit=async e=>{e.preventDefault();const values=formValues(e.target);if(values.end<values.start)return toast("Ende muss nach dem Beginn liegen","error");await saveEntity("calendarEvents",{...event,...values});closeModal();toast("Termin gespeichert");window.dispatchEvent(new HashChangeEvent("hashchange"));}});
}
function move(direction,root){if(mode==="month")cursor.setMonth(cursor.getMonth()+direction);else cursor.setDate(cursor.getDate()+direction*(mode==="week"?7:1));renderCalendar(root);}
