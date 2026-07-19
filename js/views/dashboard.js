import { db } from "../db.js";
import { saveEntity } from "../services/data.js";
import { dateKey, monthKey, eventOccurrences, maintenanceDue } from "../utils/date.js";
import { escapeHTML, money, formatTime } from "../utils/format.js";
import { state } from "../state.js";
import { pageHeader, progress, empty } from "../components/ui.js";
import { dayBlockEditor } from "./blocks.js";

const priorityRank={critical:0,high:1,medium:2,low:3};
export async function renderDashboard(root){
  const stores=["tasks","calendarEvents","dayPlans","maintenanceTemplates","maintenanceDays","goals","milestones","transactions","monthlyBudgets"];
  const [tasks,events,plans,maintenance,maintenanceDays,goals,milestones,transactions,budgets]=await Promise.all(stores.map(db.all));
  const today=dateKey(),now=new Date(),end=new Date(`${today}T23:59`),todayTasks=tasks.filter(t=>(t.dueDate||t.due?.slice(0,10))===today&&!["archived"].includes(t.status));
  const timeline=events.flatMap(e=>eventOccurrences(e,new Date(`${today}T00:00`),end)).sort((a,b)=>a.occurrenceStart-b.occurrenceStart);
  const plan=plans.find(p=>p.date===today),planItems=plan?.items||[],due=maintenance.filter(t=>maintenanceDue(t,now)),day=maintenanceDays.find(d=>d.date===today)||{checks:{}};
  const taskDone=t=>t.status==="done",maintenanceDone=t=>{const r=day.checks?.[t.id];return r===true||r?.status==="done"||(t.checklist?.length&&t.checklist.every((_,i)=>r?.items?.[i]===true||r?.items?.[i]?.status==="done"));};
  const total=todayTasks.length+due.length+planItems.length,done=todayTasks.filter(taskDone).length+due.filter(maintenanceDone).length+planItems.filter(i=>i.done).length,dayProgress=total?done/total*100:0;
  const monthRows=transactions.filter(t=>t.date?.startsWith(monthKey())),expense=sum(monthRows.filter(t=>t.type==="expense")),income=sum(monthRows.filter(t=>t.type==="income")),budget=budgets.find(b=>b.month===monthKey()),budgetUse=budget?.amount?expense/Number(budget.amount)*100:0;
  const activeGoal=goals.filter(g=>g.status==="active").sort((a,b)=>priorityRank[a.priority||"medium"]-priorityRank[b.priority||"medium"]||(a.targetDate||"9999").localeCompare(b.targetDate||"9999"))[0];
  const goalMilestones=milestones.filter(m=>m.goalId===activeGoal?.id).sort((a,b)=>(a.order??999)-(b.order??999)),nextMilestone=goalMilestones.find(m=>m.status!=="done");
  const goalTasks=tasks.filter(t=>t.goalId===activeGoal?.id||goalMilestones.some(m=>m.id===t.milestoneId)),nextTask=goalTasks.filter(t=>!["done","archived"].includes(t.status)).sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"))[0];
  const goalProgress=goalTasks.length?goalTasks.filter(taskDone).length/goalTasks.length*100:goalMilestones.length?goalMilestones.filter(m=>m.status==="done").length/goalMilestones.length*100:Number(activeGoal?.progress||0);
  const d=state.settings.dashboard;
  root.innerHTML=`${pageHeader(`Hallo${state.settings.profile.name?`, ${state.settings.profile.name}`:""}`,new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long"}).format(now),'<a class="button primary" href="#/tasks">Aufgaben öffnen</a>')}
    ${d.progress?`<section class="dashboard-progress card"><div><span>Tagesfortschritt</span><b>${Math.round(dayProgress)}%</b></div>${progress(dayProgress)}<small>${done} von ${total} Punkten · Aufgaben, Maintenance und Planblöcke</small></section>`:""}
    <div class="dashboard-grid">
      ${d.priorities?widget("Prioritäten",todayTasks.filter(t=>!taskDone(t)).sort((a,b)=>priorityRank[a.priority||"medium"]-priorityRank[b.priority||"medium"]).slice(0,5).map(taskItem).join("")||empty("Alles frei","Keine offenen Aufgaben für heute.")):""}
      ${d.timeline?widget("Timeline",timeline.map(e=>`<a href="#/calendar"><time>${e.allDay?"Tag":formatTime(e.occurrenceStart,state.settings.profile.timeFormat==="12")}</time><b>${escapeHTML(e.title)}</b></a>`).join("")||empty("Freier Kalender","Heute stehen keine Termine an.")):""}
      ${d.tasks?widget("Aufgaben",todayTasks.slice(0,7).map(task=>`<label class="${taskDone(task)?"done":""}"><input type="checkbox" data-task="${task.id}" ${taskDone(task)?"checked":""}><span>${escapeHTML(task.title)}</span></label>`).join("")||empty("Keine Tagesaufgaben","Datierte Aufgaben erscheinen hier.")):""}
      ${d.dayPlan?widget("Tagesplan",`${planItems.map((item,index)=>`<label class="${item.done?"done":""}"><input type="checkbox" data-block="${index}" ${item.done?"checked":""}><time>${escapeHTML(item.start||"–")}</time><span>${escapeHTML(item.title)}</span></label>`).join("")||empty("Kein Tagesplan","Füge direkt einen Block hinzu.")}<button class="text-link" data-add-block>＋ Block für heute</button>`):""}
      ${d.maintenance?widget("Maintenance",`<div class="metric"><b>${due.filter(maintenanceDone).length}/${due.length}</b><span>heute erledigt</span></div><a class="text-link" href="#/maintenance">Checkliste öffnen →</a>`):""}
      ${d.path?widget("Path-Fokus",activeGoal?`<div class="path-focus"><b>${escapeHTML(activeGoal.symbol||"◇")} ${escapeHTML(activeGoal.title)}</b>${progress(goalProgress)}<small>${Math.round(goalProgress)}% · ${nextMilestone?`Nächster Meilenstein: ${escapeHTML(nextMilestone.title)}`:"Kein offener Meilenstein"}</small>${nextTask?`<a href="#/tasks">Nächste Aktion: ${escapeHTML(nextTask.title)} →</a>`:""}</div>`:empty("Kein aktives Ziel","Aktiviere unter Path dein priorisiertes Ziel.",'<a class="button ghost" href="#/path">Path einrichten</a>')):""}
      ${d.finance?widget("Finance",`<div class="finance-mini"><span><small>Einnahmen</small><b>${money(income,state.settings.profile.currency)}</b></span><span><small>Ausgaben</small><b>${money(expense,state.settings.profile.currency)}</b></span></div>${budget?`<div class="budget-use"><span>${Math.round(budgetUse)}% des Budgets</span>${progress(budgetUse)}<small>${money(Number(budget.amount)-expense,state.settings.profile.currency)} verbleibend</small></div>`:`<p class="muted">Noch kein Monatsbudget eingerichtet.</p><a class="button ghost" href="#/finance">Budget einrichten</a>`}<a class="text-link" href="#/finance">Details →</a>`):""}
    </div>
    <section class="quick-actions card"><h2>Schnellaktionen</h2><div><button data-capture="task">✓ Aufgabe</button><button data-capture="event">▦ Termin</button><button data-capture="journal">✎ Journal</button><button data-capture="expense">− Ausgabe</button><button data-capture="income">＋ Einnahme</button><button data-quick-block>◫ Block</button></div></section>`;
  root.querySelectorAll("[data-capture]").forEach(b=>b.onclick=()=>window.dispatchEvent(new CustomEvent("personalos:capture",{detail:b.dataset.capture})));
  root.querySelector("[data-quick-block]")?.addEventListener("click",()=>dayBlockEditor(plan||{date:today,items:[]},{},tasks));
  root.querySelector("[data-add-block]")?.addEventListener("click",()=>dayBlockEditor(plan||{date:today,items:[]},{},tasks));
  root.querySelectorAll("[data-task]").forEach(input=>input.onchange=async()=>{const task=tasks.find(t=>t.id===input.dataset.task);await saveEntity("tasks",{...task,status:input.checked?"done":"open",completedAt:input.checked?new Date().toISOString():null},"dashboard-toggle");renderDashboard(root);});
  root.querySelectorAll("[data-block]").forEach(input=>input.onchange=async()=>{const items=structuredClone(planItems);items[Number(input.dataset.block)].done=input.checked;await saveEntity("dayPlans",{...plan,items},"dashboard-toggle");renderDashboard(root);});
}
const sum=rows=>rows.reduce((total,row)=>total+Number(row.amount||0),0);
const taskItem=task=>`<a href="#/tasks"><span class="dot ${task.priority||"medium"}"></span><b>${escapeHTML(task.title)}</b><small>${task.startTime||task.due?.slice(11,16)||""}</small></a>`;
const widget=(title,content)=>`<section class="dashboard-widget card"><header><h2>${title}</h2></header><div>${content}</div></section>`;
