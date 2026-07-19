import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { escapeHTML } from "../utils/format.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty, progress } from "../components/ui.js";

export async function renderPath(root) {
  const [areas, goals, milestones, tasks] = await Promise.all(["lifeAreas","goals","milestones","tasks"].map(name => db.all(name)));
  root.innerHTML = `${pageHeader("Path", "Vom Lebensbereich bis zur nächsten konkreten Aufgabe.", '<button class="button primary" data-add-area>＋ Lebensbereich</button>')}
    <section class="path-list">${areas.length ? areas.map(area => areaCard(area, goals, milestones, tasks)).join("") : empty("Dein Path ist leer", "Lege einen Lebensbereich an und entwickle daraus Ziele.")}</section>`;
  root.querySelector("[data-add-area]").onclick = () => editor("lifeAreas", {});
  root.querySelectorAll("[data-add-goal]").forEach(b => b.onclick = () => editor("goals", { lifeAreaId: b.dataset.addGoal }));
  root.querySelectorAll("[data-add-milestone]").forEach(b => b.onclick = () => editor("milestones", { goalId: b.dataset.addMilestone }));
  root.querySelectorAll("[data-edit-entity]").forEach(b => b.onclick = async () => editor(b.dataset.store, (await db.get(b.dataset.store, b.dataset.editEntity))));
  root.querySelectorAll("[data-delete-entity]").forEach(b => b.onclick = async () => {
    if (await confirmDialog("Eintrag löschen? Verknüpfte Einträge bleiben erhalten.")) { await removeEntity(b.dataset.store, b.dataset.deleteEntity); renderPath(root); }
  });
}

function areaCard(area, goals, milestones, tasks) {
  const children = goals.filter(goal => goal.lifeAreaId === area.id);
  return `<article class="path-area card"><header><span class="area-color" style="background:${escapeHTML(area.color || "#4d7c68")}"></span><div><h2>${escapeHTML(area.title)}</h2><p>${escapeHTML(area.description || "")}</p></div><div class="item-actions"><button data-add-goal="${area.id}">＋ Ziel</button><button data-edit-entity="${area.id}" data-store="lifeAreas">✎</button><button data-delete-entity="${area.id}" data-store="lifeAreas">×</button></div></header>
    <div class="goal-list">${children.length ? children.map(goal => goalCard(goal, milestones, tasks)).join("") : "<p class='muted'>Noch keine Ziele.</p>"}</div></article>`;
}

function goalCard(goal, milestones, tasks) {
  const ms = milestones.filter(item => item.goalId === goal.id);
  const linkedTasks = tasks.filter(task => task.goalId === goal.id || ms.some(item => item.id === task.milestoneId));
  const automatic = linkedTasks.length ? linkedTasks.filter(task => task.status === "done").length / linkedTasks.length * 100 : 0;
  const value = goal.progressMode === "manual" ? Number(goal.progress || 0) : automatic;
  return `<section class="goal"><header><div><h3>${escapeHTML(goal.title)}</h3><small>${goal.progressMode === "manual" ? "Manuell" : "Automatisch"} · ${Math.round(value)}%</small></div><div class="item-actions"><button data-add-milestone="${goal.id}">＋ Meilenstein</button><button data-edit-entity="${goal.id}" data-store="goals">✎</button><button data-delete-entity="${goal.id}" data-store="goals">×</button></div></header>${progress(value)}
    <div class="milestones">${ms.map(item => {
      const mt = tasks.filter(task => task.milestoneId === item.id);
      const done = mt.length ? mt.filter(task => task.status === "done").length / mt.length * 100 : Number(item.progress || 0);
      return `<div><span>◆ ${escapeHTML(item.title)}</span><small>${Math.round(done)}%</small><button data-edit-entity="${item.id}" data-store="milestones">✎</button><button data-delete-entity="${item.id}" data-store="milestones">×</button></div>`;
    }).join("") || "<small>Keine Meilensteine</small>"}</div></section>`;
}

async function editor(store, entity) {
  const names = { lifeAreas: "Lebensbereich", goals: "Ziel", milestones: "Meilenstein" };
  modal({
    title: `${entity.id ? "Bearbeiten" : "Neu"}: ${names[store]}`,
    content: `<form class="form-grid">${field({label:"Titel",name:"title",value:entity.title,required:true})}
      ${store === "lifeAreas" ? `${field({label:"Beschreibung",name:"description",type:"textarea",value:entity.description})}${field({label:"Farbe",name:"color",type:"color",value:entity.color || "#4d7c68"})}` : ""}
      ${store === "goals" ? `${field({label:"Fortschritt",name:"progressMode",type:"select",value:entity.progressMode || "automatic",options:[["automatic","Automatisch aus Aufgaben"],["manual","Manuell"]]})}${field({label:"Manuell in %",name:"progress",type:"number",min:0,max:100,value:entity.progress || 0})}${field({label:"Zieldatum",name:"targetDate",type:"date",value:entity.targetDate})}` : ""}
      ${store === "milestones" ? `${field({label:"Zieldatum",name:"targetDate",type:"date",value:entity.targetDate})}${field({label:"Fortschritt ohne Aufgaben",name:"progress",type:"number",min:0,max:100,value:entity.progress || 0})}` : ""}
      <button class="button primary">Speichern</button></form>`,
    onOpen: sheet => sheet.querySelector("form").onsubmit = async e => {
      e.preventDefault(); await saveEntity(store, { ...entity, ...formValues(e.target) });
      closeModal(); toast(`${names[store]} gespeichert`); window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  });
}
