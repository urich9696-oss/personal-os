# Testprotokoll und manuelle Checkliste

Häkchen dokumentieren ausschließlich in dieser Arbeitsrunde tatsächlich ausgeführte Prüfungen. Offene Punkte benötigen weiterhin einen manuellen Test auf den Zielbrowsern.

## Ausgeführt am 19. Juli 2026

- [x] App über `python3 -m http.server 8080` ausgeliefert; HTML, Module, Manifest, Service Worker und Icons antworten mit HTTP 200.
- [x] Sämtliche JavaScript-Dateien mit `node --check` geprüft.
- [x] Manifest als JSON validiert; alle statischen Imports und lokalen Shell-Assets existieren.
- [x] Dashboard, Tasks, Calendar, Path, Blocks, More, Journal, Finance, Maintenance und Settings in Headless Chrome gerendert; keine Runtime-Ausnahme.
- [x] Bottom-Navigation im DOM exakt als Dashboard / Calendar / Path / Blocks / More geprüft.
- [x] Aufgabenformular mit kritischer Priorität, Beschreibung, Status, Datum, Start-/Endzeit und Dauer gespeichert.
- [x] Aufgabe gelöscht und über sichtbare Undo-Aktion erfolgreich wiederhergestellt.
- [x] Kalender-Tagesansicht zeigte gleichzeitig Termin, zeitgebundene Aufgabe, Tagesblock und ungebundene Maintenance.
- [x] Kalenderansicht auf „Tag“ gewechselt und persistierten Wert in IndexedDB geprüft.
- [x] Dashboard-Fortschritt aus Aufgabe, Maintenance und Tagesblock als `0/3` geprüft; Aufgabe und Block direkt abgehakt und `2/3` geprüft.
- [x] Einzelnen Maintenance-Checklistenpunkt abgehakt; `partial` und Punktstatus persistent in IndexedDB geprüft.
- [x] Blockvorlage mit gewählter Startzeit angewendet; berechnete Startzeit geprüft.
- [x] Tagesblock individuell umbenannt; unveränderte Vorlage danach geprüft.
- [x] Onboarding übersprungen; App blieb ohne automatisch erzeugte Fach-/Demodaten nutzbar.
- [x] Exportstruktur auf exakt `meta` und `data` sowie die drei Meta-Felder geprüft.
- [x] Backup einer neueren Version vor Replace abgelehnt; vorhandene Aufgabe blieb unverändert.
- [x] Globale Suche lieferte eine Blockvorlage als Treffer.
- [x] Ziel mit einem abhängigen Meilenstein gelöscht; Warntext, Cascade-Löschung und Entkopplung der erhaltenen Aufgabe geprüft.

## Noch manuell auf Zielgeräten zu prüfen

### Installation und Darstellung
- [ ] PWA auf iPhone installieren, vollständig schließen und offline neu öffnen.
- [ ] Safe Areas im Hoch-/Querformat sowie Desktop-Sidebar visuell prüfen.
- [ ] Hell, Dunkel und System inklusive Kontrasten und reduzierter Bewegung prüfen.
- [ ] Service-Worker-Update installieren und sichtbaren Updatehinweis bestätigen.

### Vollständige Datenflüsse
- [ ] Alle Aufgabenfilter, Ziel-/Meilensteinfilter, Sortierungen, Duplizieren, Verschieben und Archivierung kombinieren.
- [ ] Wiederholungstermine mit Tages-, Wochen-, Monats-, Jahres- und benutzerdefiniertem Intervall über Monatsgrenzen prüfen.
- [ ] Ziel pausieren, fortsetzen und abschließen; manuelle/automatische Fortschritte vergleichen.
- [ ] Blockelemente auf/ab sortieren, Tagesplan als Vorlage speichern, Vorlage duplizieren und Tagesblock löschen.
- [ ] Maintenance alle X Wochen/Monate, Wochentage, jährlich, Enddatum, Maximalvorkommen, skipped und Pause prüfen.
- [ ] Journal- und Finance-CRUD, Monatsstatistik, Kategorien, Budgets, Diagramm und CSV vollständig prüfen.
- [ ] Globale Suche für alle Typen einschließlich Blockvorlagen prüfen.

### Integrität und Accessibility
- [ ] JSON exportieren und Merge-Import in einem frischen Browserprofil prüfen.
- [ ] Replace-Import bestätigen und kontrollieren, dass erst nach Bestätigung mutiert wird.
- [ ] Fremdes, beschädigtes und zu neues Backup über die UI ablehnen.
- [ ] Vollständigen Reset und anschließende CHF-/Onboarding-Defaults prüfen.
- [ ] Activity Log nach mehr als 500 Schreibaktionen auf exakt 500 Einträge prüfen.
- [ ] Browser-Speicher blockieren und verständlichen Fehlerzustand prüfen.
- [ ] Fokusfalle, Shift-Tab, Escape und Fokusrückgabe mit Tastatur und Screenreader prüfen.
- [ ] Alle sichtbaren Buttons auf Mobile und Desktop einmal manuell betätigen.
