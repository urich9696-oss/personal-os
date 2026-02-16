// js/screens/maintenance.js
// PERSONAL OS — Maintenance (System / Admin / Debug)

ScreenRegistry.register("maintenance", {

  async mount(container, ctx) {

    try {

      container.innerHTML = "";

      const root = document.createElement("div");
      root.className = "maintenance";

      const title = document.createElement("h2");
      title.innerText = "System / Maintenance";
      root.appendChild(title);

      // ===== VERSION INFO =====
      const versionInfo = document.createElement("div");
      versionInfo.innerHTML = `
        <div>DB Version: 4</div>
        <div>Mode: Local IndexedDB</div>
      `;
      root.appendChild(versionInfo);

      const db = await State.openDB();

      // ===== EXPORT DATA =====
      const exportBtn = document.createElement("button");
      exportBtn.innerText = "Export JSON Backup";

      exportBtn.onclick = async function () {

        const stores = [
          "settings",
          "journalEntries",
          "calendarBlocks",
          "dayTemplates",
          "financeCategories",
          "financeTransactions",
          "gatekeeperItems",
          "vaultEntries",
          "vaultEntriesByDay"
        ];

        const backup = {};

        for (const storeName of stores) {

          if (!db.objectStoreNames.contains(storeName)) continue;

          backup[storeName] = await new Promise(resolve => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });

        }

        const blob = new Blob(
          [JSON.stringify(backup, null, 2)],
          { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "personal-os-backup.json";
        a.click();

        URL.revokeObjectURL(url);
      };

      root.appendChild(exportBtn);

      // ===== SOFT RESET (Only Settings + Today State) =====
      const softResetBtn = document.createElement("button");
      softResetBtn.innerText = "Soft Reset (Today Only)";

      softResetBtn.onclick = async function () {

        const confirm = window.confirm("Reset today state?");
        if (!confirm) return;

        const today = new Date().toISOString().split("T")[0];

        const tx = db.transaction(["settings", "journalEntries"], "readwrite");

        tx.objectStore("settings").put({
          id: "main",
          currentDayKey: today,
          dayStatus: "morning",
          morningCompletedAt: null,
          eveningStartedAt: null,
          dayClosedAt: null
        });

        tx.objectStore("journalEntries").delete(today);

        tx.oncomplete = () => {
          alert("Today reset complete.");
          Router.go("dashboard");
        };

      };

      root.appendChild(softResetBtn);

      // ===== HARD RESET =====
      const hardResetBtn = document.createElement("button");
      hardResetBtn.innerText = "Hard Reset (Delete ALL Data)";
      hardResetBtn.style.background = "red";
      hardResetBtn.style.color = "white";

      hardResetBtn.onclick = async function () {

        const confirm = window.confirm("This will DELETE ALL DATA. Continue?");
        if (!confirm) return;

        db.close();

        const deleteReq = indexedDB.deleteDatabase("personalOS");

        deleteReq.onsuccess = function () {
          alert("Database deleted.");
          location.reload();
        };

        deleteReq.onerror = function () {
          alert("Failed to delete database.");
        };

      };

      root.appendChild(hardResetBtn);

      // ===== CLEAR SERVICE WORKER CACHE =====
      const clearSWBtn = document.createElement("button");
      clearSWBtn.innerText = "Clear Service Worker Cache";

      clearSWBtn.onclick = async function () {

        if (!("caches" in window)) return;

        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }

        alert("SW cache cleared. Reloading.");
        location.reload();
      };

      root.appendChild(clearSWBtn);

      container.appendChild(root);

    } catch (e) {
      console.error("Maintenance mount error", e);
      container.innerHTML = "<div class='error'>Maintenance failed</div>";
    }

  }

});
