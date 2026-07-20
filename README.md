# PERSONAL OS

PERSONAL OS ist eine installierbare Progressive Web App (PWA). Sie läuft ohne
Backend und speichert ihre Daten lokal im Browser.

## GitHub Pages

GitHub Pages veröffentlicht den Inhalt des Repository-Roots von `main`
automatisch unter:

<https://urich9696-oss.github.io/personal-os/>

Nach einem Merge oder Push auf `main` kann die Aktualisierung einige Minuten
benötigen.

## Auf dem Handy installieren

1. Die veröffentlichte URL auf dem Handy öffnen.
2. Auf dem iPhone in Safari **Teilen → Zum Home-Bildschirm** wählen.
3. Auf Android in Chrome **Menü → App installieren** wählen.

Für Service Worker und Installation ist HTTPS erforderlich. GitHub Pages stellt
HTTPS automatisch bereit. Der private Browsermodus sollte nicht verwendet
werden, da PERSONAL OS seine Daten in IndexedDB speichert.

## Lokal starten

Es gibt keinen Build-Schritt und keine Laufzeitabhängigkeiten:

```bash
python3 -m http.server 8080
```

Danach <http://localhost:8080/> öffnen. Service Worker funktionieren lokal über
`localhost`; das direkte Öffnen von `index.html` als Datei reicht nicht aus.

## Datensicherheit

Die App hat derzeit keine Cloud-Synchronisierung. Löschen der Website-Daten oder
ein Gerätewechsel kann deshalb zum Verlust der lokal gespeicherten Inhalte
führen.
