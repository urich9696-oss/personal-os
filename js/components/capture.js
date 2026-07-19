import { db } from "../db.js";
import { globalSearch } from "../services/data.js";
import { escapeHTML, money } from "../utils/format.js";
import { modal, closeModal, icon } from "./ui.js";
import { taskEditor } from "../views/tasks.js";
import { eventEditor } from "../views/calendar.js";
import { journalEditor } from "../views/journal.js";
import { transactionEditor } from "../views/finance.js";
import { router } from "../router.js";
import { state } from "../state.js";

export function openCapture(initial) {
  const actions = [
    ["task","Aufgabe","Eine nächste Aktion festhalten"],
    ["event","Termin","Zeit im Kalender reservieren"],
    ["journal","Journal","Gedanken und Stimmung notieren"],
    ["expense","Ausgabe","Eine Ausgabe buchen"],
    ["income","Einnahme","Eine Einnahme buchen"]
  ];
  if (initial) return launch(initial);
  modal({ title:"Schnell erfassen",content:`<div class="capture-grid">${actions.map(([type,title,text])=>`<button data-type="${type}"><span>${icon(type==="event"?"calendar":type)}</span><b>${title}</b><small>${text}</small></button>`).join("")}</div>`,onOpen:sheet=>sheet.querySelectorAll("[data-type]").forEach(b=>b.onclick=()=>launch(b.dataset.type)) });
}

async function launch(type) {
  closeModal();
  if (type === "task") return taskEditor({}, await db.all("goals"), await db.all("milestones"));
  if (type === "event") return eventEditor();
  if (type === "journal") return journalEditor();
  return transactionEditor({}, await db.all("financeCategories"), type);
}

const routeFor = { tasks:"tasks",calendarEvents:"calendar",lifeAreas:"path",goals:"path",milestones:"path",blockTemplates:"blocks",journalEntries:"journal",transactions:"finance",maintenanceTemplates:"maintenance" };
const labels = { tasks:"Aufgaben",calendarEvents:"Kalender",lifeAreas:"Lebensbereiche",goals:"Ziele",milestones:"Meilensteine",blockTemplates:"Blockvorlagen",journalEntries:"Journal",transactions:"Finance",maintenanceTemplates:"Maintenance" };

export function openSearch() {
  modal({
    title:"Globale Suche",
    wide:true,
    content:`<label class="search-box"><span>⌕</span><input type="search" placeholder="Aufgaben, Termine, Ziele, Journal …" aria-label="Suchbegriff"></label><div class="search-results"><p class="muted">Tippe mindestens ein Zeichen.</p></div>`,
    onOpen:sheet=>{
      const input=sheet.querySelector("input"),results=sheet.querySelector(".search-results");
      input.oninput=async()=>{
        const rows=await globalSearch(input.value);
        const grouped=Object.groupBy ? Object.groupBy(rows,r=>r.store) : rows.reduce((o,r)=>((o[r.store]||=[]).push(r),o),{});
        results.innerHTML=rows.length?Object.entries(grouped).map(([store,items])=>`<section><h3>${labels[store]}</h3>${items.map(({row})=>`<button data-route-to="${routeFor[store]}"><b>${escapeHTML(row.title||row.name||row.description||"Eintrag")}</b><small>${escapeHTML(row.date||row.due||row.start||"")}${store==="transactions"?` · ${money(row.amount,state.settings.profile.currency)}`:""}</small></button>`).join("")}</section>`).join(""):`<p class="muted">Keine Treffer.</p>`;
        results.querySelectorAll("[data-route-to]").forEach(b=>b.onclick=()=>{closeModal();router.go(b.dataset.routeTo);});
      };
    }
  });
}
