import { db } from "../db.js";
import { saveEntity, removeEntity } from "../services/data.js";
import { dateKey, monthKey } from "../utils/date.js";
import { escapeHTML, money, download } from "../utils/format.js";
import { state } from "../state.js";
import { pageHeader, modal, field, formValues, closeModal, toast, confirmDialog, empty } from "../components/ui.js";

let month = monthKey(), type = "all";

export async function renderFinance(root) {
  const [all, categories, budgets] = await Promise.all(["transactions","financeCategories","monthlyBudgets"].map(s => db.all(s)));
  const rows = all.filter(t => t.date?.startsWith(month) && (type === "all" || t.type === type)).sort((a,b)=>b.date.localeCompare(a.date));
  const monthRows = all.filter(t => t.date?.startsWith(month));
  const income = total(monthRows.filter(t=>t.type==="income")), expense = total(monthRows.filter(t=>t.type==="expense"));
  const budget = budgets.find(b=>b.month===month), categorySpend = groupSpend(monthRows, categories);
  const max = Math.max(1,...Object.values(categorySpend));
  root.innerHTML = `${pageHeader("Finance", "Private Übersicht – alle Daten bleiben auf diesem Gerät.", '<button class="button primary" data-add>＋ Buchung</button>')}
    <section class="finance-summary"><article><span>Einnahmen</span><b class="positive">${money(income,currency())}</b></article><article><span>Ausgaben</span><b class="negative">${money(expense,currency())}</b></article><article><span>Saldo</span><b>${money(income-expense,currency())}</b></article><article><span>Budget übrig</span><b>${budget ? money(Number(budget.amount)-expense,currency()) : "–"}</b></article></section>
    <section class="card chart"><h2>Ausgaben nach Kategorie</h2>${Object.keys(categorySpend).length ? Object.entries(categorySpend).map(([name,value])=>`<div><span>${escapeHTML(name)}</span><i><b style="width:${value/max*100}%"></b></i><strong>${money(value,currency())}</strong></div>`).join("") : "<p class='muted'>Keine Ausgaben in diesem Monat.</p>"}</section>
    <section class="toolbar"><input type="month" data-month value="${month}"><select data-type><option value="all">Alle</option><option value="expense">Ausgaben</option><option value="income">Einnahmen</option></select><button data-budget>Monatsbudget</button><button data-category>Kategorien</button><button data-export>CSV Export</button></section>
    <section class="card transaction-list">${rows.length ? rows.map(row=>`<article><span class="transaction-icon ${row.type}">${row.type==="income"?"＋":"−"}</span><div><b>${escapeHTML(row.description)}</b><small>${escapeHTML(row.date)} · ${escapeHTML(categories.find(c=>c.id===row.categoryId)?.name || "Ohne Kategorie")}</small></div><strong>${row.type==="income"?"+":"−"}${money(row.amount,currency())}</strong><button data-edit="${row.id}">✎</button><button data-delete="${row.id}">×</button></article>`).join("") : empty("Keine Buchungen","Erfasse deine erste Einnahme oder Ausgabe.",'<button class="button primary" data-empty-add>Buchung erfassen</button>')}</section>`;
  root.querySelector("[data-type]").value=type;
  root.querySelector("[data-month]").onchange=e=>{month=e.target.value;renderFinance(root);};
  root.querySelector("[data-type]").onchange=e=>{type=e.target.value;renderFinance(root);};
  root.querySelector("[data-add]").onclick=()=>transactionEditor({},categories);
  root.querySelector("[data-empty-add]")?.addEventListener("click",()=>transactionEditor({},categories));
  root.querySelector("[data-budget]").onclick=()=>budgetEditor(budget);
  root.querySelector("[data-category]").onclick=()=>categoryManager(categories);
  root.querySelector("[data-export]").onclick=()=>download(`personalos-finance-${month}.csv`,["Datum,Typ,Beschreibung,Betrag,Kategorie",...rows.map(r=>[r.date,r.type,JSON.stringify(r.description),r.amount,JSON.stringify(categories.find(c=>c.id===r.categoryId)?.name||"")].join(","))].join("\n"),"text/csv");
  root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>transactionEditor(rows.find(r=>r.id===b.dataset.edit),categories));
  root.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(await confirmDialog("Buchung löschen?")){await removeEntity("transactions",b.dataset.delete);renderFinance(root);}});
}
const currency=()=>state.settings.profile.currency||"CHF";
const total=rows=>rows.reduce((sum,row)=>sum+Number(row.amount||0),0);
function groupSpend(rows,categories){return rows.filter(r=>r.type==="expense").reduce((out,r)=>{const n=categories.find(c=>c.id===r.categoryId)?.name||"Sonstiges";out[n]=(out[n]||0)+Number(r.amount);return out;},{});}

export function transactionEditor(entry={},categories=[], preset) {
  modal({title:entry.id?"Buchung bearbeiten":"Neue Buchung",content:`<form class="form-grid">${field({label:"Typ",name:"type",type:"select",value:entry.type||preset||"expense",options:[["expense","Ausgabe"],["income","Einnahme"]]})}${field({label:"Beschreibung",name:"description",value:entry.description,required:true})}<div class="two-col">${field({label:`Betrag (${currency()})`,name:"amount",type:"number",value:entry.amount,min:0,step:"0.01",required:true})}${field({label:"Datum",name:"date",type:"date",value:entry.date||dateKey(),required:true})}</div>${field({label:"Kategorie",name:"categoryId",type:"select",value:entry.categoryId||"",options:[["","Ohne Kategorie"],...categories.map(c=>[c.id,c.name])]})}${field({label:"Notiz",name:"notes",type:"textarea",value:entry.notes})}<button class="button primary">Speichern</button></form>`,onOpen:sheet=>sheet.querySelector("form").onsubmit=async e=>{e.preventDefault();await saveEntity("transactions",{...entry,...formValues(e.target)});closeModal();toast("Buchung gespeichert");window.dispatchEvent(new HashChangeEvent("hashchange"));}});
}
function budgetEditor(entry={}){modal({title:"Monatsbudget",content:`<form class="form-grid">${field({label:"Monat",name:"month",type:"month",value:entry.month||month,required:true})}${field({label:`Budget (${currency()})`,name:"amount",type:"number",value:entry.amount,min:0,step:"0.01",required:true})}<button class="button primary">Speichern</button></form>`,onOpen:s=>s.querySelector("form").onsubmit=async e=>{e.preventDefault();await saveEntity("monthlyBudgets",{...entry,...formValues(e.target)});closeModal();renderFinance(document.querySelector("#main"));}});}
function categoryManager(categories){
  modal({title:"Finanzkategorien",content:`<form class="inline-form"><input name="name" required placeholder="Neue Kategorie"><input name="color" type="color" value="#4d7c68"><button class="button primary">＋</button></form><div class="manage-list">${categories.map(c=>`<div><i style="background:${c.color}"></i><span>${escapeHTML(c.name)}</span><button data-remove="${c.id}">×</button></div>`).join("")}</div>`,onOpen:s=>{s.querySelector("form").onsubmit=async e=>{e.preventDefault();await saveEntity("financeCategories",formValues(e.target));categoryManager(await db.all("financeCategories"));};s.querySelectorAll("[data-remove]").forEach(b=>b.onclick=async()=>{await removeEntity("financeCategories",b.dataset.remove);categoryManager(await db.all("financeCategories"));});}});
}
