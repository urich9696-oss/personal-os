# AGENTS.md

## Cursor Cloud specific instructions

### What this is
`PERSONAL OS` is a fully client-side, vanilla-JS Progressive Web App (a personal
productivity tool with Dashboard, Alignment, Maintenance, Path, Finance and
Settings views). All data lives in the browser via IndexedDB (`personal_os_db`,
see `db.js`). There is **no backend, no build step, no package manager, and no
dependencies** — the whole app is `index.html`, `app.js`, `db.js`, `sw.js`,
`manifest.js`, `css/stlye.css` and `assets/icons/`.

### Running the app (development)
Serve the repo root over HTTP and open the app in a browser. A service worker
requires an HTTP origin (opening `index.html` via `file://` will not work):

```
python3 -m http.server 8000     # run from the repo root
```

Then open `http://localhost:8000/index.html`. Any static file server works
(`npx serve`, etc.); Python's built-in server is used because it needs no
install.

### Lint / test / build
There are no lint, test, or build tools configured in this repo (no
`package.json`, no config files). "Build" is a no-op; the served files are the
app.

### Non-obvious caveats
- **The app currently renders unstyled and logs 404s.** `index.html`/`sw.js`
  reference `./style.css`, `./manifest.json` and `./icons/*`, but the actual
  files are `css/stlye.css`, `manifest.js` and `assets/icons/*`. These are
  pre-existing path mismatches in the repo, not an environment problem. The
  JavaScript (routing + IndexedDB) works fine regardless.
- **The Maintenance view does not re-render after adding an item or toggling a
  checkbox.** The handlers call `Router.go("maintenance")`, but since the hash is
  already `#/maintenance` no `hashchange` fires, so the DOM is not rebuilt. The
  data is still written to IndexedDB — reload the page (or navigate to another
  view and back) to see the updated list/score. The Dashboard reads fresh from
  the DB and reflects changes immediately.
- **State persists in the browser, not on disk.** Data is stored in IndexedDB
  under `personal_os_db`. To reset, clear the site's storage in the browser.
- **Service worker caches aggressively.** After editing `app.js`/`db.js`/CSS you
  may see stale content. Append `?nosw=1` to the URL (e.g.
  `http://localhost:8000/index.html?nosw=1`) to unregister the service worker and
  clear caches (handled in `app.js`), then reload.
