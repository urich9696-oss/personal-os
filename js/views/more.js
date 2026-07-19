import { pageHeader, icon } from "../components/ui.js";

export function renderMore(root) {
  const items = [
    ["tasks","Aufgaben","Globale Aufgabenliste"],
    ["journal","Journal","Reflexion und Monatsstatistik"],
    ["finance","Finance","Budget und Transaktionen"],
    ["maintenance","Maintenance","Routinen und Verlauf"],
    ["settings","Einstellungen","Profil, Design und Daten"]
  ];
  root.innerHTML = `${pageHeader("Mehr","Werkzeuge und Einstellungen.")}
    <section class="more-grid">${items.map(([route,title,text])=>`<a class="card" href="#/${route}"><span>${icon(route)}</span><div><h2>${title}</h2><p>${text}</p></div><b>›</b></a>`).join("")}</section>`;
}
