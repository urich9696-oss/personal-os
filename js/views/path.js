import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { escapeHTML } from "../utils/format.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty, progress } from "../components/ui.js";
import { taskEditor } from "./tasks.js";

const goalStatuses={planned:"Geplant",active:"Aktiv",paused:"Pausiert",achieved:"Erreicht",cancelled:"Abgebrochen"};
const milestoneStatuses={open:"Offen",inProgress:"In Arbeit",done:"Erledigt"};
const priorities={critical:"Kritisch",high:"Hoch",medium:"Mittel",low:"Niedrig"};

export async function renderPath(root){
  const [areas,goals,milestones,tasks,activity]=await Promise.all(["lifeAreas","goals","milestones","tasks","activityLog"].map(db.all));
  const orderedGoals=goals.sort((a,b)=>(a.order??999)-(b.order??999));
  root.innerHTML=`${pageHeader("Path","Lebensbereiche, Ziele, Meilensteine und nächste Aktionen.",'<button class="button primary" data-add-area>＋ Lebensbereich</button>')}
    <section class="path-list">${areas.length?areas.map(area=>areaCard(area,orderedGoals,milestones,tasks)).join(""):empty("Dein Path ist leer","Lege einen Lebensbereich und anschließend ein Ziel an.",'<button class="button primary" data-empty-area>Lebensbereich anlegen</button>')}</section>
    <section class="card path-activity"><h2>Aktivitätsverlauf</h2>${activity.filter(row=>["goals","milestones","lifeAreas"].includes(row.entity)).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,20).map(row=>`<div><time>${new Date(row.timestamp).toLocaleString("de-DE")}</time><span>${escapeHTML(row.action)} · ${escapeHTML(row.detail||row.entity)}</span></div>`).join("")||"<p class='muted'>Noch keine Path-Aktivität.</p>"}</section>`;
  const addArea=()=>entityEditor("lifeAreas",{});
  root.querySelector("[data-add-area]").onclick=addArea;root.querySelector("[data-empty-area]")?.addEventListener("click",addArea);
  root.querySelectorAll("[data-add-goal]").forEach(b=>b.onclick=()=>entityEditor("goals",{lifeAreaId:b.dataset.addGoal,order:goals.filter(g=>g.lifeAreaId===b.dataset.addGoal).length}));
  root.querySelectorAll("[data-add-milestone]").forEach(b=>b.onclick=()=>entityEditor("milestones",{goalId:b.dataset.addMilestone,order:milestones.filter(m=>m.goalId===b.dataset.addMilestone).length}));
  root.querySelectorAll("[data-next-task]").forEach(b=>b.onclick=()=>taskEditor({goalId:b.dataset.nextTask},goals,milestones));
  root.querySelectorAll("[data-edit-entity]").forEach(b=>b.onclick=async()=>entityEditor(b.dataset.store,await db.get(b.dataset.store,b.dataset.editEntity)));
  root.querySelectorAll("[data-goal-status]").forEach(b=>b.onclick=async()=>{const goal=goals.find(g=>g.id===b.dataset.goalStatus);await saveEntity("goals",{...goal,status:b.dataset.status},b.dataset.status);toast(`Ziel: ${goalStatuses[b.dataset.status]}`);renderPath(root);});
  root.querySelectorAll("[data-move-ms]").forEach(b=>b.onclick=()=>moveMilestone(b.dataset.moveMs,Number(b.dataset.direction),milestones,root));
  root.querySelectorAll("[data-delete-entity]").forEach(b=>b.onclick=()=>deleteEntity(b.dataset.store,b.dataset.deleteEntity,{goals,milestones,tasks},root));
}

