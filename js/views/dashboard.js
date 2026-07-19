import { db } from "../db.js";
import { dateKey, monthKey, eventOccurrences, parseLocal, maintenanceDue } from "../utils/date.js";
import { escapeHTML, money, formatTime } from "../utils/format.js";
import { state } from "../state.js";
import { pageHeader, progress, empty } from "../components/ui.js";

export async function renderDashboard(root) {
  const names=["tasks","calendarEvents","dayPlans","maintenanceTemplates","maintenanceDays","goals","milestones","transactions","monthlyBudgets"];
  const [tasks,events,plans,maintenance,maintenanceDays,goals,milestones,transactions,budgets]=await Promise.all(names.map(n=>db.all(n)));
  const today=dateKey(), now=new Date(), end=new Date(`${today}T23:59`);
  const todayTasks=tasks.filter(t=>t.due?.startsWith(today)), done=todayTasks.filter(t=>t.status==="done").length;
  const timeline=events.flatMap(e=>eventOccurrences(e,new Date(`${today}T00:00`),end)).sort((a,b)=>a.occurrenceStart-b.occurrenceStart);
  const plan=plans.find(p=>p.date===today), due=maintenance.filter(t=>maintenanceDue(t,now)), checks=maintenanceDays.find(d=>d.date===today)?.checks||{};
  const monthTransactions=transactions.filter(t=>t.date?.startsWith(monthKey())), expense=monthTransactions.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0), income=monthTransactions.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0), budget=budgets.find(b=>b.month===monthKey());
  const d=state.settings.dashboard;
  root.innerHTML=`${pageHeader(`Hallo${state.settings.profile.name?`, ${state.settings.profile.name}`:""}`,new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long"}).format(now),'<a class="button primary" href="#/tasks">Aufgaben öffnen</a>')}
    <section class="dashboard-progress card"><div><span>Tagesfortschritt</span><b>${todayTasks.length?Math.round(done/todayTasks.length*100):0}%</b></div>${progress(todayTasks.length?done/todayTasks.length*100:0)}<small>${done} von ${todayTasks.length} datierten Aufgaben erledigt</small></section>
    <div class="dashboard-grid">
      ${d.priorities?widget("Prioritäten",todayTasks.filter(t=>t.status!=="done").sort((a,b)=>rank(a.priority)-rank(b.priority)).slice(0,4).map(t=>`<a href="#/tasks"><span class="dot ${t.priority}"></span><b>${escapeHTML(t.title)}</b><small>${t.due?.slice(11)||""}</small></a>`).join("")||empty("Alles frei","Keine offenen Aufgaben für heute.")):""}
      ${d.timeline?widget("Timeline",timeline.map(e=>`<a href="#/calendar"><time>${e.allDay?"Tag":formatTime(e.occurrenceStart,state.settings.profile.timeFormat==="12")}</time><b>${escapeHTML(e.title)}</b></a>`).join("")||empty("Freier Kalender","Heute stehen keine Termine an.")):""}
      ${d.dayPlan?widget("Tagesplan",(plan?.items||[]).map(i=>`<a href="#/blocks"><time>${escapeHTML(i.start)}</time><b class="${i.done?"strike":""}">${escapeHTML(i.title)}</b><small>${i.duration} min</small></a>`).join("")||empty("Kein Tagesplan","Wende unter Blocks eine Vorlage an.")):""}
      ${d.maintenance?widget("Maintenance",`<div class="metric"><b>${due.filter(t=>checks[t.id]).length}/${due.length}</b><span>heute erledigt</span></div><a class="text-link" href="#/maintenance">Checkliste öffnen →</a>`):""}
      ${d.path?widget("Path-Fokus",goals.slice(0,3).map(g=>`<a href="#/path"><b>${escapeHTML(g.title)}</b><small>${milestones.filter(m=>m.goalId===g.id).length} Meilensteine</small></a>`).join("")||empty("Kein Fokus","Lege unter Path ein Ziel an.")):""}
      ${d.finance?widget("Finance",`<div class="finance-mini"><span><small>Einnahmen</small><b>${money(income,state.settings.profile.currency)}</b></span><span><small>Ausgaben</small><b>${money(expense,state.settings.profile.currency)}</b></span></div>${budget?`<small>${money(Math.max(0,Number(budget.amount)-expense),state.settings.profile.currency)} Budget übrig</small>`:""}<a class="text-link" href="#/finance">Details →</a>`):""}
    </div>
    <section class="quick-actions card"><h2>Schnellaktionen</h2><div><button data-capture="task">✓ Aufgabe</button><button data-capture="event">▦ Termin</button><button data-capture="journal">✎ Journal</button><button data-capture="expense">− Ausgabe</button><button data-capture="income">＋ Einnahme</button></div></section>`;
  root.querySelectorAll("[data-capture]").forEach(b=>b.onclick=()=>window.dispatchEvent(new CustomEvent("personalos:capture",{detail:b.dataset.capture})));
}
const rank=p=>({high:0,medium:1,low:2}[p]??3);
const widget=(title,content)=>`<section class="dashboard-widget card"><header><h2>${title}</h2></header><div>${content}</div></section>`;
