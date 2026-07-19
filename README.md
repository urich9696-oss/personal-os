# PersonalOS

PersonalOS ist eine lokale, offlinefähige Vanilla-JavaScript-PWA für Aufgaben, Kalender, Ziele, Tagesblöcke, Journal, Finanzen und wiederkehrende Maintenance.

## Start

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. Es gibt keinen Build-Schritt und keine externen Abhängigkeiten. Für Installation und Offline-Modus ist ein sicherer Kontext erforderlich (`localhost` gilt als sicher).

## Datenschutz

Alle Inhalte liegen in IndexedDB im aktuellen Browserprofil. PersonalOS sendet keine Daten an einen Server. Regelmäßige JSON-Exporte unter **Mehr → Einstellungen** werden empfohlen. Das Löschen von Browserdaten löscht auch PersonalOS-Daten.

## Bedienung

- Die fünf Hauptbereiche sind Dashboard, Calendar, Path, Blocks und More.
- **Erfassen** öffnet global Aufgabe, Termin, Journal, Ausgabe oder Einnahme.
- Die Lupe durchsucht Inhalte store-übergreifend.
- Wisch nach links ist technisch vorbereitet; alle destruktiven Aktionen sind zusätzlich über beschriftete Löschbuttons und Bestätigungen erreichbar.
- Vorlagen in Blocks werden beim Anwenden kopiert. Änderungen an einer Vorlage verändern bestehende Tagespläne nicht.

Weitere Details: [Architektur](docs/architecture.md), [Datenmodell](docs/data-model.md), [Test-Checkliste](docs/test-checklist.md).
