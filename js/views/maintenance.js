import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey, maintenanceDue } from "../utils/date.js";
import { escapeHTML } from "../utils/format.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty, progress } from "../components/ui.js";

let day = dateKey();

export async function renderMaintenance(root) {
  const [templates, days] = await Promise.all([db.all("maintenanceTemplates"),db.all("maintenanceDays")]);
  const current = days.find(row=>row.date===day) || {date:day,checks:{}};
  const due = templates.filter(t=>maintenanceDue(t,new Date(`${day}T12:00`)));
  const done = due.filter(t=>current.checks[t.id]).length;
  root.innerHTML=`${pageHeader("Maintenance","Wiederkehrende Pflege für Dinge, Gesundheit und Alltag.",'<button class="button primary" data-add>＋ Routine</button>')}
    <section class="card maintenance-today"><header><div><h2>Tagesstatus</h2><p>${done} von ${due.length} erledigt</p></div><input type="date" data-day value="${day}"></header>${progress(due.length?done/due.length*100:0)}
    <div class="checklist">${due.length?due.map(t=>`<label><input type="checkbox" data-check="${t.id}" ${current.checks[t.id]?"checked":""}><span><b>${escapeHTML(t.title)}</b><small>${escapeHTML(t.category||"Allgemein")}</small></span></label>`).join(""):empty("Heute nichts fällig","Deine aktiven Wiederholungen erzeugen heute keine Punkte.")}</div></section>
    <section class="card"><h2>Vorlagen</h2><div class="maintenance-list">${templates.length?templates.map(t=>`<article class="${t.paused?"paused":""}"><div><b>${escapeHTML(t.title)}</b><small>${label(t)} · ${escapeHTML(t.category||"Allgemein")}</small></div><button data-pause="${t.id}">${t.paused?"Fortsetzen":"Pause"}</button><button data-edit="${t.id}">✎</button><button data-delete="${t.id}">×</button></article>`).join(""):empty("Keine Routinen","Erstelle eine wiederkehrende Maintenance-Aufgabe.")}</div></section>
    <section class="card"><h2>Verlauf</h2><div class="history">${days.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(d=>`<div><time>${d.date}</time><span>${Object.values(d.checks||{}).filter(Boolean).length} erledigt</span></div>`).join("")||"<p class='muted'>Noch kein Verlauf.</p>"}</div></section>`;
  root.querySelector("[data-add]").onclick=()=>editor();
  root.querySelector("[data-day]").onchange=e=>{day=e.target.value;renderMaintenance(root);};
  root.querySelectorAll("[data-check]").forEach(input=>input.onchange=async()=>{await saveEntity("maintenanceDays",{...current,checks:{...current.checks,[input.dataset.check]:input.checked}}, "check");renderMaintenance(root);});
  root.querySelectorAll("[data-pause]").forEach(b=>b.onclick=async()=>{const t=templates.find(t=>t.id===b.dataset.pause);await saveEntity("maintenanceTemplates",{...t,paused:!t.paused},"pause");renderMaintenance(root);});
  root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editor(templates.find(t=>t.id===b.dataset.edit)));
  root.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(await confirmDialog("Routine löschen? Der Tagesverlauf bleibt erhalten.")){await removeEntity("maintenanceTemplates",b.dataset.delete);renderMaintenance(root);}});
}
function label(t){if(t.recurrence==="daily")return `Alle ${t.interval||1} Tage`;if(t.recurrence==="weekly")return `Wöchentlich (${(t.weekdays||[]).map(d=>["So","Mo","Di","Mi","Do","Fr","Sa"][d]).join(", ")})`;if(t.recurrence==="monthly")return"Monatlich";return"Einmalig";}
function editor(entry={}){
  modal({title:entry.id?"Routine bearbeiten":"Neue Routine",content:`<form class="form-grid">${field({label:"Titel",name:"title",value:entry.title,required:true})}${field({label:"Kategorie",name:"category",value:entry.category})}<div class="two-col">${field({label:"Start",name:"startDate",type:"date",value:entry.startDate||dateKey(),required:true})}${field({label:"Wiederholung",name:"recurrence",type:"select",value:entry.recurrence||"daily",options:[["daily","Täglich"],["weekly","Wöchentlich"],["monthly","Monatlich"],["once","Einmalig"]]})}</div>${field({label:"Intervall (Tage)",name:"interval",type:"number",value:entry.interval||1,min:1})}${field({label:"Wochentage (0=So … 6=Sa)",name:"weekdays",value:(entry.weekdays||[1]).join(",")})}${field({label:"Checkliste (eine Zeile je Punkt)",name:"checklist",type:"textarea",value:(entry.checklist||[]).join("\n")})}<button class="button primary">Speichern</button></form>`,onOpen:s=>s.querySelector("form").onsubmit=async e=>{e.preventDefault();const v=formValues(e.target);v.weekdays=v.weekdays.split(",").map(Number).filter(n=>n>=0&&n<=6);v.checklist=v.checklist.split("\n").map(x=>x.trim()).filter(Boolean);await saveEntity("maintenanceTemplates",{...entry,...v,paused:entry.paused||false});closeModal();toast("Routine gespeichert");window.dispatchEvent(new HashChangeEvent("hashchange"));}});
}
