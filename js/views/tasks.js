import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey } from "../utils/date.js";
import { escapeHTML, tags } from "../utils/format.js";
import { modal, field, formValues, closeModal, toast, empty, pageHeader } from "../components/ui.js";

const priorities={critical:"Kritisch",high:"Hoch",medium:"Mittel",low:"Niedrig"};
const statuses={open:"Offen",inProgress:"In Arbeit",done:"Erledigt",archived:"Archiviert"};
const priorityRank={critical:0,high:1,medium:2,low:3};
let filters={query:"",status:"active",priority:"all",goal:"all",milestone:"all",sort:"due"};

export async function renderTasks(root){
  const [tasks,goals,milestones]=await Promise.all(["tasks","goals","milestones"].map(db.all));
  const normalized=tasks.map(normalizeTask);
  const visible=normalized.filter(task=>
    (!filters.query||JSON.stringify(task).toLowerCase().includes(filters.query.toLowerCase()))&&
    (filters.status==="all"||(filters.status==="active"?["open","inProgress"].includes(task.status):task.status===filters.status))&&
    (filters.priority==="all"||task.priority===filters.priority)&&
    (filters.goal==="all"||task.goalId===filters.goal)&&
    (filters.milestone==="all"||task.milestoneId===filters.milestone)
  ).sort(sorter);
  const filteredMilestones=filters.goal==="all"?milestones:milestones.filter(m=>m.goalId===filters.goal);
  root.innerHTML=`${pageHeader("Aufgaben","Planen, priorisieren und zuverlässig abschließen.",'<button class="button primary" data-add>＋ Aufgabe</button>')}
    <section class="task-filters">
      <input type="search" data-query value="${escapeHTML(filters.query)}" placeholder="Aufgaben suchen…">
      <select data-filter="status">${optionList([["active","Aktiv"],["all","Alle"],...Object.entries(statuses)],filters.status)}</select>
      <select data-filter="priority">${optionList([["all","Alle Prioritäten"],...Object.entries(priorities)],filters.priority)}</select>
      <select data-filter="goal">${optionList([["all","Alle Ziele"],...goals.map(g=>[g.id,g.title])],filters.goal)}</select>
      <select data-filter="milestone">${optionList([["all","Alle Meilensteine"],...filteredMilestones.map(m=>[m.id,m.title])],filters.milestone)}</select>
      <select data-filter="sort">${optionList([["due","Fälligkeit"],["priority","Priorität"],["created","Erstellt"],["title","Titel"]],filters.sort)}</select>
    </section>
    <section class="list">${visible.length?visible.map(task=>taskRow(task,goals,milestones)).join(""):empty("Keine Aufgaben","Passe die Filter an oder lege eine Aufgabe an.",'<button class="button primary" data-empty-add>Aufgabe anlegen</button>')}</section>`;
  root.querySelector("[data-add]").onclick=()=>taskEditor({},goals,milestones);
  root.querySelector("[data-empty-add]")?.addEventListener("click",()=>taskEditor({},goals,milestones));
  root.querySelector("[data-query]").oninput=e=>{filters.query=e.target.value;renderTasks(root);};
  root.querySelectorAll("[data-filter]").forEach(select=>select.onchange=e=>{filters[select.dataset.filter]=e.target.value;if(select.dataset.filter==="goal")filters.milestone="all";renderTasks(root);});
  root.querySelectorAll("[data-toggle]").forEach(button=>button.onclick=async()=>{const task=normalized.find(item=>item.id===button.dataset.toggle),done=task.status!=="done";await saveEntity("tasks",{...task,status:done?"done":"open",completedAt:done?new Date().toISOString():null},"toggle");renderTasks(root);});
  root.querySelectorAll("[data-edit]").forEach(button=>button.onclick=()=>taskEditor(normalized.find(item=>item.id===button.dataset.edit),goals,milestones));
  root.querySelectorAll("[data-duplicate]").forEach(button=>button.onclick=async()=>{const{id,createdAt,updatedAt,...copy}=normalized.find(item=>item.id===button.dataset.duplicate);await saveEntity("tasks",{...copy,title:`${copy.title} (Kopie)`,status:"open",completedAt:null},"duplicate");toast("Aufgabe dupliziert");renderTasks(root);});
  root.querySelectorAll("[data-move]").forEach(button=>button.onclick=()=>moveEditor(normalized.find(item=>item.id===button.dataset.move),root));
  root.querySelectorAll("[data-delete]").forEach(button=>button.onclick=async()=>{
    const task=normalized.find(item=>item.id===button.dataset.delete);await removeEntity("tasks",task.id);renderTasks(root);
    toast("Aufgabe gelöscht","",{label:"Rückgängig",run:async()=>{await saveEntity("tasks",task,"undo");renderTasks(root);}});
  });
}

