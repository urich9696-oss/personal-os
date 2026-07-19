import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey, addDays, startOfWeek, maintenanceDue } from "../utils/date.js";
import { escapeHTML } from "../utils/format.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty, progress } from "../components/ui.js";
import { state } from "../state.js";

let selectedDate=dateKey(),view="today";
const dayStatuses={open:"Offen",partial:"Teilweise",done:"Erledigt",skipped:"Übersprungen"};

export async function renderMaintenance(root){
  const [templates,days]=await Promise.all([db.all("maintenanceTemplates"),db.all("maintenanceDays")]);
  const current=days.find(row=>row.date===selectedDate)||{date:selectedDate,status:"open",note:"",checks:{}};
  const date=new Date(`${selectedDate}T12:00`),due=templates.filter(t=>maintenanceDue(t,date)),completed=due.filter(t=>routineDone(current,t)).length;
  root.innerHTML=`${pageHeader("Maintenance","Wiederkehrende Pflege mit detaillierten Tagesprotokollen.",'<button class="button primary" data-add>＋ Routine</button>')}
    <div class="segmented maintenance-tabs">${[["today","Heute"],["week","Diese Woche"],["all","Alle"],["history","Verlauf"],["paused","Pausiert"]].map(([key,label])=>`<button data-view="${key}" class="${view===key?"active":""}">${label}</button>`).join("")}</div>
    ${view==="today"?todayView(current,due,completed):view==="week"?weekView(templates,days,date):view==="history"?historyView(days):templateView(templates.filter(t=>view==="paused"?t.paused:!t.paused))}
  `;
  root.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;renderMaintenance(root);});
  root.querySelectorAll("[data-add]").forEach(button=>button.onclick=()=>editor());
  root.querySelector("[data-day]")?.addEventListener("change",e=>{selectedDate=e.target.value;renderMaintenance(root);});
  root.querySelectorAll("[data-day-status]").forEach(b=>b.onclick=async()=>{const status=b.dataset.dayStatus;await saveEntity("maintenanceDays",{...current,status,completedAt:status==="done"?new Date().toISOString():current.completedAt||null},"day-status");renderMaintenance(root);});
  root.querySelector("[data-note]")?.addEventListener("change",async e=>{await saveEntity("maintenanceDays",{...current,note:e.target.value},"note");toast("Tagesnotiz gespeichert");});
  root.querySelectorAll("[data-routine]").forEach(input=>input.onchange=()=>setRoutineStatus(current,input.dataset.routine,input.checked?"done":"open",root));
  root.querySelectorAll("[data-check-item]").forEach(input=>input.onchange=()=>setChecklistItem(current,input.dataset.template,Number(input.dataset.checkItem),input.checked,templates,root));
  root.querySelectorAll("[data-pause]").forEach(b=>b.onclick=async()=>{const t=templates.find(t=>t.id===b.dataset.pause);await saveEntity("maintenanceTemplates",{...t,paused:!t.paused},t.paused?"resume":"pause");renderMaintenance(root);});
  root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editor(templates.find(t=>t.id===b.dataset.edit)));
  root.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(await confirmDialog("Routine löschen? Historische Tagesprotokolle bleiben erhalten.")){await removeEntity("maintenanceTemplates",b.dataset.delete);renderMaintenance(root);}});
}