function areaCard(area,goals,milestones,tasks){
  const children=goals.filter(goal=>goal.lifeAreaId===area.id).sort((a,b)=>(a.order??999)-(b.order??999));
  return `<article class="path-area card"><header><span class="area-color" style="background:${escapeHTML(area.color||"#4d7c68")}"></span><div><h2>${escapeHTML(area.title)}</h2><p>${escapeHTML(area.description||"")}</p></div><div class="item-actions"><button data-add-goal="${area.id}">＋ Ziel</button><button data-edit-entity="${area.id}" data-store="lifeAreas">✎</button><button data-delete-entity="${area.id}" data-store="lifeAreas">×</button></div></header><div class="goal-list">${children.length?children.map(goal=>goalCard(goal,milestones,tasks)).join(""):"<p class='muted'>Noch keine Ziele.</p>"}</div></article>`;
}
function goalCard(goal,milestones,tasks){
  const ms=milestones.filter(m=>m.goalId===goal.id).sort((a,b)=>(a.order??999)-(b.order??999));
  const linked=tasks.filter(t=>t.goalId===goal.id||ms.some(m=>m.id===t.milestoneId)),open=linked.filter(t=>!["done","archived"].includes(t.status));
  const automatic=linked.length?linked.filter(t=>t.status==="done").length/linked.length*100:ms.length?ms.filter(m=>m.status==="done").length/ms.length*100:0;
  const value=goal.progressMode==="manual"?Number(goal.progress||0):automatic,nextMilestone=ms.find(m=>m.status!=="done"),nextTask=open.sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"))[0];
  return `<section class="goal ${goal.status||"planned"}" style="--goal:${escapeHTML(goal.color||"#4d7c68")}"><header><span class="goal-symbol">${escapeHTML(goal.symbol||"◇")}</span><div><h3>${escapeHTML(goal.title)}</h3><small>${goalStatuses[goal.status||"planned"]} · ${priorities[goal.priority||"medium"]} · ${Math.round(value)}%</small></div><div class="item-actions"><button data-add-milestone="${goal.id}">＋ Meilenstein</button><button data-next-task="${goal.id}">＋ Aktion</button><button data-edit-entity="${goal.id}" data-store="goals">✎</button><button data-delete-entity="${goal.id}" data-store="goals">×</button></div></header>${goal.description?`<p>${escapeHTML(goal.description)}</p>`:""}${progress(value)}
    <div class="goal-controls">${goal.status!=="paused"?`<button data-goal-status="${goal.id}" data-status="paused">Pausieren</button>`:`<button data-goal-status="${goal.id}" data-status="active">Fortsetzen</button>`}<button data-goal-status="${goal.id}" data-status="achieved">Abschließen</button></div>
    <div class="next-action"><b>Nächster Fokus</b><span>${nextMilestone?`◆ ${escapeHTML(nextMilestone.title)}`:"Kein offener Meilenstein"}${nextTask?` · ✓ ${escapeHTML(nextTask.title)}`:""}</span></div>
    <div class="milestones">${ms.map((item,index)=>`<div><span>◆ <b>${escapeHTML(item.title)}</b>${item.description?`<small>${escapeHTML(item.description)}</small>`:""}</span><small>${milestoneStatuses[item.status||"open"]}</small><button data-move-ms="${item.id}" data-direction="-1" ${index===0?"disabled":""} aria-label="Nach oben">↑</button><button data-move-ms="${item.id}" data-direction="1" ${index===ms.length-1?"disabled":""} aria-label="Nach unten">↓</button><button data-edit-entity="${item.id}" data-store="milestones">✎</button><button data-delete-entity="${item.id}" data-store="milestones">×</button></div>`).join("")||"<small>Keine Meilensteine</small>"}</div></section>`;
}

