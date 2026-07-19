# Manuelle Test-Checkliste

## Installation und Shell
- [ ] `python3 -m http.server 8080`, App ohne Konsolenfehler öffnen
- [ ] Bottom-Navigation mobil exakt Dashboard / Calendar / Path / Blocks / More
- [ ] Desktop-Sidebar und sichere iPhone-Inset-Abstände prüfen
- [ ] App installieren, neu laden und danach im Offline-Modus öffnen
- [ ] Hell, Dunkel und System wechseln; Fokus und Kontraste prüfen

## Datenflüsse
- [ ] Onboarding abschließen und überspringen; keine Demodaten werden erzeugt
- [ ] Aufgaben anlegen, bearbeiten, erledigen, wieder öffnen, duplizieren, filtern, suchen und löschen
- [ ] Ziel/Meilenstein verknüpfen; automatischen und manuellen Fortschritt prüfen
- [ ] Kalender in Monat/Woche/Tag; wiederholte Termine und Serienlöschung prüfen
- [ ] Blockvorlage erstellen, Elemente per Drag-and-drop sortieren und auf zwei Tage anwenden
- [ ] Vorlage ändern; bereits erzeugte Tagesinstanzen bleiben unverändert
- [ ] Journalwerte/Tags erfassen und Monats-, Stimmungs- und Tagfilter prüfen
- [ ] Kategorien, Einnahmen, Ausgaben und Budget erfassen; Diagramm, Filter und CSV prüfen
- [ ] Maintenance täglich/wöchentlich/monatlich, Pause, Tageswechsel und Verlauf prüfen
- [ ] Dashboard-Kacheln, Schnellaktionen, globale Suche und alle Links prüfen

## Integrität und Fehlerfälle
- [ ] JSON exportieren und per Merge wieder importieren
- [ ] Ungültiges JSON sowie fremde/fehlerhafte Backup-Struktur ablehnen
- [ ] Replace-Import nach Bestätigung und vollständigen Reset prüfen
- [ ] Löschen jeweils abbrechen und bestätigen
- [ ] Browser-Speicher blockieren: verständliche Fehlermeldung statt leerer Seite
- [ ] Activity Log nach mehr als 500 Aktionen auf 500 Einträge begrenzt
- [ ] Tastatur: Skip-Link, Tab-Reihenfolge, Dialogfokus, Escape-Schließen