function normalizeTask(task){
  const map={todo:"open",doing:"inProgress"};return{...task,status:map[task.status]||task.status||"open",priority:task.priority||"medium",dueDate:task.dueDate||task.due?.slice(0,10)||"",startTime:task.startTime||task.due?.slice(11,16)||""};
}
function sorter(a,b){
  if(filters.sort==="priority")return priorityRank[a.priority]-priorityRank[b.priority]||(a.dueDate||"9999").localeCompare(b.dueDate||"9999");
  if(filters.sort==="created")return(b.createdAt||"").localeCompare(a.createdAt||"");
  if(filters.sort==="title")return a.title.localeCompare(b.title,"de");
  return(a.dueDate||"9999").localeCompare(b.dueDate||"9999")||(a.startTime||"99").localeCompare(b.startTime||"99")||priorityRank[a.priority]-priorityRank[b.priority];
}
const optionList=(items,value)=>items.map(([key,label])=>`<option value="${escapeHTML(key)}" ${String(key)===String(value)?"selected":""}>${escapeHTML(label)}</option>`).join("");
function taskRow(task,goals,milestones){
  const target=milestones.find(m=>m.id===task.milestoneId)?.title||goals.find(g=>g.id===task.goalId)?.title;
  return `<article class="list-item task ${task.status==="done"?"done":""}">
    <button class="check" data-toggle="${task.id}" aria-label="${task.status==="done"?"Wieder öffnen":"Erledigen"}">${task.status==="done"?"✓":""}</button>
    <div class="item-main"><h3>${escapeHTML(task.title)}</h3><div class="meta"><span class="priority ${task.priority}">${priorities[task.priority]}</span><span>${statuses[task.status]}</span>${task.dueDate?`<span>◷ ${task.dueDate}${task.startTime?` ${task.startTime}`:""}</span>`:""}${task.estimatedDuration?`<span>${task.estimatedDuration} min</span>`:""}${target?`<span>◇ ${escapeHTML(target)}</span>`:""}${task.completedAt?`<span>✓ ${new Date(task.completedAt).toLocaleDateString("de-DE")}</span>`:""}</div>${task.description?`<p>${escapeHTML(task.description)}</p>`:""}<div class="tags">${(task.tags||[]).map(tag=>`<span>#${escapeHTML(tag)}</span>`).join("")}</div></div>
    <div class="item-actions"><button data-edit="${task.id}" aria-label="Bearbeiten">✎</button><button data-move="${task.id}" aria-label="Verschieben">→</button><button data-duplicate="${task.id}" aria-label="Duplizieren">⧉</button><button data-delete="${task.id}" aria-label="Löschen">×</button></div></article>`;
}

export function taskEditor(task={},goals=[],milestones=[]){
  task=normalizeTask(task||{});
  modal({title:task.id?"Aufgabe bearbeiten":"Neue Aufgabe",content:`<form id="task-form" class="form-grid">
    ${field({label:"Titel",name:"title",value:task.title,required:true})}${field({label:"Beschreibung",name:"description",type:"textarea",value:task.description})}
    <div class="two-col">${field({label:"Priorität",name:"priority",type:"select",value:task.priority,options:Object.entries(priorities)})}${field({label:"Status",name:"status",type:"select",value:task.status,options:Object.entries(statuses)})}</div>
    <div class="three-col">${field({label:"Fällig am",name:"dueDate",type:"date",value:task.dueDate||dateKey()})}${field({label:"Start",name:"startTime",type:"time",value:task.startTime})}${field({label:"Ende",name:"endTime",type:"time",value:task.endTime})}</div>
    ${field({label:"Geschätzte Dauer (Min.)",name:"estimatedDuration",type:"number",value:task.estimatedDuration||"",min:1})}
    ${field({label:"Ziel",name:"goalId",type:"select",value:task.goalId||"",options:[["","Kein Ziel"],...goals.map(g=>[g.id,g.title])]})}
    <label class="field"><span>Meilenstein</span><select name="milestoneId"></select></label>
    ${field({label:"Tags (Komma getrennt)",name:"tags",value:task.tags?.join(", ")})}${field({label:"Notizen",name:"notes",type:"textarea",value:task.notes})}
    <button class="button primary">Speichern</button></form>`,onOpen:sheet=>{
      const form=sheet.querySelector("form"),goal=form.elements.goalId,milestone=form.elements.milestoneId;
      const update=()=>{const rows=goal.value?milestones.filter(m=>m.goalId===goal.value):milestones;milestone.innerHTML=optionList([["","Kein Meilenstein"],...rows.map(m=>[m.id,m.title])],task.milestoneId||"");};
      goal.onchange=()=>{task.milestoneId="";update();};update();
      form.onsubmit=async e=>{e.preventDefault();const values=formValues(form);values.tags=tags(values.tags);if(values.endTime&&values.startTime&&values.endTime<values.startTime)return toast("Endzeit muss nach der Startzeit liegen","error");if(values.status==="done"&&!task.completedAt)values.completedAt=new Date().toISOString();if(values.status!=="done")values.completedAt=null;await saveEntity("tasks",{...task,...values});closeModal();toast("Aufgabe gespeichert");window.dispatchEvent(new HashChangeEvent("hashchange"));};
    }});
}
function moveEditor(task,root){modal({title:"Aufgabe verschieben",content:`<form class="form-grid">${field({label:"Neues Fälligkeitsdatum",name:"dueDate",type:"date",value:task.dueDate||dateKey(),required:true})}<div class="two-col">${field({label:"Start",name:"startTime",type:"time",value:task.startTime})}${field({label:"Ende",name:"endTime",type:"time",value:task.endTime})}</div><button class="button primary">Verschieben</button></form>`,onOpen:sheet=>sheet.querySelector("form").onsubmit=async e=>{e.preventDefault();await saveEntity("tasks",{...task,...formValues(e.target)},"move");closeModal();toast("Aufgabe verschoben");renderTasks(root);}});}
