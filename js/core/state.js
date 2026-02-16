// js/core/state.js

const State = (function () {

  const DB_NAME = "personalOS";
  const DB_VERSION = 4;

  let db = null;
  let vaultStoreName = "vaultEntries";

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        const database = event.target.result;

        function createIfMissing(name, options) {
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name, options);
          }
        }

        // Core stores (explicit schemas)
        createIfMissing("settings", { keyPath: "id" });
        createIfMissing("journalEntries", { keyPath: "date" });
        createIfMissing("calendarBlocks", { keyPath: "id", autoIncrement: true });
        createIfMissing("dayTemplates", { keyPath: "id", autoIncrement: true });
        createIfMissing("financeCategories", { keyPath: "id", autoIncrement: true });
        createIfMissing("financeTransactions", { keyPath: "id", autoIncrement: true });
        createIfMissing("gatekeeperItems", { keyPath: "id", autoIncrement: true });

        // Vault default (preferred)
        if (!database.objectStoreNames.contains("vaultEntries")) {
          database.createObjectStore("vaultEntries", { keyPath: "dayKey" });
        }

        const tx = event.target.transaction;

        // Indexes
        if (database.objectStoreNames.contains("financeTransactions")) {
          const store = tx.objectStore("financeTransactions");
          if (!store.indexNames.contains("month")) store.createIndex("month", "month", { unique: false });
          if (!store.indexNames.contains("date")) store.createIndex("date", "date", { unique: false });
        }

        if (database.objectStoreNames.contains("calendarBlocks")) {
          const store = tx.objectStore("calendarBlocks");
          if (!store.indexNames.contains("date")) store.createIndex("date", "date", { unique: false });
        }

        // ===== Robust Vault Migration =====
        // If an existing vaultEntries store is legacy (non-dayKey keyPath), create vaultEntriesByDay
        // and use it for new snapshots. No deletion, no data loss (legacy snapshots stay where they are).
        if (database.objectStoreNames.contains("vaultEntries")) {
          const store = tx.objectStore("vaultEntries");
          const kp = store.keyPath;

          const isDayKey =
            kp === "dayKey" ||
            (Array.isArray(kp) && kp.length === 1 && kp[0] === "dayKey");

          if (!isDayKey) {
            if (!database.objectStoreNames.contains("vaultEntriesByDay")) {
              database.createObjectStore("vaultEntriesByDay", { keyPath: "dayKey" });
            }
            vaultStoreName = "vaultEntriesByDay";
          }
        }
        // ===== END Migration =====
      };

      request.onsuccess = function (event) {
        db = event.target.result;

        // If migration created/exists the new store, use it
        if (db.objectStoreNames.contains("vaultEntriesByDay")) {
          vaultStoreName = "vaultEntriesByDay";
        } else {
          vaultStoreName = "vaultEntries";
        }

        resolve(db);
      };

      request.onerror = function () {
        reject("IndexedDB failed");
      };
    });
  }

  function getTodayKey() {
    return new Date().toISOString().split("T")[0];
  }

  function getMonthKey(date) {
    return String(date || "").slice(0, 7);
  }

  function timeToMinutes(str) {
    if (!str) return 0;
    const parts = String(str).split(":");
    const h = parseInt(parts[0] || "0", 10);
    const m = parseInt(parts[1] || "0", 10);
    return h * 60 + m;
  }

  function getSettings() {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction("settings", "readonly");
        const req = tx.objectStore("settings").get("main");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function putSettings(settings) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put(settings);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(false);
        tx.onabort = () => reject(false);
      } catch (e) {
        reject(false);
      }
    });
  }

  async function ensureTodayState() {
    const today = getTodayKey();
    let settings = await getSettings();

    if (!settings) {
      settings = {
        id: "main",
        currentDayKey: today,
        dayStatus: "morning",
        morningCompletedAt: null,
        eveningStartedAt: null,
        dayClosedAt: null
      };
      await putSettings(settings);
      return;
    }

    if (settings.currentDayKey !== today) {
      settings.currentDayKey = today;
      settings.dayStatus = "morning";
      settings.morningCompletedAt = null;
      settings.eveningStartedAt = null;
      settings.dayClosedAt = null;
      await putSettings(settings);
    }
  }

  async function getDayStatus() {
    const s = await getSettings();
    if (!s) return "morning";
    return s.dayStatus || "morning";
  }

  async function completeMorning() {
    const s = await getSettings();
    if (!s || s.dayStatus !== "morning") return false;

    s.dayStatus = "execution";
    s.morningCompletedAt = Date.now();
    await putSettings(s);
    return true;
  }

  async function startEvening() {
    const s = await getSettings();
    if (!s || s.dayStatus !== "execution") return false;

    s.dayStatus = "evening";
    s.eveningStartedAt = Date.now();
    await putSettings(s);
    return true;
  }

  async function closeDay() {
    const s = await getSettings();
    if (!s || s.dayStatus !== "evening") return false;

    const today = s.currentDayKey;
    const monthKey = getMonthKey(today);

    const journal = await new Promise((resolve) => {
      try {
        const tx = db.transaction("journalEntries", "readonly");
        const req = tx.objectStore("journalEntries").get(today);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });

    let total = 0;
    let done = 0;

    if (journal && journal.morning && Array.isArray(journal.morning.todos)) {
      total = journal.morning.todos.length;
      done = journal.morning.todos.filter((t) => !!t.done).length;
    }

    const performance = total === 0 ? 0 : Math.round((done / total) * 100);

    const blocks = await new Promise((resolve) => {
      try {
        const tx = db.transaction("calendarBlocks", "readonly");
        const store = tx.objectStore("calendarBlocks");
        if (store.indexNames && store.indexNames.contains("date")) {
          const index = store.index("date");
          const req = index.getAll(today);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } else {
          const req = store.getAll();
          req.onsuccess = () => resolve((req.result || []).filter((b) => b && b.date === today));
          req.onerror = () => resolve([]);
        }
      } catch (e) {
        resolve([]);
      }
    });

    blocks.sort((a, b) => timeToMinutes(a && a.start) - timeToMinutes(b && b.start));

    const transactions = await new Promise((resolve) => {
      try {
        const tx = db.transaction("financeTransactions", "readonly");
        const store = tx.objectStore("financeTransactions");

        if (store.indexNames && store.indexNames.contains("month")) {
          const index = store.index("month");
          const req = index.getAll(monthKey);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } else {
          const req = store.getAll();
          req.onsuccess = () => resolve((req.result || []).filter((t) => (t && t.month) === monthKey));
          req.onerror = () => resolve([]);
        }
      } catch (e) {
        resolve([]);
      }
    });

    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      const amt = Number((t && t.amount) || 0);
      if (t && t.type === "income") income += amt;
      if (t && t.type === "expense") expense += amt;
    });

    const remaining = income - expense;

    const snapshot = {
      dayKey: today,
      closedAt: Date.now(),
      performanceScore: performance,
      todos: { total: total, done: done },
      blocksSummary: (blocks || []).map((b) => ({
        start: b && b.start,
        end: b && b.end,
        title: b && b.title
      })),
      morningSummary: {
        lookingForward: (journal && journal.morning && journal.morning.lookingForward) ? journal.morning.lookingForward : "",
        planning: (journal && journal.morning && journal.morning.planning) ? journal.morning.planning : ""
      },
      eveningSummary: {
        reflection: (journal && journal.evening && journal.evening.reflection) ? journal.evening.reflection : "",
        rating: (journal && journal.evening && journal.evening.rating) ? journal.evening.rating : "",
        gratitude: (journal && journal.evening && journal.evening.gratitude) ? journal.evening.gratitude : ""
      },
      finance: { income: income, expense: expense, remaining: remaining }
    };

    await new Promise((resolve, reject) => {
      try {
        const storeName = (db.objectStoreNames.contains("vaultEntriesByDay")) ? "vaultEntriesByDay" : vaultStoreName;
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(snapshot);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(false);
        tx.onabort = () => reject(false);
      } catch (e) {
        reject(false);
      }
    });

    s.dayStatus = "closed";
    s.dayClosedAt = Date.now();
    await putSettings(s);

    return true;
  }

  return {
    openDB,
    ensureTodayState,
    getDayStatus,
    completeMorning,
    startEvening,
    closeDay
  };

})();
