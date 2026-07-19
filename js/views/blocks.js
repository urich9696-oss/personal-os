import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey } from "../utils/date.js";
import { escapeHTML } from "../utils/format.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty } from "../components/ui.js";

let selectedDate = dateKey();

export async function renderBlocks(root) {
  const [templates, plans] = await Promise.all([db.all("blockTemplates"), db.all("dayPlans")]);
  const plan = plans.find(item => item.date === selectedDate);
  root.innerHTML = `${pageHeader("Blocks", "Vorlagen planen, ohne spätere Tagesinstanzen zu verändern.", '<button class="button primary" data-template>＋ Vorlage</button>')}
    <section class="toolbar"><label>Tag <input type="date" data-date value="${selectedDate}"></label><select data-load><option value="">Vorlage anwenden…</option>${templates.map(t => `<option value="${t.id}">${escapeHTML(t.title)}</option>`).join("")}</select></section>
    <div class="blocks-layout"><section class="card"><h2>Tagesplan</h2><div class="block-list" data-plan>${plan?.items?.length ? plan.items.map((item,i) => blockRow(item,i,true)).join("") : empty("Noch kein Plan", "Wende eine Vorlage an oder füge einen Block hinzu.")}</div><button class="button ghost" data-add-block>＋ Block</button></section>
    <section class="card"><h2>Vorlagen</h2><div class="template-list">${templates.length ? templates.map(template => `<article><header><b>${escapeHTML(template.title)}</b><span>${template.items?.length || 0} Blöcke</span></header>${(template.items || []).map((item,i) => blockRow(item,i,false,template.id)).join("")}<footer><button data-edit-template="${template.id}">Bearbeiten</button><button data-delete-template="${template.id}">Löschen</button></footer></article>`).join("") : empty("Keine Vorlagen", "Erstelle wiederverwendbare Tagesstrukturen.")}</div></section></div>`;
  root.querySelector("[data-date]").onchange = e => { selectedDate = e.target.value; renderBlocks(root); };
  root.querySelector("[data-template]").onclick = () => templateEditor();
  root.querySelector("[data-add-block]").onclick = () => planBlockEditor(plan);
  root.querySelector("[data-load]").onchange = async e => {
    const template = templates.find(t => t.id === e.target.value); if (!template) return;
    await saveEntity("dayPlans", { ...(plan || {}), date: selectedDate, items: structuredClone(template.items || []), templateId: template.id }, "instantiate");
    toast("Unabhängige Tagesinstanz erstellt"); renderBlocks(root);
  };
  root.querySelectorAll("[data-toggle-block]").forEach(b => b.onclick = async () => {
    const items = structuredClone(plan.items); items[Number(b.dataset.toggleBlock)].done = !items[Number(b.dataset.toggleBlock)].done;
    await saveEntity("dayPlans", { ...plan, items }); renderBlocks(root);
  });
  root.querySelectorAll("[data-edit-template]").forEach(b => b.onclick = () => templateEditor(templates.find(t => t.id === b.dataset.editTemplate)));
  root.querySelectorAll("[data-delete-template]").forEach(b => b.onclick = async () => {
    if (await confirmDialog("Vorlage löschen? Bestehende Tagespläne bleiben erhalten.")) { await removeEntity("blockTemplates", b.dataset.deleteTemplate); renderBlocks(root); }
  });
}

function blockRow(item, index, plan, templateId = "") {
  return `<div class="block ${item.done ? "done" : ""}" draggable="${!plan}" data-index="${index}" data-template-id="${templateId}"><span>${escapeHTML(item.start || "")}</span><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.duration || "30")} min</small>${plan ? `<button data-toggle-block="${index}">${item.done ? "✓" : "○"}</button>` : "<i>↕</i>"}</div>`;
}

function templateEditor(template = {}) {
  const items = structuredClone(template.items || []);
  const draw = sheet => {
    sheet.querySelector("[data-items]").innerHTML = items.map((item,i) => `<div class="editable-block" draggable="true" data-index="${i}"><span>↕</span><input value="${escapeHTML(item.start)}" type="time"><input value="${escapeHTML(item.title)}" placeholder="Blockname"><input value="${escapeHTML(item.duration)}" type="number" min="5" step="5"><button type="button" data-remove="${i}">×</button></div>`).join("");
    sheet.querySelectorAll(".editable-block").forEach(node => {
      node.ondragstart = e => e.dataTransfer.setData("text/plain", node.dataset.index);
      node.ondragover = e => e.preventDefault();
      node.ondrop = e => { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")), to = Number(node.dataset.index); items.splice(to,0,items.splice(from,1)[0]); draw(sheet); };
      node.querySelectorAll("input").forEach((input,k) => input.onchange = () => items[node.dataset.index][["start","title","duration"][k]] = input.value);
    });
    sheet.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => { items.splice(Number(b.dataset.remove),1); draw(sheet); });
  };
  modal({
    title: template.id ? "Vorlage bearbeiten" : "Neue Vorlage",
    wide: true,
    content: `<form class="form-grid">${field({label:"Name",name:"title",value:template.title,required:true})}<div data-items></div><button type="button" class="button ghost" data-add>＋ Element</button><button class="button primary">Vorlage speichern</button></form>`,
    onOpen: sheet => {
      draw(sheet);
      sheet.querySelector("[data-add]").onclick = () => { items.push({ start: "09:00", title: "Neuer Block", duration: 30 }); draw(sheet); };
      sheet.querySelector("form").onsubmit = async e => { e.preventDefault(); await saveEntity("blockTemplates", { ...template, ...formValues(e.target), items }); closeModal(); toast("Vorlage gespeichert"); window.dispatchEvent(new HashChangeEvent("hashchange")); };
    }
  });
}

function planBlockEditor(plan) {
  modal({
    title: "Block hinzufügen",
    content: `<form class="form-grid">${field({label:"Titel",name:"title",required:true})}<div class="two-col">${field({label:"Beginn",name:"start",type:"time",value:"09:00"})}${field({label:"Minuten",name:"duration",type:"number",value:30,min:5,step:5})}</div><button class="button primary">Hinzufügen</button></form>`,
    onOpen: sheet => sheet.querySelector("form").onsubmit = async e => {
      e.preventDefault(); const item = { ...formValues(e.target), done: false };
      await saveEntity("dayPlans", { ...(plan || {}), date: selectedDate, items: [...(plan?.items || []), item] });
      closeModal(); renderBlocks(document.querySelector("#main"));
    }
  });
}
