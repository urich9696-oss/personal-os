import { exportDatabase, importDatabase, resetDatabase } from "../db.js";
import { state } from "../state.js";
import { escapeHTML, download } from "../utils/format.js";
import { pageHeader, field, formValues, toast, confirmDialog } from "../components/ui.js";

export async function renderSettings(root) {
  const s=state.settings,p=s.profile,d=s.dashboard;
  root.innerHTML=`${pageHeader("Einstellungen","Personalisiere PersonalOS und verwalte deine lokalen Daten.")}
    <form class="settings-grid" data-settings>
      <section class="card"><h2>Profil & Formate</h2>${field({label:"Name",name:"name",value:p.name})}<div class="two-col">${field({label:"Währung",name:"currency",type:"select",value:p.currency,options:["EUR","USD","CHF","GBP"].map(x=>[x,x])})}${field({label:"Wochenstart",name:"weekStart",type:"select",value:p.weekStart,options:[["monday","Montag"],["sunday","Sonntag"]]})}</div><div class="two-col">${field({label:"Zeitformat",name:"timeFormat",type:"select",value:p.timeFormat,options:[["24","24 Stunden"],["12","12 Stunden"]]})}${field({label:"Kalender-Standard",name:"calendarView",type:"select",value:p.calendarView,options:[["month","Monat"],["week","Woche"],["day","Tag"]]})}</div></section>
      <section class="card"><h2>Darstellung</h2>${field({label:"Theme",name:"theme",type:"select",value:s.theme,options:[["system","System"],["light","Hell"],["dark","Dunkel"]]})}<h3>Dashboard-Bereiche</h3><div class="toggle-grid">${Object.entries({priorities:"Prioritäten",timeline:"Timeline",tasks:"Aufgaben",dayPlan:"Tagesplan",maintenance:"Maintenance",path:"Path-Fokus",finance:"Finance"}).map(([key,label])=>field({label,name:`dash-${key}`,type:"checkbox",value:d[key]})).join("")}</div></section>
      <button class="button primary" type="submit">Einstellungen speichern</button>
    </form>
    <section class="card settings-section"><h2>Daten</h2><p>Export enthält sämtliche PersonalOS-Daten als versioniertes JSON.</p><div class="button-row"><button data-export>JSON exportieren</button><label class="button ghost">JSON importieren<input hidden type="file" accept="application/json" data-import></label><select data-mode><option value="merge">Zusammenführen</option><option value="replace">Ersetzen</option></select><button class="danger" data-reset>Alles zurücksetzen</button></div></section>
    <section class="card settings-section"><h2>Benachrichtigungen</h2><p>Optional und nur nach expliziter Browserfreigabe. Ohne Server sind geplante Hintergrundhinweise nicht garantiert.</p><button data-notify>Benachrichtigungen erlauben</button></section>
    <section class="card about"><img src="./assets/icons/icon.svg" alt="" width="48"><div><b>PersonalOS</b><small>Lokale Offline-PWA · Schema 1</small></div></section>`;
  root.querySelector("[data-settings]").onsubmit=async e=>{e.preventDefault();const v=formValues(e.target), dashboard={};Object.keys(d).forEach(k=>dashboard[k]=Boolean(v[`dash-${k}`]));await state.save({theme:v.theme,profile:{name:v.name,currency:v.currency,weekStart:v.weekStart,timeFormat:v.timeFormat,calendarView:v.calendarView},dashboard});toast("Einstellungen gespeichert");};
  root.querySelector("[data-export]").onclick=async()=>download(`personalos-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(await exportDatabase(),null,2));
  root.querySelector("[data-import]").onchange=async e=>{try{const value=JSON.parse(await e.target.files[0].text());await importDatabase(value,root.querySelector("[data-mode]").value);await state.load();toast("Import abgeschlossen");window.dispatchEvent(new HashChangeEvent("hashchange"));}catch(error){toast(error.message,"error");}};
  root.querySelector("[data-reset]").onclick=async()=>{if(await confirmDialog("Alle lokalen Daten unwiderruflich löschen?","Alles löschen")){await resetDatabase();location.reload();}};
  root.querySelector("[data-notify]").onclick=async()=>{if(!("Notification"in window))return toast("Dieser Browser unterstützt keine Benachrichtigungen","error");const result=await Notification.requestPermission();toast(result==="granted"?"Benachrichtigungen erlaubt":"Freigabe nicht erteilt");};
}
