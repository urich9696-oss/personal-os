import { openDB } from "./db.js";
import { state } from "./state.js";
import { router } from "./router.js";
import { icon, toast } from "./components/ui.js";
import { openCapture, openSearch } from "./components/capture.js";
import { startOnboarding } from "./components/onboarding.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderTasks } from "./views/tasks.js";
import { renderCalendar } from "./views/calendar.js";
import { renderPath } from "./views/path.js";
import { renderBlocks } from "./views/blocks.js";
import { renderMore } from "./views/more.js";
import { renderJournal } from "./views/journal.js";
import { renderFinance } from "./views/finance.js";
import { renderMaintenance } from "./views/maintenance.js";
import { renderSettings } from "./views/settings.js";

const primary = [
  ["dashboard","Dashboard"],["calendar","Calendar"],["path","Path"],["blocks","Blocks"],["more","More"]
];
const secondary = [["tasks","Aufgaben"],["journal","Journal"],["finance","Finance"],["maintenance","Maintenance"],["settings","Einstellungen"]];
const navItem = ([route,label]) => `<a href="#/${route}" data-route="${route}"><span aria-hidden="true">${icon(route)}</span><small>${label}</small></a>`;
document.querySelector("#bottom-nav").innerHTML = primary.map(navItem).join("");
document.querySelector("#side-nav").innerHTML = `<div>${primary.map(navItem).join("")}</div><hr><div>${secondary.map(navItem).join("")}</div>`;

[
  ["dashboard",renderDashboard],["tasks",renderTasks],["calendar",renderCalendar],["path",renderPath],
  ["blocks",renderBlocks],["more",renderMore],["journal",renderJournal],["finance",renderFinance],
  ["maintenance",renderMaintenance],["settings",renderSettings]
].forEach(([name,renderer])=>router.register(name,renderer));

async function boot() {
  try {
    await openDB();
    await state.load();
  } catch (error) {
    console.error(error);
    toast("Lokaler Speicher ist nicht verfügbar. Prüfe den privaten Browsermodus.", "error");
  }
  document.querySelector("#capture-button").onclick=()=>openCapture();
  document.querySelector("#search-button").onclick=openSearch;
  window.addEventListener("personalos:capture",event=>openCapture(event.detail));
  window.addEventListener("hashchange",()=>router.render(document.querySelector("#main")));
  window.addEventListener("unhandledrejection",event=>{console.error(event.reason);toast("Aktion fehlgeschlagen. Bitte erneut versuchen.","error");});
  if(!location.hash) history.replaceState(null,"","#/dashboard");
  await router.render(document.querySelector("#main"));
  if(!state.settings.onboardingComplete) startOnboarding();
  if("serviceWorker"in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(error=>console.warn("Service Worker:",error));
  }
}
boot();
