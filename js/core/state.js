(function () {
  const DB_NAME = "personalOS";
  const DB_VERSION = 2;

  function promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = req.result;

        function ensure(name, opts) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts);
        }

        ensure("settings", { keyPath: "id" });
        ensure("journalEntries", { keyPath: "date" });
        ensure("calendarBlocks", { keyPath: "id", autoIncrement: true });
        ensure("dayTemplates", { keyPath: "id", autoIncrement: true });
        ensure("financeCategories", { keyPath: "id", autoIncrement: true });
        ensure("financeTransactions", { keyPath: "id", autoIncrement: true });
        ensure("gatekeeperItems", { keyPath: "id", autoIncrement: true });
        ensure("vaultEntries", { keyPath: "id", autoIncrement: true });

        // Seed defaults after upgrade completes
        e.target.transaction.oncomplete = () => {
          try {
            const tx = db.transaction(["settings", "financeCategories"], "readwrite");
            const settings = tx.objectStore("settings");
            const cats = tx.objectStore("financeCategories");

            const sReq = settings.get("main");
            sReq.onsuccess = () => {
              if (!sReq.result) {
                settings.put({
                  id: "main",
                  ui: { startScreen: "dashboard", startTab: "mindset" },
                  finance: { monthIncome: 0 }
                });
              } else {
                // Ensure required keys exist
                const s = sReq.result;
                s.ui = s.ui || {};
                if (!s.ui.startScreen) s.ui.startScreen = "dashboard";
                settings.put(s);
              }
            };

            const cReq = cats.count();
            cReq.onsuccess = () => {
              if (cReq.result === 0) {
                [
                  { type: "income", name: "Salary", order: 1 },
                  { type: "income", name: "Other", order: 2 },
                  { type: "expense", name: "Rent", order: 1 },
                  { type: "expense", name: "Food", order: 2 },
                  { type: "expense", name: "Transport", order: 3 },
                  { type: "expense", name: "Subscriptions", order: 4 },
                  { type: "expense", name: "Leisure", order: 5 },
                  { type: "expense", name: "Essentials", order: 6 }
                ].forEach((c) => cats.add(c));
              }
            };
          } catch (_) {
            // swallow; never kill upgrade
          }
        };
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(storeNames, mode, fn) {
    const db = await openDB();
    const tx = db.transaction(storeNames, mode);

    const stores = Array.isArray(storeNames)
      ? storeNames.map((n) => tx.objectStore(n))
      : [tx.objectStore(storeNames)];

    const result = await fn.apply(null, stores);

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    db.close();
    return result;
  }

  const api = {
    // Settings
    async getSettings() {
      return withStore("settings", "readonly", (s) => promisify(s.get("main")));
    },
    async putSettings(settings) {
      return withStore("settings", "readwrite", (s) => promisify(s.put(settings)));
    },

    // Journal
    async getJournal(date) {
      return withStore("journalEntries", "readonly", (s) => promisify(s.get(date)));
    },
    async putJournal(entry) {
      return withStore("journalEntries", "readwrite", (s) => promisify(s.put(entry)));
    },

    // Calendar blocks
    async listBlocks(date) {
      return withStore("calendarBlocks", "readonly", async (s) => {
        const all = await promisify(s.getAll());
        return all.filter((b) => b.date === date).sort((a, b) => (a.start < b.start ? -1 : 1));
      });
    },
    async addBlock(block) {
      return withStore("calendarBlocks", "readwrite", (s) => promisify(s.add(block)));
    },
    async deleteBlock(id) {
      return withStore("calendarBlocks", "readwrite", (s) => promisify(s.delete(id)));
    },

    // Templates
    async listTemplates() {
      return withStore("dayTemplates", "readonly", async (s) => {
        const all = await promisify(s.getAll());
        all.sort((a, b) => (a.name > b.name ? 1 : -1));
        return all;
      });
    },
    async addTemplate(t) {
      return withStore("dayTemplates", "readwrite", (s) => promisify(s.add(t)));
    },
    async deleteTemplate(id) {
      return withStore("dayTemplates", "readwrite", (s) => promisify(s.delete(id)));
    },
    async applyTemplateToDate(template, date) {
      return withStore("calendarBlocks", "readwrite", async (s) => {
        const blocks = Array.isArray(template.blocks) ? template.blocks : [];
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          await promisify(s.add({ date, start: b.start, end: b.end, title: b.title }));
        }
        return true;
      });
    },

    // Finance
    async listFinanceCategories() {
      return withStore("financeCategories", "readonly", async (s) => {
        const all = await promisify(s.getAll());
        all.sort((a, b) => {
          if (a.type === b.type) return (a.order ?? 999) - (b.order ?? 999);
          return a.type.localeCompare(b.type);
        });
        return all;
      });
    },
    async addFinanceCategory(cat) {
      return withStore("financeCategories", "readwrite", (s) => promisify(s.add(cat)));
    },

    async listTransactions(month) {
      return withStore("financeTransactions", "readonly", async (s) => {
        const all = await promisify(s.getAll());
        return all.filter((t) => t.month === month).sort((a, b) => (a.date < b.date ? 1 : -1));
      });
    },
    async addTransaction(txn) {
      return withStore("financeTransactions", "readwrite", (s) => promisify(s.add(txn)));
    },

    // Gatekeeper
    async listGatekeeper() {
      return withStore("gatekeeperItems", "readonly", async (s) => {
        const all = await promisify(s.getAll());
        all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return all;
      });
    },
    async addGatekeeperItem(item) {
      return withStore("gatekeeperItems", "readwrite", (s) => promisify(s.add(item)));
    },
    async updateGatekeeperItem(item) {
      return withStore("gatekeeperItems", "readwrite", (s) => promisify(s.put(item)));
    },

    // Vault
    async listVault() {
      return withStore("vaultEntries", "readonly", async (s) => {
        const all = await promisify(s.getAll());
        all.sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));
        return all;
      });
    },
    async addVault(entry) {
      return withStore("vaultEntries", "readwrite", (s) => promisify(s.add(entry)));
    }
  };

  window.POS = window.POS || {};
  window.POS.state = api;
})();
