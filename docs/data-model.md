# Datenmodell

Datenbank: `personalOS`, Version 1. Alle Stores verwenden `id` als Key Path sowie ISO-Zeitstempel `createdAt` und `updatedAt`.

| Store | Wesentliche Felder |
|---|---|
| `tasks` | title, priority, due, status, goalId, milestoneId, tags, notes, completedAt |
| `calendarEvents` | title, start, end, allDay, location, recurrence, recurrenceUntil, color, notes |
| `lifeAreas` | title, description, color |
| `goals` | lifeAreaId, title, progressMode, progress, targetDate |
| `milestones` | goalId, title, progress, targetDate |
| `blockTemplates` | title, items[] `{start,title,duration}` |
| `dayPlans` | date, templateId, items[] `{start,title,duration,done}` |
| `journalEntries` | date, title, content, mood, energy, tags |
| `transactions` | type, description, amount, date, categoryId, notes |
| `financeCategories` | name, color |
| `monthlyBudgets` | month, amount |
| `maintenanceTemplates` | title, category, startDate, recurrence, interval, weekdays, checklist, paused |
| `maintenanceDays` | date, checks `{templateId: boolean}` |
| `settings` | Record `preferences` mit profile, theme, dashboard, onboardingComplete |
| `uiState` | Reserviert für persistente, nichtfachliche UI-Zustände |
| `activityLog` | action, entity, entityId, detail, timestamp; maximal 500 Records |

## Wiederholung

Kalender unterstützt keine, tägliche, wöchentliche, monatliche und jährliche Wiederholung bis zu einem optionalen Enddatum. Maintenance unterstützt einmalig, täglich mit Intervall, wöchentlich mit Wochentagen und monatlich am Starttag.

## Import

`merge` überschreibt Records gleicher ID und behält andere. `replace` leert alle Stores vor dem Import. Validiert werden App-Kennung, Datenobjekt, bekannte Stores, Arrays und Record-IDs.
