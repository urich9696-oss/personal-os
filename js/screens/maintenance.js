// js/screens/maintenance.js
// PERSONAL OS — Maintenance (System / Admin / Debug) — State-first, no direct IndexedDB
// Anforderungen umgesetzt:
// - Version Info (aus Export-Meta)
// - Export JSON (State.exportAll)
// - Import JSON (State.importAll) via File Picker
// - Soft Reset (Today Only): setzt Status + löscht heutigen Journal-Eintrag (über State-APIs)
// - Hard Reset: komplette DB löschen (State.resetDB) + Reload
// - Cache Reset Hinweis + Cache löschen (caches API) + optional SW unregister
// - Debug Toggle (persistiert in settings.ui.debug)
// - On-Screen Guidance statt DevTools-Zwang

ScreenRegistry.register("maintenance", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const root = document.createElement("div");
      root.className = "maintenance";

      const title = document.createElement("h2");
      title.textContent = "System / Maintenance";
      root.appendChild(title);

      // ===== VERSION / INFO =====
      const infoCard = document.createElement("div");
      infoCard.className = "dash-card";
      infoCard.innerHTML = `
        <div style="font-weight:900; margin-bottom:6px;">Version Info</div>
        <div style="font-size:13px; opacity:0.8;">DB: personalOS (IndexedDB)</div>
        <div id="ver-meta" style="font-size:13px; opacity:0.8; margin-top:6px;">Lade Metadaten…</div>
      `;
      root.appendChild(infoCard);

      // Resolve meta via exportAll (read-only)
      let meta = null;
      try {
        const payload = await State.exportAll();
        meta = payload && payload.meta ? payload.meta : null;
      } catch (_) {}

      const metaEl = infoCard.querySelector("#ver-meta");
      if (metaEl) {
        metaEl.textContent = meta
          ? ("ExportedAt: " + new Date(meta.exportedAt).toISOString() + " · DB Version: " + String(meta.dbVersion))
          : "Meta nicht verfügbar (ExportAll fehlgeschlagen).";
      }

      // ===== DEBUG TOGGLE =====
      const debugCard = document.createElement("div");
      debugCard.className = "dash-card";
      debugCard.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Debug</div>`;
      root.appendChild(debugCard);

      const settings = await State.getSettings();
      const ui = (settings && settings.ui) ? settings.ui : {};
      const debugEnabled = !!ui.debug;

      const dbgRow = document.createElement("div");
      dbgRow.style.fontSize = "13px";
      dbgRow.style.opacity = "0.85";
      dbgRow.style.marginBottom = "8px";
      dbgRow.textContent = "On-Screen Diagnostics: " + (debugEnabled ? "ON" : "OFF");
      debugCard.appendChild(dbgRow);

      const dbgBtn = document.createElement("button");
      dbgBtn.type = "button";
      dbgBtn.textContent = debugEnabled ? "Disable Debug" : "Enable Debug";
      dbgBtn.onclick = async function () {
        const s = await State.getSettings();
        if (!s) return;

        if (!s.ui) s.ui = {};
        s.ui.debug = !s.ui.debug;

        const ok = await State.putSettings(s);
        if (!ok) {
          alert("Konnte Debug Setting nicht speichern.");
          return;
        }

        // Also set runtime flag (optional)
        window.PersonalOS = window.PersonalOS || {};
        window.PersonalOS.debug = !!s.ui.debug;

        Router.go("maintenance");
      };
      debugCard.appendChild(dbgBtn);

      const dbgHint = document.createElement("div");
      dbgHint.style.fontSize = "13px";
      dbgHint.style.opacity = "0.75";
      dbgHint.style.marginTop = "8px";
      dbgHint.textContent =
        "Wenn Debug ON: Router-Error-Screens und System-Hinweise sind sichtbarer. Kein DevTools-Zwang.";
      debugCard.appendChild(dbgHint);

      // ===== BACKUP =====
      const backupCard = document.createElement("div");
      backupCard.className = "dash-card";
      backupCard.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Backup</div>`;
      root.appendChild(backupCard);

      // Export
      const exportBtn = document.createElement("button");
      exportBtn.type = "button";
      exportBtn.textContent = "Export JSON Backup";
      exportBtn.onclick = async function () {
        const payload = await State.exportAll();
        if (!payload) {
          alert("Export fehlgeschlagen.");
          return;
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "personal-os-backup.json";
        a.click();

        URL.revokeObjectURL(url);
      };
      backupCard.appendChild(exportBtn);

      // Import
      const importBtn = document.createElement("button");
      importBtn.type = "button";
      importBtn.textContent = "Import JSON Backup";
      importBtn.onclick = function () {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";

        input.onchange = async function () {
          try {
            const file = input.files && input.files[0];
            if (!file) return;

            const txt = await file.text();
            const payload = JSON.parse(txt);

            const ok = await State.importAll(payload);
            if (!ok) {
              alert("Import fehlgeschlagen.");
              return;
            }

            alert("Import abgeschlossen. App wird neu geladen.");
            location.reload();
          } catch (e) {
            alert("Ungültige Datei oder Fehler beim Import.");
          }
        };

        input.click();
      };
      backupCard.appendChild(importBtn);

      const backupHint = document.createElement("div");
      backupHint.style.fontSize = "13px";
      backupHint.style.opacity = "0.75";
      backupHint.style.marginTop = "8px";
      backupHint.textContent =
        "Export/Import sichert alle Stores. Import überschreibt/ergänzt per put().";
      backupCard.appendChild(backupHint);

      // ===== RESET =====
      const resetCard = document.createElement("div");
      resetCard.className = "dash-card";
      resetCard.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Reset</div>`;
      root.appendChild(resetCard);

      // Soft reset today only
      const softBtn = document.createElement("button");
      softBtn.type = "button";
      softBtn.textContent = "Soft Reset (Today Only)";
      softBtn.onclick = async function () {
        const okConfirm = window.confirm("Heute zurücksetzen? (Status -> morning, heutiges Journal wird geleert)");
        if (!okConfirm) return;

        const today = State.getTodayKey();

        // Reset day state via settings
        const s = await State.getSettings();
        if (!s) { alert("Settings fehlen."); return; }

        s.currentDayKey = today;
        s.dayStatus = "morning";
        s.morningCompletedAt = null;
        s.eveningStartedAt = null;
        s.dayClosedAt = null;

        const okSet = await State.putSettings(s);
        if (!okSet) { alert("Soft Reset: Settings speichern fehlgeschlagen."); return; }

        // Delete today's journal by overwriting empty shape
        const empty = State.ensureJournalShape(null, today);
        const okJ = await State.putJournal(empty);
        if (!okJ) { alert("Soft Reset: Journal reset fehlgeschlagen."); return; }

        alert("Heute zurückgesetzt.");
        Router.go("dashboard");
      };
      resetCard.appendChild(softBtn);

      // Hard reset full DB
      const hardBtn = document.createElement("button");
      hardBtn.type = "button";
      hardBtn.textContent = "Hard Reset (Delete ALL Data)";
      hardBtn.style.background = "#B3261E";
      hardBtn.style.color = "#F6F5F2";

      hardBtn.onclick = async function () {
        const okConfirm = window.confirm("WARNUNG: Das löscht ALLE Daten. Fortfahren?");
        if (!okConfirm) return;

        const ok = await State.resetDB();
        if (!ok) {
          alert("DB Reset fehlgeschlagen (blocked?). Schließe andere Tabs und versuche erneut.");
          return;
        }

        alert("DB gelöscht. App lädt neu.");
        location.reload();
      };
      resetCard.appendChild(hardBtn);

      // ===== CACHE / SERVICE WORKER =====
      const cacheCard = document.createElement("div");
      cacheCard.className = "dash-card";
      cacheCard.innerHTML = `<div style="font-weight:900; margin-bottom:10px;">Cache / Service Worker</div>`;
      root.appendChild(cacheCard);

      const cacheHint = document.createElement("div");
      cacheHint.style.fontSize = "13px";
      cacheHint.style.opacity = "0.75";
      cacheHint.textContent =
        "Wenn Änderungen nicht ankommen (White Screen/alte Scripts): Cache löschen + optional Service Worker deregistrieren.";
      cacheCard.appendChild(cacheHint);

      const clearCacheBtn = document.createElement("button");
      clearCacheBtn.type = "button";
      clearCacheBtn.textContent = "Clear Cache Storage";
      clearCacheBtn.onclick = async function () {
        try {
          if (!("caches" in window)) {
            alert("Cache API nicht verfügbar.");
            return;
          }
          const keys = await caches.keys();
          for (let i = 0; i < keys.length; i++) await caches.delete(keys[i]);
          alert("Cache gelöscht. Reload.");
          location.reload();
        } catch (_) {
          alert("Cache löschen fehlgeschlagen.");
        }
      };
      cacheCard.appendChild(clearCacheBtn);

      const swBtn = document.createElement("button");
      swBtn.type = "button";
      swBtn.textContent = "Unregister Service Worker";
      swBtn.onclick = async function () {
        try {
          if (!("serviceWorker" in navigator)) {
            alert("Service Worker nicht verfügbar.");
            return;
          }
          const regs = await navigator.serviceWorker.getRegistrations();
          for (let i = 0; i < regs.length; i++) await regs[i].unregister();
          alert("Service Worker entfernt. Reload.");
          location.reload();
        } catch (_) {
          alert("Unregister fehlgeschlagen.");
        }
      };
      cacheCard.appendChild(swBtn);

      // Optional: show SW scope
      const swInfo = document.createElement("div");
      swInfo.style.fontSize = "13px";
      swInfo.style.opacity = "0.75";
      swInfo.style.marginTop = "8px";
      swInfo.textContent = await getSwScopeText();
      cacheCard.appendChild(swInfo);

      container.appendChild(root);

    } catch (e) {
      console.error("Maintenance mount error", e);
      container.innerHTML = "<div class='error'>Maintenance failed</div>";
    }

    async function getSwScopeText() {
      try {
        if (!("serviceWorker" in navigator)) return "SW: nicht unterstützt";
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return "SW: nicht registriert";
        return "SW Scope: " + String(reg.scope || "");
      } catch (_) {
        return "SW: Status unbekannt";
      }
    }
  }
});
