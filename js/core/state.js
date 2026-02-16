// js/core/state.js
// PERSONAL OS — IndexedDB + System State Machine + Data APIs
// Rules: no modules, defensive (no throws), iOS-safe transactions
//
// Updates in dieser Version (gegen deine letzte):
// 1) deleteFinanceCategory(id) ergänzt (für Finance UI)
// 2) deleteJournal(dateKey) ergänzt (für Maintenance Soft Reset sauber)
// 3) getVaultStoreName() public (damit Screens NICHT hardcoded "vaultEntries" nutzen müssen)
// 4) closeDay(): schreibt Snapshot in korrektes Vault-Store (fallback-safe) — unverändert, aber konsistent
//
// WICHTIG: Diese Datei ist vollständig (copy-paste).

const State = (function () {
  "use strict";

  const DB_NAME = "personalOS";
  const DB_VERSION = 5; // bump when schema changes

  let _db = null;
  let _openPromise = null;

  // Vault store resolver (handles legacy vault schema without data loss)
  let _vaultStoreName = "vaultEntries"; // preferred if keyPath dayKey
  const VAULT_FALLBACK = "vaultEntriesByDay";

  // -----------------------------
  // Helpers
  // -----------------------------

  function _now() { return Date.now(); }

  function getTodayKey() {
    return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  }

  function getMonthKey(dateKey) {
    return String(dateKey || getTodayKey()).slice(0, 7); // YYYY-MM
  }

  function timeToMinutes(str) {
    if (!str) return 0;
    const parts = String(str).split(":");
    const h = parseInt(parts[0] || "0", 10);
    const m = parseInt(parts[1] || "0", 10);
    return h * 60 + m;
  }

  function _reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IDB request failed"));
    });
  }

  function _txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error("IDB tx error"));
      tx.onabort = () => reject(tx.error || new Error("IDB tx abort"));
    });
  }

  function _safe(fn, fallback) {
    try { return fn(); } catch (_) { return fallback; }
  }

  function _getVaultStore() {
    try {
      if (_db && _db.objectStoreNames && _db.objectStoreNames.contains(VAULT_FALLBACK)) {
        return VAULT_FALLBACK;
      }
    } catch (_) {}
    return _vaultStoreName || "vaultEntries";
  }

  function getVaultStoreName() {
    return _getVaultStore();
  }

  function _createIfMissing(db, name, options) {
    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options);
  }

  // -----------------------------
  // Open / Upgrade
  // -----------------------------

  function openDB() {
    if (_db) return Promise.resolve(_db);
    if (_openPromise) return _openPromise;

    _openPromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        _openPromise = null;
        reject(e);
        return;
      }

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        const tx = event.target.transaction;

        // Explicit store schemas
        _createIfMissing(db, "settings", { keyPath: "id" });
        _createIfMissing(db, "journalEntries", { keyPath: "date" });

        _createIfMissing(db, "calendarBlocks", { keyPath: "id", autoIncrement: true });
        _createIfMissing(db, "dayTemplates", { keyPath: "id", autoIncrement: true });

        _createIfMissing(db, "financeCategories", { keyPath: "id", autoIncrement: true });
        _createIfMissing(db, "financeTransactions", { keyPath: "id", autoIncrement: true });

        _createIfMissing(db, "gatekeeperItems", { keyPath: "id", autoIncrement: true });

        // Vault preferred
        if (!db.objectStoreNames.contains("vaultEntries")) {
          db.createObjectStore("vaultEntries", { keyPath: "dayKey" });
        }

        // Indexes
        try {
          if (db.objectStoreNames.contains("calendarBlocks")) {
            const s = tx.objectStore("calendarBlocks");
            if (!s.indexNames.contains("date")) s.createIndex("date", "date", { unique: false });
          }
        } catch (_) {}

        try {
          if (db.objectStoreNames.contains("financeTransactions")) {
            const s = tx.objectStore("financeTransactions");
            if (!s.indexNames.contains("month")) s.createIndex("month", "month", { unique: false });
            if (!s.indexNames.contains("date")) s.createIndex("date", "date", { unique: false });
          }
        } catch (_) {}

        try {
          if (db.objectStoreNames.contains("gatekeeperItems")) {
            const s = tx.objectStore("gatekeeperItems");
            if (!s.indexNames.contains("status")) s.createIndex("status", "status", { unique: false });
            if (!s.indexNames.contains("unlockAt")) s.createIndex("unlockAt", "unlockAt", { unique: false });
            if (!s.indexNames.contains("createdAt")) s.createIndex("createdAt", "createdAt", { unique: false });
          }
        } catch (_) {}

        // ===== Robust Vault Migration (no deletion) =====
        try {
          if (db.objectStoreNames.contains("vaultEntries")) {
            const s = tx.objectStore("vaultEntries");
            const kp = s.keyPath;

            const isDayKey =
              kp === "dayKey" ||
              (Array.isArray(kp) && kp.length === 1 && kp[0] === "dayKey");

            if (!isDayKey) {
              if (!db.objectStoreNames.contains(VAULT_FALLBACK)) {
                db.createObjectStore(VAULT_FALLBACK, { keyPath: "dayKey" });
              }
              _vaultStoreName = VAULT_FALLBACK;
            } else {
              _vaultStoreName = "vaultEntries";
            }
          }
        } catch (_) {}
        // ===== END Migration =====
      };

      request.onsuccess = function (event) {
        _db = event.target.result;

        try {
          _db.onversionchange = function () {
            try { _db.close(); } catch (_) {}
            _db = null;
          };
        } catch (_) {}

        try {
          if (_db.objectStoreNames.contains(VAULT_FALLBACK)) _vaultStoreName = VAULT_FALLBACK;
          else _vaultStoreName = "vaultEntries";
        } catch (_) {
          _vaultStoreName = "vaultEntries";
        }

        resolve(_db);
      };

      request.onerror = function () {
        _db = null;
        _openPromise = null;
        reject(request.error || new Error("IndexedDB failed"));
      };
    });

    return _openPromise;
  }

  function _withStores(storeNames, mode, fn) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction(storeNames, mode);
        } catch (e) {
          reject(e);
          return;
        }

        const stores = {};
        (Array.isArray(storeNames) ? storeNames : [storeNames]).forEach((n) => {
          stores[n] = tx.objectStore(n);
        });

        let result;
        try {
          result = fn(stores, tx);
        } catch (e) {
          try { tx.abort(); } catch (_) {}
          reject(e);
          return;
        }

        Promise.resolve(result)
          .then(() => _txDone(tx))
          .then(() => resolve(result))
          .catch((e) => reject(e));
      });
    });
  }

  // -----------------------------
  // Settings + Day State Machine
  // -----------------------------

  function getSettings() {
    return _withStores("settings", "readonly", (s) => _reqToPromise(s.settings.get("main")))
      .then((res) => res || null)
      .catch(() => null);
  }

  function putSettings(settings) {
    return _withStores("settings", "readwrite", (s) => {
      s.settings.put(settings);
      return true;
    }).then(() => true).catch(() => false);
  }

  function _defaultSettings(todayKey) {
    return {
      id: "main",
      currentDayKey: todayKey,
      dayStatus: "morning", // morning | execution | evening | closed
      morningCompletedAt: null,
      eveningStartedAt: null,
      dayClosedAt: null,
      ui: {
        startScreen: "dashboard",
        startTab: "mindset",
        debug: false
      }
    };
  }

  async function ensureCoreSeed() {
    const today = getTodayKey();

    await _withStores(["settings", "financeCategories"], "readwrite", async (s) => {
      const existing = await _reqToPromise(s.settings.get("main")).catch(() => null);
      if (!existing) {
        s.settings.put(_defaultSettings(today));
      } else {
        let changed = false;

        if (!existing.ui) { existing.ui = { startScreen: "dashboard", startTab: "mindset", debug: false }; changed = true; }
        if (!existing.ui.startScreen) { existing.ui.startScreen = "dashboard"; changed = true; }
        if (typeof existing.ui.debug === "undefined") { existing.ui.debug = false; changed = true; }
        if (!existing.dayStatus) { existing.dayStatus = "morning"; changed = true; }
        if (!existing.currentDayKey) { existing.currentDayKey = today; changed = true; }

        if (changed) s.settings.put(existing);
      }

      const count = await _reqToPromise(s.financeCategories.count()).catch(() => 0);
      if (!count || count === 0) {
        const defaults = [
          { type: "income", name: "Salary", order: 1 },
          { type: "income", name: "Other", order: 2 },
          { type: "expense", name: "Rent", order: 1 },
          { type: "expense", name: "Food", order: 2 },
          { type: "expense", name: "Transport", order: 3 },
          { type: "expense", name: "Subscriptions", order: 4 },
          { type: "expense", name: "Leisure", order: 5 },
          { type: "expense", name: "Essentials", order: 6 }
        ];
        defaults.forEach((c) => s.financeCategories.add(c));
      }
      return true;
    }).catch(() => false);
  }

  async function ensureTodayState() {
    const today = getTodayKey();
    await ensureCoreSeed();

    const settings = await getSettings();
    if (!settings) {
      await putSettings(_defaultSettings(today));
      return true;
    }

    if (settings.currentDayKey !== today) {
      settings.currentDayKey = today;
      settings.dayStatus = "morning";
      settings.morningCompletedAt = null;
      settings.eveningStartedAt = null;
      settings.dayClosedAt = null;
      await putSettings(settings);
    }

    return true;
  }

  async function getDayStatus() {
    const s = await getSettings();
    return (s && s.dayStatus) ? s.dayStatus : "morning";
  }

  async function completeMorning() {
    const s = await getSettings();
    if (!s || s.dayStatus !== "morning") return false;
    s.dayStatus = "execution";
    s.morningCompletedAt = _now();
    return await putSettings(s);
  }

  async function startEvening() {
    const s = await getSettings();
    if (!s || s.dayStatus !== "execution") return false;
    s.dayStatus = "evening";
    s.eveningStartedAt = _now();
    return await putSettings(s);
  }

  // -----------------------------
  // Journal
  // -----------------------------

  function ensureJournalShape(entry, dateKey) {
    if (entry) return entry;
    return {
      date: dateKey,
      morning: { lookingForward: "", planning: "", todos: [] },
      evening: { reflection: "", rating: "", gratitude: "" }
    };
  }

  function getJournal(dateKey) {
    const key = dateKey || getTodayKey();
    return _withStores("journalEntries", "readonly", (s) => _reqToPromise(s.journalEntries.get(key)))
      .then((res) => res || null)
      .catch(() => null);
  }

  function putJournal(entry) {
    if (!entry || !entry.date) return Promise.resolve(false);
    return _withStores("journalEntries", "readwrite", (s) => {
      s.journalEntries.put(entry);
      return true;
    }).then(() => true).catch(() => false);
  }

  function deleteJournal(dateKey) {
    const key = dateKey || getTodayKey();
    return _withStores("journalEntries", "readwrite", (s) => {
      s.journalEntries.delete(key);
      return true;
    }).then(() => true).catch(() => false);
  }

  // -----------------------------
  // Calendar Blocks
  // -----------------------------

  function listBlocks(dateKey) {
    const key = dateKey || getTodayKey();
    return _withStores("calendarBlocks", "readonly", async (s) => {
      try {
        if (s.calendarBlocks.indexNames.contains("date")) {
          const idx = s.calendarBlocks.index("date");
          const rows = await _reqToPromise(idx.getAll(key)).catch(() => []);
          (rows || []).sort((a, b) => timeToMinutes(a && a.start) - timeToMinutes(b && b.start));
          return rows || [];
        }
      } catch (_) {}
      const all = await _reqToPromise(s.calendarBlocks.getAll()).catch(() => []);
      const rows2 = (all || []).filter((b) => b && b.date === key);
      rows2.sort((a, b) => timeToMinutes(a && a.start) - timeToMinutes(b && b.start));
      return rows2;
    }).catch(() => []);
  }

  function addBlock(block) {
    if (!block || !block.date || !block.start || !block.end || !block.title) return Promise.resolve(null);
    return _withStores("calendarBlocks", "readwrite", (s) => _reqToPromise(s.calendarBlocks.add(block)))
      .then((id) => id)
      .catch(() => null);
  }

  function deleteBlock(id) {
    if (id == null) return Promise.resolve(false);
    return _withStores("calendarBlocks", "readwrite", (s) => {
      s.calendarBlocks.delete(id);
      return true;
    }).then(() => true).catch(() => false);
  }

  // -----------------------------
  // Templates (Day Profiles)
  // -----------------------------

  function listTemplates() {
    return _withStores("dayTemplates", "readonly", async (s) => {
      const all = await _reqToPromise(s.dayTemplates.getAll()).catch(() => []);
      (all || []).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return all || [];
    }).catch(() => []);
  }

  function addTemplate(tpl) {
    if (!tpl || !tpl.name || !Array.isArray(tpl.blocks)) return Promise.resolve(null);
    return _withStores("dayTemplates", "readwrite", (s) => _reqToPromise(s.dayTemplates.add(tpl)))
      .then((id) => id)
      .catch(() => null);
  }

  function deleteTemplate(id) {
    if (id == null) return Promise.resolve(false);
    return _withStores("dayTemplates", "readwrite", (s) => {
      s.dayTemplates.delete(id);
      return true;
    }).then(() => true).catch(() => false);
  }

  function applyTemplateToDate(templateObj, dateKey) {
    const key = dateKey || getTodayKey();
    if (!templateObj || !Array.isArray(templateObj.blocks)) return Promise.resolve(false);

    return _withStores("calendarBlocks", "readwrite", async (s) => {
      for (let i = 0; i < templateObj.blocks.length; i++) {
        const b = templateObj.blocks[i];
        if (!b || !b.start || !b.end || !b.title) continue;
        s.calendarBlocks.add({ date: key, start: b.start, end: b.end, title: b.title });
      }
      return true;
    }).then(() => true).catch(() => false);
  }

  // -----------------------------
  // Finance
  // -----------------------------

  function listFinanceCategories() {
    return _withStores("financeCategories", "readonly", async (s) => {
      const all = await _reqToPromise(s.financeCategories.getAll()).catch(() => []);
      (all || []).sort((a, b) => {
        const ta = String(a.type || "");
        const tb = String(b.type || "");
        if (ta === tb) return (a.order || 999) - (b.order || 999);
        return ta.localeCompare(tb);
      });
      return all || [];
    }).catch(() => []);
  }

  function addFinanceCategory(cat) {
    if (!cat || !cat.type || !cat.name) return Promise.resolve(null);
    return _withStores("financeCategories", "readwrite", (s) => _reqToPromise(s.financeCategories.add(cat)))
      .then((id) => id)
      .catch(() => null);
  }

  function deleteFinanceCategory(id) {
    if (id == null) return Promise.resolve(false);
    return _withStores("financeCategories", "readwrite", (s) => {
      s.financeCategories.delete(Number(id));
      return true;
    }).then(() => true).catch(() => false);
  }

  function addTransaction(txn) {
    if (!txn || !txn.date || !txn.type || txn.amount == null) return Promise.resolve(null);
    const normalized = Object.assign({}, txn);
    normalized.amount = Number(normalized.amount || 0);
    normalized.month = normalized.month || getMonthKey(normalized.date);

    return _withStores("financeTransactions", "readwrite", (s) => _reqToPromise(s.financeTransactions.add(normalized)))
      .then((id) => id)
      .catch(() => null);
  }

  function listTransactions(monthKey) {
    const m = monthKey || getMonthKey(getTodayKey());
    return _withStores("financeTransactions", "readonly", async (s) => {
      try {
        if (s.financeTransactions.indexNames.contains("month")) {
          const idx = s.financeTransactions.index("month");
          const rows = await _reqToPromise(idx.getAll(m)).catch(() => []);
          (rows || []).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
          return rows || [];
        }
      } catch (_) {}
      const all = await _reqToPromise(s.financeTransactions.getAll()).catch(() => []);
      const rows2 = (all || []).filter((t) => t && t.month === m);
      rows2.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      return rows2;
    }).catch(() => []);
  }

  async function getMonthlySummary(monthKey) {
    const txns = await listTransactions(monthKey);
    let income = 0;
    let expense = 0;
    for (let i = 0; i < txns.length; i++) {
      const t = txns[i];
      const amt = Number((t && t.amount) || 0);
      if (t && t.type === "income") income += amt;
      if (t && t.type === "expense") expense += amt;
    }
    const remaining = income - expense;
    const remainingPct = income > 0 ? Math.max(0, Math.round((remaining / income) * 100)) : 0;
    const spentPct = income > 0 ? Math.min(100, Math.max(0, Math.round((expense / income) * 100))) : 0;
    return { income, expense, remaining, remainingPct, spentPct, month: monthKey || getMonthKey(getTodayKey()) };
  }

  // -----------------------------
  // Gatekeeper
  // -----------------------------

  function addGatekeeperItem(item) {
    if (!item || !item.name || item.price == null || !item.categoryId) return Promise.resolve(null);

    const createdAt = item.createdAt || _now();
    const unlockAt = item.unlockAt || (createdAt + 72 * 60 * 60 * 1000);

    const normalized = Object.assign({}, item, {
      createdAt,
      unlockAt,
      price: Number(item.price || 0),
      status: item.status || "locked",
      purchasedAt: item.purchasedAt || null,
      source: "gatekeeper"
    });

    return _withStores("gatekeeperItems", "readwrite", (s) => _reqToPromise(s.gatekeeperItems.add(normalized)))
      .then((id) => id)
      .catch(() => null);
  }

  function listGatekeeper() {
    return _withStores("gatekeeperItems", "readonly", async (s) => {
      try {
        if (s.gatekeeperItems.indexNames.contains("createdAt")) {
          const idx = s.gatekeeperItems.index("createdAt");
          const all = await _reqToPromise(idx.getAll()).catch(() => null);
          if (Array.isArray(all)) {
            all.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
            return all;
          }
        }
      } catch (_) {}
      const all2 = await _reqToPromise(s.gatekeeperItems.getAll()).catch(() => []);
      (all2 || []).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      return all2 || [];
    }).catch(() => []);
  }

  function updateGatekeeperItem(item) {
    if (!item || item.id == null) return Promise.resolve(false);
    const normalized = Object.assign({}, item);
    normalized.price = Number(normalized.price || 0);

    return _withStores("gatekeeperItems", "readwrite", (s) => {
      s.gatekeeperItems.put(normalized);
      return true;
    }).then(() => true).catch(() => false);
  }

  async function getGatekeeperCounts() {
    const items = await listGatekeeper();
    let locked = 0, eligible = 0, purchased = 0;
    const now = _now();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const st = String(it.status || "");
      if (st === "purchased") { purchased++; continue; }
      if (now >= Number(it.unlockAt || 0)) eligible++;
      else locked++;
    }
    return { locked, eligible, purchased, total: items.length };
  }

  // -----------------------------
  // Vault (Snapshots)
  // -----------------------------

  function getVaultSnapshot(dayKey) {
    const key = dayKey || getTodayKey();
    const storeName = _getVaultStore();
    return _withStores(storeName, "readonly", (s) => _reqToPromise(s[storeName].get(key)))
      .then((res) => res || null)
      .catch(() => null);
  }

  function listVault() {
    const storeName = _getVaultStore();
    return _withStores(storeName, "readonly", async (s) => {
      const all = await _reqToPromise(s[storeName].getAll()).catch(() => []);
      (all || []).sort((a, b) => String(b.dayKey || "").localeCompare(String(a.dayKey || "")));
      return all || [];
    }).catch(() => []);
  }

  async function closeDay() {
    const settings = await getSettings();
    if (!settings || settings.dayStatus !== "evening") return false;

    const dayKey = settings.currentDayKey || getTodayKey();
    const monthKey = getMonthKey(dayKey);

    const jRaw = await getJournal(dayKey);
    const journal = ensureJournalShape(jRaw, dayKey);

    const todos = (journal.morning && Array.isArray(journal.morning.todos)) ? journal.morning.todos : [];
    const total = todos.length;
    const done = todos.filter((t) => !!t.done).length;
    const performanceScore = total === 0 ? 0 : Math.round((done / total) * 100);

    const blocks = await listBlocks(dayKey);
    const summary = await getMonthlySummary(monthKey);

    const snapshot = {
      dayKey,
      closedAt: _now(),
      performanceScore,
      todos: { total, done },
      blocksSummary: (blocks || []).map((b) => ({
        start: b && b.start,
        end: b && b.end,
        title: b && b.title
      })),
      morningSummary: {
        lookingForward: _safe(() => journal.morning.lookingForward, "") || "",
        planning: _safe(() => journal.morning.planning, "") || ""
      },
      eveningSummary: {
        reflection: _safe(() => journal.evening.reflection, "") || "",
        rating: _safe(() => journal.evening.rating, "") || "",
        gratitude: _safe(() => journal.evening.gratitude, "") || ""
      },
      finance: {
        income: Number(summary.income || 0),
        expense: Number(summary.expense || 0),
        remaining: Number(summary.remaining || 0),
        month: summary.month
      }
    };

    const storeName = _getVaultStore();
    const okSnap = await _withStores(storeName, "readwrite", (s) => {
      s[storeName].put(snapshot);
      return true;
    }).then(() => true).catch(() => false);

    if (!okSnap) return false;

    settings.dayStatus = "closed";
    settings.dayClosedAt = _now();
    const okSet = await putSettings(settings);
    return !!okSet;
  }

  // -----------------------------
  // Export / Import / Reset (Maintenance)
  // -----------------------------

  async function exportAll() {
    try {
      await openDB();
      const names = [];
      for (let i = 0; i < _db.objectStoreNames.length; i++) names.push(_db.objectStoreNames[i]);

      const out = { meta: { exportedAt: _now(), dbName: DB_NAME, dbVersion: DB_VERSION }, stores: {} };

      for (let i = 0; i < names.length; i++) {
        const storeName = names[i];
        const rows = await _withStores(storeName, "readonly", (s) => _reqToPromise(s[storeName].getAll()))
          .catch(() => []);
        out.stores[storeName] = rows || [];
      }

      return out;
    } catch (_) {
      return null;
    }
  }

  async function importAll(payload) {
    try {
      if (!payload || !payload.stores) return false;
      await openDB();

      const storeNames = Object.keys(payload.stores);
      for (let i = 0; i < storeNames.length; i++) {
        const name = storeNames[i];
        if (!_db.objectStoreNames.contains(name)) continue;

        const rows = payload.stores[name];
        if (!Array.isArray(rows)) continue;

        await _withStores(name, "readwrite", (s) => {
          for (let r = 0; r < rows.length; r++) {
            s[name].put(rows[r]);
          }
          return true;
        }).catch(() => false);
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  async function resetDB() {
    try {
      if (_db) {
        try { _db.close(); } catch (_) {}
        _db = null;
      }
      _openPromise = null;

      const ok = await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
        req.onblocked = () => resolve(false);
      });

      return !!ok;
    } catch (_) {
      return false;
    }
  }

  // -----------------------------
  // Public API
  // -----------------------------

  return {
    // core
    openDB,
    ensureCoreSeed,
    ensureTodayState,

    // settings/day state
    getSettings,
    putSettings,
    getDayStatus,
    completeMorning,
    startEvening,
    closeDay,

    // helpers exposed (needed by screens)
    getTodayKey,
    getMonthKey,
    timeToMinutes,

    // journal
    ensureJournalShape,
    getJournal,
    putJournal,
    deleteJournal,

    // blocks
    listBlocks,
    addBlock,
    deleteBlock,

    // templates
    listTemplates,
    addTemplate,
    deleteTemplate,
    applyTemplateToDate,

    // finance
    listFinanceCategories,
    addFinanceCategory,
    deleteFinanceCategory,
    addTransaction,
    listTransactions,
    getMonthlySummary,

    // gatekeeper
    addGatekeeperItem,
    listGatekeeper,
    updateGatekeeperItem,
    getGatekeeperCounts,

    // vault
    getVaultStoreName,
    getVaultSnapshot,
    listVault,

    // maintenance tools
    exportAll,
    importAll,
    resetDB
  };

})();