async function entityEditor(store,entity){
  const names={lifeAreas:"Lebensbereich",goals:"Ziel",milestones:"Meilenstein"};
  modal({title:`${entity.id?"Bearbeiten":"Neu"}: ${names[store]}`,content:`<form class="form-grid">${field({label:"Titel",name:"title",value:entity.title,required:true})}
    ${store==="lifeAreas"?`${field({label:"Beschreibung",name:"description",type:"textarea",value:entity.description})}${field({label:"Farbe",name:"color",type:"color",value:entity.color||"#4d7c68"})}`:""}
    ${store==="goals"?`${field({label:"Beschreibung",name:"description",type:"textarea",value:entity.description})}<div class="three-col">${field({label:"Status",name:"status",type:"select",value:entity.status||"planned",options:Object.entries(goalStatuses)})}${field({label:"Priorität",name:"priority",type:"select",value:entity.priority||"medium",options:Object.entries(priorities)})}${field({label:"Symbol",name:"symbol",value:entity.symbol||"◇"})}</div><div class="three-col">${field({label:"Startdatum",name:"startDate",type:"date",value:entity.startDate})}${field({label:"Zieldatum",name:"targetDate",type:"date",value:entity.targetDate})}${field({label:"Farbe",name:"color",type:"color",value:entity.color||"#4d7c68"})}</div><div class="two-col">${field({label:"Fortschritt",name:"progressMode",type:"select",value:entity.progressMode||"automatic",options:[["automatic","Automatisch"],["manual","Manuell"]]})}${field({label:"Manuell in %",name:"progress",type:"number",min:0,max:100,value:entity.progress||0})}</div>`:""}
    ${store==="milestones"?`${field({label:"Beschreibung",name:"description",type:"textarea",value:entity.description})}<div class="three-col">${field({label:"Status",name:"status",type:"select",value:entity.status||"open",options:Object.entries(milestoneStatuses)})}${field({label:"Reihenfolge",name:"order",type:"number",min:0,value:entity.order||0})}${field({label:"Zieldatum",name:"targetDate",type:"date",value:entity.targetDate})}</div>`:""}
    <button class="button primary">Speichern</button></form>`,onOpen:sheet=>sheet.querySelector("form").onsubmit=async e=>{e.preventDefault();await saveEntity(store,{...entity,...formValues(e.target)});closeModal();toast(`${names[store]} gespeichert`);window.dispatchEvent(new HashChangeEvent("hashchange"));}});
}
async function moveMilestone(id,direction,milestones,root){
  const current=milestones.find(m=>m.id===id),siblings=milestones.filter(m=>m.goalId===current.goalId).sort((a,b)=>(a.order??999)-(b.order??999)),index=siblings.findIndex(m=>m.id===id),other=siblings[index+direction];if(!other)return;
  await saveEntity("milestones",{...current,order:index+direction},"reorder");await saveEntity("milestones",{...other,order:index},"reorder");renderPath(root);
}
async function deleteEntity(store,id,data,root){
  if(store==="lifeAreas"){
    const dependent=data.goals.filter(goal=>goal.lifeAreaId===id);
    if(dependent.length){toast(`Lebensbereich enthält ${dependent.length} Ziel(e). Lösche oder verschiebe sie zuerst.`,"error");return;}
    if(!await confirmDialog("Lebensbereich löschen?","Löschen"))return;
  }else if(store==="goals"){
    const dependent=data.milestones.filter(m=>m.goalId===id);
    if(!await confirmDialog(`Dieses Ziel mit ${dependent.length} abhängigen Meilenstein(en) löschen? Verknüpfte Aufgaben bleiben erhalten, ihre Zielverknüpfung wird entfernt.`,"Ziel und Meilensteine löschen"))return;
    await Promise.all(dependent.map(m=>removeEntity("milestones",m.id)));
    for(const task of data.tasks.filter(t=>t.goalId===id||dependent.some(m=>m.id===t.milestoneId)))await saveEntity("tasks",{...task,goalId:"",milestoneId:""},"unlink");
  }else if(store==="milestones"){
    const linked=data.tasks.filter(task=>task.milestoneId===id);
    if(!await confirmDialog(`Meilenstein löschen? Bei ${linked.length} Aufgabe(n) wird nur die Meilensteinverknüpfung entfernt.`,"Löschen"))return;
    for(const task of linked)await saveEntity("tasks",{...task,milestoneId:""},"unlink");
  }else if(!await confirmDialog("Eintrag löschen?","Löschen"))return;
  await removeEntity(store,id);renderPath(root);
}
