# Architektur

PersonalOS ist eine statische PWA ohne Build-System.

## Schichten

- `index.html` enthält ausschließlich die semantische App-Shell.
- `js/app.js` initialisiert Datenbank, Navigation, Views, Onboarding und Service Worker.
- `js/router.js` implementiert Hash-Routing und den zentralen Render-/Fehlerpfad.
- `js/state.js` hält kleine globale Einstellungen; fachliche Daten bleiben in IndexedDB.
- `js/db.js` kapselt das versionierte Schema, CRUD, Backup/Restore und das auf 500 Einträge begrenzte Activity Log.
- `js/services/` enthält fachübergreifende Speicherung und Suche.
- `js/components/` enthält Dialoge, Toasts, Quick Capture, Suche und Onboarding.
- `js/views/` enthält unabhängige Feature-Views.
- `js/utils/` bündelt Datum, Wiederholung, Escaping und Formatierung.

Views erzeugen Markup aus persistierten Records und binden danach Events. Benutzerinhalte werden vor Einfügung in HTML escaped. Schreiboperationen laufen über `saveEntity`/`removeEntity` und erzeugen Activity-Log-Einträge.

## Offline

Der Service Worker cached die komplette Shell beim Installieren. GET-Anfragen verwenden Cache-first und ergänzen erfolgreiche Antworten. Navigation fällt ohne Netz auf `index.html` zurück. IndexedDB bleibt die alleinige Datenquelle.

## Versionierung

`DB_VERSION` steuert `onupgradeneeded`. Neue Schemaänderungen müssen additiv pro Versionsschritt erfolgen. Backup-Dateien tragen `schemaVersion`; unbekannte Stores und Records ohne ID werden vor dem Import abgelehnt.

## Barrierearmut

Semantisches Main/Nav/Aside, Skip-Link, Fokusübergabe beim Routing, native Formcontrols, sichtbare Fokusrahmen, ARIA-Dialoge, Escape-Schließen, Live-Toasts und bestätigte destruktive Aktionen bilden die Basis. Eine vollständige WCAG-Zertifizierung ist nicht Bestandteil des Projekts.
