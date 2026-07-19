import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey, monthKey } from "../utils/date.js";
import { escapeHTML, tags } from "../utils/format.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty } from "../components/ui.js";

let filter = { month: monthKey(), mood: "all", tag: "" };

export async function renderJournal(root) {
  const allEntries = await db.all("journalEntries");
  const entries = allEntries.filter(item =>
    item.date?.startsWith(filter.month) && (filter.mood === "all" || item.mood === filter.mood) &&
    (!filter.tag || item.tags?.some(tag => tag.toLowerCase().includes(filter.tag.toLowerCase())))
  ).sort((a,b) => b.date.localeCompare(a.date));
  const energy = entries.length ? entries.reduce((sum,e) => sum + Number(e.energy || 0), 0) / entries.length : 0;
  const moods = entries.reduce((sum,e) => sum + Number(e.mood || 0), 0);
  const popularTags = Object.entries(allEntries.filter(item => item.date?.startsWith(filter.month))
    .flatMap(item => item.tags || []).reduce((counts, tag) => ({ ...counts, [tag]: (counts[tag] || 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  root.innerHTML = `${pageHeader("Journal", "Gedanken, Stimmung und Energie im Verlauf.", '<button class="button primary" data-add>＋ Eintrag</button>')}
    <section class="stats"><article><b>${entries.length}</b><span>Einträge</span></article><article><b>${entries.length ? (moods/entries.length).toFixed(1) : "–"}</b><span>Ø Stimmung</span></article><article><b>${energy ? energy.toFixed(1) : "–"}</b><span>Ø Energie</span></article></section>
    ${popularTags.length ? `<div class="tags journal-tags"><small>Häufige Tags:</small>${popularTags.map(([tag, count]) => `<button data-popular-tag="${escapeHTML(tag)}">#${escapeHTML(tag)} <small>${count}</small></button>`).join("")}</div>` : ""}
    <section class="toolbar"><input type="month" data-month value="${filter.month}"><select data-mood><option value="all">Alle Stimmungen</option>${[1,2,3,4,5].map(n => `<option value="${n}">${"●".repeat(n)} ${n}/5</option>`).join("")}</select><input data-tag placeholder="Tag filtern" value="${escapeHTML(filter.tag)}"></section>
    <section class="journal-grid">${entries.length ? entries.map(entry => `<article class="card journal-entry"><header><time>${escapeHTML(entry.date)}${entry.time ? ` · ${escapeHTML(entry.time)}` : ""}</time><span title="Stimmung">${["","😞","🙁","😐","🙂","😄"][entry.mood] || "–"} · ⚡ ${entry.energy || "–"}</span></header><h2>${escapeHTML(entry.title || "Notiz")}</h2><p>${escapeHTML(entry.content)}</p>${reflection(entry)}<div class="tags">${(entry.tags || []).map(t => `<span>#${escapeHTML(t)}</span>`).join("")}</div><footer><button data-edit="${entry.id}">Bearbeiten</button><button data-delete="${entry.id}">Löschen</button></footer></article>`).join("") : empty("Keine Journaleinträge", "Halte fest, wie dein Tag wirklich war.", '<button class="button primary" data-empty-add>Eintrag schreiben</button>')}</section>`;
  root.querySelector("[data-add]").onclick = () => journalEditor();
  root.querySelector("[data-empty-add]")?.addEventListener("click", () => journalEditor());
  root.querySelector("[data-month]").onchange = e => { filter.month = e.target.value; renderJournal(root); };
  root.querySelector("[data-mood]").value = filter.mood;
  root.querySelector("[data-mood]").onchange = e => { filter.mood = e.target.value; renderJournal(root); };
  root.querySelector("[data-tag]").oninput = e => { filter.tag = e.target.value; renderJournal(root); };
  root.querySelectorAll("[data-popular-tag]").forEach(button => button.onclick = () => { filter.tag = button.dataset.popularTag; renderJournal(root); });
  root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => journalEditor(entries.find(e => e.id === b.dataset.edit)));
  root.querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => { if (await confirmDialog("Journaleintrag löschen?")) { await removeEntity("journalEntries",b.dataset.delete); renderJournal(root); } });
}

export function journalEditor(entry = {}) {
  modal({
    title: entry.id ? "Eintrag bearbeiten" : "Neuer Journaleintrag",
    content: `<form class="form-grid"><div class="two-col">${field({label:"Datum",name:"date",type:"date",value:entry.date || dateKey(),required:true})}${field({label:"Uhrzeit",name:"time",type:"time",value:entry.time || new Date().toTimeString().slice(0,5),required:true})}</div>${field({label:"Titel",name:"title",value:entry.title})}${field({label:"Freier Text",name:"content",type:"textarea",value:entry.content,required:true})}<div class="two-col">${field({label:"Stimmung",name:"mood",type:"select",value:entry.mood || 3,options:[[1,"😞 1"],[2,"🙁 2"],[3,"😐 3"],[4,"🙂 4"],[5,"😄 5"]]})}${field({label:"Energie 1–5",name:"energy",type:"number",value:entry.energy || 3,min:1,max:5})}</div>${field({label:"Wins",name:"wins",type:"textarea",value:entry.wins})}${field({label:"Herausforderungen",name:"challenges",type:"textarea",value:entry.challenges})}${field({label:"Erkenntnisse",name:"insights",type:"textarea",value:entry.insights})}${field({label:"Nächste Verbesserung",name:"nextImprovement",type:"textarea",value:entry.nextImprovement})}${field({label:"Tags",name:"tags",value:entry.tags?.join(", ")})}<button class="button primary">Speichern</button></form>`,
    onOpen: sheet => sheet.querySelector("form").onsubmit = async e => { e.preventDefault(); const value=formValues(e.target); value.tags=tags(value.tags); await saveEntity("journalEntries",{...entry,...value}); closeModal(); toast("Eintrag gespeichert"); window.dispatchEvent(new HashChangeEvent("hashchange")); }
  });
}

function reflection(entry) {
  const rows = [["Win", entry.wins], ["Herausforderung", entry.challenges], ["Erkenntnis", entry.insights], ["Nächste Verbesserung", entry.nextImprovement]].filter(([, value]) => value);
  return rows.length ? `<dl class="journal-reflection">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>` : "";
}
