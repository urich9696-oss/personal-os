(function () {
  "use strict";

  ScreenRegistry.register("settings", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Settings (Technisch)" }, []);
      container.appendChild(title);

      var s = await State.getSettings();

      var info = UI.el("div", { className: "card tile" }, []);
      info.appendChild(UI.el("div", { className: "tile__label", text: "Version info" }, []));
      info.appendChild(UI.el("div", { className: "tile__value", text: "App: " + ((s && s.version && s.version.app) ? s.version.app : "—") + " · DB: " + ((s && s.version && s.version.db) ? s.version.db : "—") }, []));
      container.appendChild(info);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Debug toggle
      var debugCard = UI.el("div", { className: "card tile" }, []);
      debugCard.appendChild(UI.el("div", { className: "tile__label", text: "Debug" }, []));
      var dbg = (s && s.debug && s.debug.enabled) ? true : false;

      var dbgBtn = UI.el("button", { className: "btn", type: "button", text: dbg ? "Disable Debug" : "Enable Debug" }, []);
      dbgBtn.addEventListener("click", function () {
        State.getSettings().then(function (s2) {
          s2.debug = s2.debug || {};
          s2.debug.enabled = !dbg;
          State.updateSettings({ debug: s2.debug }).then(function () {
            UI.toast("Saved");
            Router.go("settings", {});
          });
        });
      });

      debugCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      debugCard.appendChild(dbgBtn);
      container.appendChild(debugCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Backup
      var backupCard = UI.el("div", { className: "card tile" }, []);
      backupCard.appendChild(UI.el("div", { className: "tile__label", text: "Backup" }, []));

      var expBtn = UI.el("button", { className: "btn", type: "button", text: "Export JSON Backup" }, []);
      expBtn.addEventListener("click", function () {
        State.exportBackup().then(function (b) {
          var fn = "personal-os-backup-" + UI.formatDateISO(new Date()) + ".json";
          UI.downloadJson(fn, b);
          UI.toast("Exported");
        }).catch(function (e) {
          UI.toast("Export error: " + (e && e.message ? e.message : String(e)));
        });
      });

      var impBtn = UI.el("button", { className: "btn", type: "button", text: "Import JSON Backup" }, []);
      impBtn.addEventListener("click", function () {
        openImportFlow();
      });

      backupCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      backupCard.appendChild(expBtn);
      backupCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      backupCard.appendChild(impBtn);
      container.appendChild(backupCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Resets
      var resetCard = UI.el("div", { className: "card tile" }, []);
      resetCard.appendChild(UI.el("div", { className: "tile__label", text: "Resets" }, []));

      var softBtn = UI.el("button", { className: "btn", type: "button", text: "Soft Reset (Today only)" }, []);
      softBtn.addEventListener("click", function () {
        UI.confirm("Soft Reset", "Reset today journal + today blocks + today vault?").then(function (ok) {
          if (!ok) return;
          State.softResetTodayOnly().then(function () {
            UI.toast("Soft reset done");
            Router.go("dashboard", {});
          });
        });
      });

      var hardBtn = UI.el("button", { className: "btn", type: "button", text: "Hard Reset (delete everything)" }, []);
      hardBtn.addEventListener("click", function () {
        UI.confirm("Hard Reset", "This deletes the entire local database. Continue?").then(function (ok) {
          if (!ok) return;
          State.hardReset().then(function () {
            UI.toast("DB deleted. Reloading…");
            window.setTimeout(function () { location.reload(); }, 400);
          });
        });
      });

      resetCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      resetCard.appendChild(softBtn);
      resetCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      resetCard.appendChild(hardBtn);
      container.appendChild(resetCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Cache / SW
      var swCard = UI.el("div", { className: "card tile" }, []);
      swCard.appendChild(UI.el("div", { className: "tile__label", text: "Cache / Service Worker" }, []));

      var clearCacheBtn = UI.el("button", { className: "btn", type: "button", text: "Cache löschen (caches.delete)" }, []);
      clearCacheBtn.addEventListener("click", function () {
        clearAllCaches();
      });

      var unregBtn = UI.el("button", { className: "btn", type: "button", text: "Service Worker unregister" }, []);
      unregBtn.addEventListener("click", function () {
        unregisterAllSW();
      });

      var hint = UI.el("div", { className: "ui-text", text: "Kill switch: add ?nosw=1 to URL to force-unregister SW + delete caches + reload." }, []);

      swCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      swCard.appendChild(clearCacheBtn);
      swCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      swCard.appendChild(unregBtn);
      swCard.appendChild(UI.el("div", { style: "height:10px" }, []));
      swCard.appendChild(hint);

      container.appendChild(swCard);

      function openImportFlow() {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";

        input.onchange = function () {
          var file = input.files && input.files[0];
          if (!file) return;

          var reader = new FileReader();
          reader.onload = function () {
            try {
              var obj = JSON.parse(String(reader.result || "{}"));
              importBackupObject(obj);
            } catch (e) {
              UI.toast("Invalid JSON");
            }
          };
          reader.readAsText(file);
        };

        input.click();
      }

      async function importBackupObject(obj) {
        var ok = await UI.confirm("Import Backup", "This will overwrite current local data (hard reset). Continue?");
        if (!ok) return;

        await State.hardReset();
        location.reload();
      }

      async function clearAllCaches() {
        try {
          if (!("caches" in window)) { UI.toast("Caches API not available"); return; }
          var keys = await caches.keys();
          for (var i = 0; i < keys.length; i++) {
            await caches.delete(keys[i]);
          }
          UI.toast("Caches cleared. Reloading…", 2000);
          setTimeout(function () { location.reload(); }, 500);
        } catch (e) {
          UI.toast("Cache clear error");
        }
      }

      async function unregisterAllSW() {
        try {
          if (!("serviceWorker" in navigator)) { UI.toast("SW not supported"); return; }
          var regs = await navigator.serviceWorker.getRegistrations();
          for (var i = 0; i < regs.length; i++) {
            await regs[i].unregister();
          }
          UI.toast("SW unregistered. Reloading…", 2000);
          setTimeout(function () { location.reload(); }, 500);
        } catch (e) {
          UI.toast("Unregister error");
        }
      }
    }
  });
})();
