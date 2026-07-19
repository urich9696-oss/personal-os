# PersonalOS

PersonalOS ist eine private, offlinefähige Progressive Web App für die tägliche Planung und langfristige Lebensgestaltung. Aufgaben, Kalender, Ziele, Tagesblöcke, Journal, Finanzen und wiederkehrende Maintenance greifen auf einem gemeinsamen Dashboard ineinander. Die App arbeitet ohne Konto und ohne Backend ausschließlich im Browser.

## Funktionen

- **Dashboard:** gemeinsamer Fortschritt aus Tagesaufgaben, fälliger Maintenance und Planblöcken; direktes Abhaken; Timeline, priorisierte Aufgaben, aktiver Path-Fokus, Budgetauslastung und Schnellaktionen.
- **Aufgaben:** vier Statuswerte, kritische bis niedrige Priorität, getrennte Datums-/Zeitfelder, Dauer, Beschreibung, Tags, Ziel- und Meilensteinbezug, Filter, Sortierung, Duplizieren, Verschieben und Löschen mit Undo.
- **Kalender:** Monats-, Wochen- und Tagesansicht für Termine, datierte Aufgaben, Tagesblöcke und fällige Maintenance. Termine unterstützen Kategorien, Beschreibungen, Notizen und Wiederholungsintervalle.
- **Path:** Lebensbereich → Ziel → Meilenstein → Aufgabe, automatische oder manuelle Fortschritte, Zielstatus, Prioritäten, nächste Aktion, Reihenfolge und Aktivitätsverlauf.
- **Blocks:** beschreibbare, farbige Vorlagen mit typisierten Elementen, relativen Positionen und Aufgabenbezug. Beim Anwenden entsteht eine vollständig unabhängige Tagesinstanz.
- **Journal:** Stimmung, Energie, Tags, Monatsfilter und aggregierte Monatswerte.
- **Finance:** Einnahmen, Ausgaben, eigene Kategorien, Monatsbudget, Auslastungsdiagramm, Filter sowie CSV-Export.
- **Maintenance:** detaillierte Checklisten, Tagesstatus und -notiz, Abschlusszeiten, Wochenansicht, Verlauf, Pause und flexible Wiederholungen.
- **System:** globale Suche und Quick Capture, Light/Dark/System, JSON-Sicherung, Merge/Replace-Import, Reset, optionaler Notification-Zugriff und PWA-Updatehinweis.

## Architektur

PersonalOS verwendet semantisches HTML, modernes CSS und native ES-Module. Es gibt kein Framework, keine Laufzeitabhängigkeit und keinen Build-Schritt.

- IndexedDB `personalOS`, Schema-Version 2, ist die einzige fachliche Datenquelle.
- Hash-Routing ermöglicht statisches Hosting und installierbare Deep Links.
- Views lesen Records und schreiben über einen zentralen Data-Service mit Activity Log.
- Datums-, Wiederholungs- und Formatierungslogik liegt in gemeinsamen Utilities.
- Der Service Worker cached die vollständige App-Shell und meldet verfügbare Updates.
- Dynamische Benutzertexte werden vor der HTML-Ausgabe escaped.

Details stehen in [`docs/architecture.md`](docs/architecture.md) und [`docs/data-model.md`](docs/data-model.md).

## Projektstruktur

```text
index.html
manifest.webmanifest
service-worker.js
assets/icons/             lokale PWA-Icons
css/                      Basis- und Komponentenstyles
js/
  app.js                  Boot, Navigation, Service-Worker-Updates
  db.js                   Schema, CRUD, Backup und Restore
  router.js, state.js     Routing und globale Einstellungen
  components/             Dialoge, Suche, Capture, Onboarding
  services/               fachübergreifende Datenoperationen
  utils/                  Datum, Wiederholung, Ausgabeformatierung
  views/                  eigenständige Feature-Views
docs/                     Architektur, Datenmodell, Testprotokoll
```

## Lokal starten

```bash
cd /workspace
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. Direktes Öffnen über `file://` funktioniert wegen ES-Modulen, Service Worker und Browser-Sicherheitsregeln nicht vollständig.

## Installation als PWA

1. PersonalOS über `localhost` oder HTTPS öffnen.
2. Im Browser „App installieren“ beziehungsweise auf iOS „Zum Home-Bildschirm“ wählen.
3. Nach dem ersten vollständigen Laden steht die App-Shell offline zur Verfügung.

Wenn ein neuer Service Worker installiert wurde, zeigt PersonalOS einen Updatehinweis. Erst die bestätigte Aktualisierung übernimmt die neue Version und lädt die Oberfläche neu.

## Speicherung und Datenschutz

Alle Inhalte liegen in IndexedDB im aktuellen Browserprofil. Es gibt keine Telemetrie und keine Netzwerksynchronisation. Browserdaten löschen, privater Modus, Profilwechsel oder Betriebssystembereinigung können die Daten entfernen. Regelmäßige Exporte werden deshalb ausdrücklich empfohlen.

Die lokale Datenbank ist nicht zusätzlich verschlüsselt. Der Schutz entspricht dem Schutz des Browserprofils und Geräts.

## Import und Export

Der JSON-Export hat das Format:

```json
{
  "meta": {
    "app": "PersonalOS",
    "version": 2,
    "exportedAt": "ISO-8601"
  },
  "data": {
    "tasks": []
  }
}
```

- **Merge:** Records gleicher ID werden ersetzt, andere lokale Records bleiben bestehen.
- **Replace:** Die vollständige Datei wird zuerst validiert. Erst nach einer zusätzlichen Bestätigung werden lokale Stores geleert und die Sicherung eingespielt.
- Fremde Stores, fehlende IDs, ungültige Metadaten und Backups einer neueren Schema-Version werden abgelehnt.
- Finance bietet zusätzlich einen CSV-Export des gewählten Monats.

## Browser-Kompatibilität

Zielplattformen sind aktuelle Versionen von Safari/iOS, Chrome/Chromium, Edge und Firefox mit ES-Modulen, IndexedDB und Service Worker. `crypto.randomUUID`, `structuredClone`, CSS `color-mix()` und moderne Intl-APIs werden vorausgesetzt. Installation und Service Worker benötigen HTTPS oder `localhost`.

## Echte Plattformgrenzen

- Keine Cloud-Synchronisierung, Multi-User-Funktion, Server-Backups oder Ende-zu-Ende-Verschlüsselung.
- Browser-Notifications können freigegeben werden; ohne Push-Server und natives Scheduling sind zuverlässige Hintergrundalarme nicht garantiert.
- Kalenderwiederholungen gelten als Serie. Ausnahmen einzelner Vorkommen und externe CalDAV-/ICS-Synchronisation sind nicht implementiert.
- Finance ist ein persönliches Planungswerkzeug, keine Buchhaltungs- oder Banking-Anwendung.
- Offline-Updates können erst geladen werden, nachdem die neue Shell einmal online heruntergeladen wurde.

## Erweiterungen

Neue Fachbereiche erhalten einen Store-Migrationsschritt in `js/db.js`, eine isolierte View und optional einen Eintrag in Suche/Navigation. Bestehende Backup-Versionen müssen weiterhin validiert oder explizit migriert werden. Wiederholungsregeln gehören zentral nach `js/utils/date.js`; persistente Schreibvorgänge sollen über `js/services/data.js` laufen.

Vor Releases sollte die Checkliste in [`docs/test-checklist.md`](docs/test-checklist.md) mit realen Browsern durchgeführt und nur nach tatsächlicher Prüfung markiert werden.
