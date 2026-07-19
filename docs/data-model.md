# Datenmodell

Datenbank: `personalOS`, Version 2. Alle Stores verwenden `id` als Key Path sowie ISO-Zeitstempel `createdAt` und `updatedAt`.

| Store | Wesentliche Felder |
|---|---|
| `tasks` | title, description, priority (`critical/high/medium/low`), status (`open/inProgress/done/archived`), dueDate, startTime, endTime, estimatedDuration, completedAt, goalId, milestoneId, tags, notes |
| `calendarEvents` | title, category, description, notes, start, end, allDay, location, recurrence, recurrenceInterval, recurrenceUntil, color |
| `lifeAreas` | title, description, color |
| `goals` | lifeAreaId, title, description, status, priority, startDate, targetDate, symbol, color, progressMode, progress, order |
| `milestones` | goalId, title, description, status, targetDate, order |
| `blockTemplates` | title, description, color, defaultStartTime, items[] |
| `dayPlans` | date, templateId, items[] |
| `journalEntries` | date, time, title, content, mood, energy, wins, challenges, insights, nextImprovement, tags |
| `transactions` | type, description, amount, date, categoryId, merchant, notes, recurrence, recurrenceInterval, recurrenceUntil |
| `financeCategories` | name, color |
| `monthlyBudgets` | month, amount, categoryBudgets, rollover |
| `maintenanceTemplates` | title, description, category, preferredTime, startDate, endDate, maxOccurrences, recurrence, interval, weekdays, checklist, paused |
| `maintenanceDays` | date, status, note, completedAt, checks |
| `settings` | Record `preferences` mit profile, theme, dashboard, onboardingComplete |
| `uiState` | reserviert für persistente nichtfachliche UI-Zustände |
| `activityLog` | action, entity, entityId, detail, timestamp; maximal 500 Records |

## Eingebettete Records

Ein Blockvorlagenelement enthält `title`, `description`, `type`, `relativeOffset`, `standardTime`, `duration` und optional `taskId`. Beim Anwenden werden diese Werte kopiert und um eine berechnete `start`-Zeit sowie `done` ergänzt. Spätere Vorlagenänderungen wirken nicht auf `dayPlans`.

`maintenanceDays.checks[templateId]` enthält `status`, `completedAt` und `items`. Jeder Record `items[index]` besitzt einen eigenen Status `open/done` und eine optionale Abschlusszeit. Der Tagesrecord enthält zusätzlich den expliziten Gesamtstatus `open/partial/done/skipped`.

## Wiederholung

Kalendertermine unterstützen keine, tägliche, wöchentliche, monatliche, jährliche oder benutzerdefiniert-tägliche Wiederholung mit frei wählbarem Intervall und optionalem Enddatum.

Maintenance unterstützt einmalig, täglich/alle X Tage, bestimmte Wochentage/alle X Wochen, monatlich/alle X Monate und jährlich/alle X Jahre. Enddatum oder maximale Anzahl begrenzen die Serie. Die zentrale Fälligkeitslogik liegt in `js/utils/date.js`.

Wiederkehrende Finanztransaktionen bleiben als einzelne Serie gespeichert. Finance berechnet die sichtbaren Monatsvorkommen aus Startdatum, Regel, Intervall und optionalem Enddatum. Monatsbudgets sind eigenständige Records; `rollover` übernimmt einen Wert nur in einen noch nicht individuell konfigurierten Folgemonat.

## Backup und Import

Version 2 verwendet ausschließlich:

```json
{"meta":{"app":"PersonalOS","version":2,"exportedAt":"…"},"data":{}}
```

Vor jeder Mutation werden Metadaten, Version, Stores, Arrays, Records und IDs validiert. `merge` überschreibt Records gleicher ID. `replace` leert nach expliziter UI-Bestätigung alle Stores und importiert anschließend die validierten Records.

## Kompatibilität

Version-1-Records bleiben lesbar: alte Aufgabenstatus `todo/doing` und das frühere kombinierte `due` werden in der Aufgabenansicht normalisiert. Neue Schreibvorgänge verwenden ausschließlich die Version-2-Felder.