function todayView(current,due,completed){
  const ratio=due.length?completed/due.length*100:0;
  return `<section class="card maintenance-today"><header><div><h2>Tagesstatus</h2><p>${completed} von ${due.length} Routinen erledigt · ${dayStatuses[current.status||"open"]}</p></div><input type="date" data-day value="${selectedDate}"></header>${progress(ratio)}
    <div class="status-buttons">${Object.entries(dayStatuses).map(([key,label])=>`<button data-day-status="${key}" class="${current.status===key?"active":""}">${label}</button>`).join("")}</div>
    <label class="field"><span>Tagesnotiz</span><textarea data-note placeholder="Was war heute besonders?">${escapeHTML(current.note)}</textarea></label>
    <div class="maintenance-routines">${due.length?due.map(template=>routineCard(template,current)).join(""):empty("Heute nichts fällig","Passe Routinen an oder genieße den freien Tag.",'<button class="button primary" data-add>Routine anlegen</button>')}</div></section>`;
}
function routineCard(template,day){
  const record=day.checks?.[template.id]||{},items=template.checklist||[],doneItems=items.filter((_,i)=>itemDone(record.items?.[i])).length,done=routineDone(day,template);
  return `<article class="maintenance-routine ${done?"done":""}"><header><label><input type="checkbox" data-routine="${template.id}" ${done?"checked":""}><span><b>${escapeHTML(template.title)}</b><small>${template.preferredTime?`${template.preferredTime} · `:""}${escapeHTML(template.category||"Allgemein")} · ${recurrenceLabel(template)}</small></span></label><span>${items.length?`${doneItems}/${items.length}`:done?"✓":""}</span></header>${template.description?`<p>${escapeHTML(template.description)}</p>`:""}${items.length?`<div class="sub-checklist">${items.map((item,index)=>`<label><input type="checkbox" data-template="${template.id}" data-check-item="${index}" ${itemDone(record.items?.[index])?"checked":""}><span>${escapeHTML(item)}</span></label>`).join("")}</div>`:""}${record.completedAt?`<small>Abgeschlossen ${new Date(record.completedAt).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</small>`:""}</article>`;
}
function weekView(templates,days,date){
  const start=startOfWeek(date,state.settings.profile.weekStart==="monday"),week=Array.from({length:7},(_,i)=>addDays(start,i));
  return `<section class="week-maintenance">${week.map(day=>{const due=templates.filter(t=>maintenanceDue(t,day)),record=days.find(d=>d.date===dateKey(day))||{checks:{}};return `<article class="card"><header><b>${day.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit"})}</b><span>${due.filter(t=>routineDone(record,t)).length}/${due.length}</span></header>${due.map(t=>`<div class="${routineDone(record,t)?"done":""}">${routineDone(record,t)?"✓":"○"} ${escapeHTML(t.title)}</div>`).join("")||"<small>Frei</small>"}</article>`}).join("")}</section>`;
}
function templateView(templates){return `<section class="card"><h2>Routinen</h2><div class="maintenance-list">${templates.length?templates.map(t=>`<article class="${t.paused?"paused":""}"><div><b>${escapeHTML(t.title)}</b><small>${recurrenceLabel(t)}${t.preferredTime?` · ${t.preferredTime}`:""} · ${escapeHTML(t.category||"Allgemein")}</small></div><button data-pause="${t.id}">${t.paused?"Fortsetzen":"Pausieren"}</button><button data-edit="${t.id}">✎</button><button data-delete="${t.id}">×</button></article>`).join(""):empty("Keine Routinen","Lege eine nutzerdefinierte Wiederholung an.")}</div></section>`;}
function historyView(days){return `<section class="card"><h2>Verlauf</h2><div class="history">${days.sort((a,b)=>b.date.localeCompare(a.date)).map(day=>`<div><time>${day.date}</time><span>${dayStatuses[day.status||"open"]} · ${Object.values(day.checks||{}).filter(r=>r===true||r.status==="done").length} erledigt${day.completedAt?` · ${new Date(day.completedAt).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}`:""}</span></div>`).join("")||empty("Noch kein Verlauf","Erledigte Routinen werden hier protokolliert.")}</div></section>`;}
const itemDone=value=>value===true||value?.status==="done";
function routineDone(day,template){const record=day.checks?.[template.id];if(record===true)return true;if(!record)return false;const items=template.checklist||[];return record.status==="done"||(items.length>0&&items.every((_,i)=>itemDone(record.items?.[i])));}
function recurrenceLabel(t){const n=Math.max(1,Number(t.interval)||1);if(t.recurrence==="daily")return n===1?"Täglich":`Alle ${n} Tage`;if(t.recurrence==="customDays")return`Alle ${n} Tage`;if(t.recurrence==="weekly")return`${n===1?"Wöchentlich":`Alle ${n} Wochen`} (${(t.weekdays||[]).map(d=>["So","Mo","Di","Mi","Do","Fr","Sa"][d]).join(", ")})`;if(t.recurrence==="monthly")return n===1?"Monatlich":`Alle ${n} Monate`;if(t.recurrence==="yearly")return n===1?"Jährlich":`Alle ${n} Jahre`;return"Einmalig";}

async function setRoutineStatus(day,id,status,root){const checks={...(day.checks||{})},old=checks[id]&&typeof checks[id]==="object"?checks[id]:{};checks[id]={...old,status,completedAt:status==="done"?new Date().toISOString():null};await saveEntity("maintenanceDays",{...day,checks,status:deriveDayStatus(checks)},"routine-status");renderMaintenance(root);}
async function setChecklistItem(day,id,index,checked,templates,root){const checks={...(day.checks||{})},old=checks[id]&&typeof checks[id]==="object"?checks[id]:{},items={...(old.items||{}),[index]:{status:checked?"done":"open",completedAt:checked?new Date().toISOString():null}},template=templates.find(t=>t.id===id),done=(template.checklist||[]).every((_,i)=>itemDone(items[i]));checks[id]={...old,items,status:done?"done":"partial",completedAt:done?new Date().toISOString():null};await saveEntity("maintenanceDays",{...day,checks,status:deriveDayStatus(checks)},"check-item");renderMaintenance(root);}
const deriveDayStatus=checks=>{const rows=Object.values(checks);return rows.length&&rows.every(r=>r===true||r.status==="done")?"done":rows.some(r=>r===true||["done","partial"].includes(r.status))?"partial":"open";};
function editor(entry={}){
  entry||={};modal({title:entry.id?"Routine bearbeiten":"Neue Routine",content:`<form class="form-grid">${field({label:"Titel",name:"title",value:entry.title,required:true})}${field({label:"Beschreibung",name:"description",type:"textarea",value:entry.description})}<div class="two-col">${field({label:"Kategorie",name:"category",value:entry.category})}${field({label:"Bevorzugte Uhrzeit",name:"preferredTime",type:"time",value:entry.preferredTime})}</div><div class="three-col">${field({label:"Start",name:"startDate",type:"date",value:entry.startDate||dateKey(),required:true})}${field({label:"Wiederholung",name:"recurrence",type:"select",value:entry.recurrence||"daily",options:[["daily","Täglich"],["weekly","Wöchentlich"],["monthly","Monatlich"],["yearly","Jährlich"],["customDays","Benutzerdefiniert (Tage)"],["once","Einmalig"]]})}${field({label:"Intervall",name:"interval",type:"number",value:entry.interval||1,min:1})}</div>${field({label:"Wochentage (0=So … 6=Sa)",name:"weekdays",value:(entry.weekdays||[1]).join(",")})}<div class="two-col">${field({label:"Enddatum (optional)",name:"endDate",type:"date",value:entry.endDate})}${field({label:"Max. Vorkommen",name:"maxOccurrences",type:"number",value:entry.maxOccurrences||"",min:1})}</div>${field({label:"Checkliste (eine Zeile je Punkt)",name:"checklist",type:"textarea",value:(entry.checklist||[]).join("\n")})}<button class="button primary">Speichern</button></form>`,onOpen:sheet=>sheet.querySelector("form").onsubmit=async e=>{e.preventDefault();const value=formValues(e.target);value.weekdays=value.weekdays.split(",").map(Number).filter(n=>n>=0&&n<=6);value.checklist=value.checklist.split("\n").map(x=>x.trim()).filter(Boolean);await saveEntity("maintenanceTemplates",{...entry,...value,paused:entry.paused||false});closeModal();toast("Routine gespeichert");window.dispatchEvent(new HashChangeEvent("hashchange"));}});
}
