// js/core/state.js
// PERSONAL OS — IndexedDB + System State Machine + Data APIs (SYSTEMIC / BULLETPROOF)
// Constraints:
// - No ES modules (no import/export)
// - IndexedDB is source of truth
// - Defensive: public APIs should not throw (return null/false/[] on failure)
// - iOS-safe transactions (short-lived, avoid leaking db handles)
// - Supports GH Pages / offline usage (no network assumptions)

const State = (function () {
  "use strict";

  // =========================
  // Meta / Versioning
  // =========================
  const DB_NAME = "personalOS";
  const DB_VERSION = 6; // bump: we are systemically stabilizing + adding missing APIs

  // Optional runtime meta (can be surfaced in Maintenance later)
  const META = {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    buildId: "2026-02-16-state-001"
  };

  let _db = null;
  let _openPromise = null;

  // Vault store resolver (handles legacy vault schema without data loss)
  let _vaultStoreName = "vaultEntries"; // preferred if keyPath dayKey
  const VAULT_FALLBACK = "vaultEntriesByDay";

  // =========================
  // Helpers
  // =========================
  function _now() { return Date.now(); }

  function _safe(fn, fallback) {
    try { return fn(); } catch (_) { return fallback; }
  }

  function _isObj(x) {
    return !!x && typeof x === "object";
  }

  function getTodayKey() {
    // YYYY-MM-DD
    return new Date().toISOString().split("T")[0];
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

  function _createIfMissing(db, name, options) {
    try {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options);
    } catch (_) {}
  }

  function _ensureIndex(tx, storeName, indexName, keyPath, opts) {
    try {
      const s = tx.objectStore(storeName);
      if (!s.indexNames.contains(indexName)) s.createIndex(indexName, keyPath, opts || { unique: false });
    } catch (_) {}
  }

  function _getVaultStore() {
    // Prefer fallback if it exists, otherwise preferred name
    try {
      if (_db && _db.objectStoreNames && _db.objectStoreNames.contains(VAULT_FALLBACK)) return VAULT_FALLBACK;
    } catch (_) {}
    return _vaultStoreName || "vaultEntries";
  }

  function _normalizeDayStatus(x) {
    const v = String(x || "").toLowerCase();
    if (v === "morning" || v === "execution" || v === "evening" || v === "closed") return v;
    return "morning";
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
        debugEnabled: false
      }
    };
  }

  // =========================
  // Open / Upgrade
  // =========================
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

        // Core stores
        _createIfMissing(db, "settings", { keyPath: "id" });
        _createIfMissing(db, "journalEntries", { keyPath: "date" });

        _createIfMissing(db, "calendarBlocks", { keyPath: "id", autoIncrement: true });
        _createIfMissing(db, "dayTemplates", { keyPath: "id", autoIncrement: true });

        _createIfMissing(db, "financeCategories", { keyPath: "id", autoIncrement: true });
        _createIfMissing(db, "financeTransactions", { keyPath: "id", autoIncrement: true });

        _createIfMissing(db, "gatekeeperItems", { keyPath: "id", autoIncrement: true });

        // Vault (preferred)
        try {
          if (!db.objectStoreNames.contains("vaultEntries")) {
            db.createObjectStore("vaultEntries", { keyPath: "dayKey" });
          }
        } catch (_) {}

        // Indexes (defensive, idempotent)
        _ensureIndex(tx, "calendarBlocks", "date", "date", { unique: false });
        _ensureIndex(tx, "financeTransactions", "month", "month", { unique: false });
        _ensureIndex(tx, "financeTransactions", "date", "date", { unique: false });

        _ensureIndex(tx, "gatekeeperItems", "status", "status", { unique: false });
        _ensureIndex(tx, "gatekeeperItems", "unlockAt", "unlockAt", { unique: false });
        _ensureIndex(tx, "gatekeeperItems", "createdAt", "createdAt", { unique: false });

        // ===== Robust Vault Migration (no deletion) =====
        // If existing vaultEntries store is legacy (non-dayKey keyPath), create VAULT_FALLBACK
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

        // Versionchange safety
        try {
          _db.onversionchange = function () {
            try { _db.close(); } catch (_) {}
            _db = null;
          };
        } catch (_) {}

        // Prefer fallback vault store if exists
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

  // =========================
  // Settings + Day State Machine
  // =========================
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

  async function ensureCoreSeed() {
    // Seed settings + default finance categories once
    const today = getTodayKey();

    return _withStores(["settings", "financeCategories"], "readwrite", async (s) => {
      // Settings
      const existing = await _reqToPromise(s.settings.get("main")).catch(() => null);

      if (!existing) {
        s.settings.put(_defaultSettings(today));
      } else {
        let changed = false;

        if (!existing.ui) { existing.ui = { startScreen: "dashboard", startTab: "mindset", debugEnabled: false }; changed = true; }
        if (!existing.ui.startScreen) { existing.ui.startScreen = "dashboard"; changed = true; }
        if (!("debugEnabled" in existing.ui)) { existing.ui.debugEnabled = false; changed = true; }

        if (!existing.dayStatus) { existing.dayStatus = "morning"; changed = true; }
        existing.dayStatus = _normalizeDayStatus(existing.dayStatus);

        if (!existing.currentDayKey) { existing.currentDayKey = today; changed = true; }

        if (changed) s.settings.put(existing);
      }

      // Finance default categories
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
    }).then(() => true).catch(() => false);
  }

  async function ensureTodayState() {
    const today = getTodayKey();
    await ensureCoreSeed();

    const settings = await getSettings();
    if (!settings) {
      await putSettings(_defaultSettings(today));
      return true;
    }

    // New day => reset to morning
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
    return (s && s.dayStatus) ? _normalizeDayStatus(s.dayStatus) : "morning";
  }

  function canEditMorning(status) {
    return _normalizeDayStatus(status) === "morning";
  }

  function canCheckTodos(status) {
    return _normalizeDayStatus(status) === "execution";
  }

  function canEditEvening(status) {
    return _normalizeDayStatus(status) === "evening";
  }

  function isReadOnly(status) {
    const st = _normalizeDayStatus(status);
    return st === "closed";
  }

  async function completeMorning() {
    const s = await getSettings();
    if (!s || _normalizeDayStatus(s.dayStatus) !== "morning") return false;
    s.dayStatus = "execution";
    s.morningCompletedAt = _now();
    return await putSettings(s);
  }

  async function startEvening() {
    const s = await getSettings();
    if (!s || _normalizeDayStatus(s.dayStatus) !== "execution") return false;
    s.dayStatus = "evening";
    s.eveningStartedAt = _now();
    return await putSettings(s);
  }

  // =========================
  // Journal
  // =========================
  function ensureJournalShape(entry, dateKey) {
    if (entry && entry.date) return entry;
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

  function getJournalOrDefault(dateKey) {
    const key = dateKey || getTodayKey();
    return getJournal(key).then((res) => ensureJournalShape(res, key)).catch(() => ensureJournalShape(null, key));
  }

  function putJournal(entry) {
    // Legacy API (kept for compatibility). New screens should use saveMorningJournal/saveEveningJournal/toggleTodo.
    if (!entry || !entry.date) return Promise.resolve(false);
    return _withStores("journalEntries", "readwrite", (s) => {
      s.journalEntries.put(entry);
      return true;
    }).then(() => true).catch(() => false);
  }

  async function saveMorningJournal(fields) {
    // Enforced: only in morning
    const status = await getDayStatus();
    if (!canEditMorning(status)) return { ok: false, reason: "status" };

    const dayKey = getTodayKey();
    const entry = await getJournalOrDefault(dayKey);

    entry.morning = entry.morning || { lookingForward: "", planning: "", todos: [] };
    if (_isObj(fields)) {
      if ("lookingForward" in fields) entry.morning.lookingForward = String(fields.lookingForward || "");
      if ("planning" in fields) entry.morning.planning = String(fields.planning || "");
      if ("todos" in fields && Array.isArray(fields.todos)) entry.morning.todos = fields.todos;
    }

    const ok = await putJournal(entry);
    return { ok: !!ok };
  }

  async function saveEveningJournal(fields) {
    // Enforced: only in evening
    const status = await getDayStatus();
    if (!canEditEvening(status)) return { ok: false, reason: "status" };

    const dayKey = getTodayKey();
    const entry = await getJournalOrDefault(dayKey);

    entry.evening = entry.evening || { reflection: "", rating: "", gratitude: "" };
    if (_isObj(fields)) {
      if ("reflection" in fields) entry.evening.reflection = String(fields.reflection || "");
      if ("rating" in fields) entry.evening.rating = String(fields.rating || "");
      if ("gratitude" in fields) entry.evening.gratitude = String(fields.gratitude || "");
    }

    const ok = await putJournal(entry);
    return { ok: !!ok };
  }

  async function addTodo(text) {
    const status = await getDayStatus();
    if (!canEditMorning(status)) return { ok: false, reason: "status" };
    const t = String(text || "").trim();
    if (!t) return { ok: false, reason: "invalid" };

    const dayKey = getTodayKey();
    const entry = await getJournalOrDefault(dayKey);
    entry.morning = entry.morning || { lookingForward: "", planning: "", todos: [] };
    entry.morning.todos = Array.isArray(entry.morning.todos) ? entry.morning.todos : [];
    entry.morning.todos.push({ text: t, done: false });

    const ok = await putJournal(entry);
    return { ok: !!ok };
  }

  async function toggleTodoDone(index, done) {
    // Enforced: only in execution
    const status = await getDayStatus();
    if (!canCheckTodos(status)) return { ok: false, reason: "status" };

    const idx = Number(index);
    if (!isFinite(idx) || idx < 0) return { ok: false, reason: "invalid" };

    const dayKey = getTodayKey();
    const entry = await getJournalOrDefault(dayKey);
    const todos = (entry.morning && Array.isArray(entry.morning.todos)) ? entry.morning.todos : [];
    if (!todos[idx]) return { ok: false, reason: "missing" };

    todos[idx].done = !!done;
    entry.morning.todos = todos;

    const ok = await putJournal(entry);
    return { ok: !!ok };
  }

  function computePerformanceFromJournal(entry) {
    try {
      const todos = (entry && entry.morning && Array.isArray(entry.morning.todos)) ? entry.morning.todos : [];
      const total = todos.length;
      const done = todos.filter((t) => t && t.done).length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      return { pct, done, total };
    } catch (_) {
      return { pct: 0, done: 0, total: 0 };
    }
  }

  // =========================
  // Calendar Blocks
  // =========================
  function listBlocks(dateKey) {
    const key = dateKey || getTodayKey();
    return _withStores("calendarBlocks", "readonly", async (s) => {
      // Prefer index if present
      try {
        if (s.calendarBlocks.indexNames && s.calendarBlocks.indexNames.contains("date")) {
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

  async function getNextBlock(dateKey) {
    const key = dateKey || getTodayKey();
    const blocks = await listBlocks(key);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Find the next block that starts at/after now
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const startMin = timeToMinutes(b && b.start);
      if (startMin >= nowMin) return b || null;
    }
    return null;
  }

  // =========================
  // Templates (kept, but not part of daily flow)
  // =========================
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

    // Additive: existing blocks remain.
    return _withStores("calendarBlocks", "readwrite", async (s) => {
      for (let i = 0; i < templateObj.blocks.length; i++) {
        const b = templateObj.blocks[i];
        if (!b || !b.start || !b.end || !b.title) continue;
        s.calendarBlocks.add({ date: key, start: b.start, end: b.end, title: b.title });
      }
      return true;
    }).then(() => true).catch(() => false);
  }

  // =========================
  // Finance Categories (Management)
  // =========================
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
    const normalized = {
      type: String(cat.type || ""),
      name: String(cat.name || "").trim(),
      order: Number(cat.order || 999)
    };
    if (normalized.type !== "income" && normalized.type !== "expense") return Promise.resolve(null);
    if (!normalized.name) return Promise.resolve(null);

    return _withStores("financeCategories", "readwrite", (s) => _reqToPromise(s.financeCategories.add(normalized)))
      .then((id) => id)
      .catch(() => null);
  }

  function updateFinanceCategory(cat) {
    if (!cat || cat.id == null) return Promise.resolve(false);

    const normalized = {
      id: cat.id,
      type: String(cat.type || ""),
      name: String(cat.name || "").trim(),
      order: Number(cat.order || 999)
    };
    if (normalized.type !== "income" && normalized.type !== "expense") return Promise.resolve(false);
    if (!normalized.name) return Promise.resolve(false);

    return _withStores("financeCategories", "readwrite", (s) => {
      s.financeCategories.put(normalized);
      return true;
    }).then(() => true).catch(() => false);
  }

  async function deleteFinanceCategory(id) {
    if (id == null) return false;

    // Prevent delete if referenced by transactions or gatekeeper items (safety)
    try {
      const txns = await _withStores("financeTransactions", "readonly", async (s) => {
        const all = await _reqToPromise(s.financeTransactions.getAll()).catch(() => []);
        return (all || []).some((t) => t && Number(t.categoryId) === Number(id));
      }).catch(() => false);

      if (txns) return false;

      const gkRef = await _withStores("gatekeeperItems", "readonly", async (s) => {
        const all = await _reqToPromise(s.gatekeeperItems.getAll()).catch(() => []);
        return (all || []).some((it) => it && Number(it.categoryId) === Number(id));
      }).catch(() => false);

      if (gkRef) return false;

      const ok = await _withStores("financeCategories", "readwrite", (s) => {
        s.financeCategories.delete(id);
        return true;
      }).then(() => true).catch(() => false);

      return !!ok;
    } catch (_) {
      return false;
    }
  }

  // =========================
  // Finance Transactions + Monthly Summary
  // =========================
  function addTransaction(txn) {
    if (!txn || !txn.date || !txn.type || txn.amount == null) return Promise.resolve(null);

    const normalized = Object.assign({}, txn);
    normalized.amount = Number(normalized.amount || 0);
    normalized.type = String(normalized.type || "");
    normalized.categoryId = (normalized.categoryId == null) ? null : Number(normalized.categoryId);
    normalized.date = String(normalized.date || getTodayKey());
    normalized.month = normalized.month || getMonthKey(normalized.date);

    if (normalized.type !== "income" && normalized.type !== "expense") return Promise.resolve(null);
    if (!isFinite(normalized.amount) || normalized.amount === 0) return Promise.resolve(null);

    return _withStores("financeTransactions", "readwrite", (s) => _reqToPromise(s.financeTransactions.add(normalized)))
      .then((id) => id)
      .catch(() => null);
  }

  function listTransactions(monthKey) {
    const m = monthKey || getMonthKey(getTodayKey());
    return _withStores("financeTransactions", "readonly", async (s) => {
      try {
        if (s.financeTransactions.indexNames && s.financeTransactions.indexNames.contains("month")) {
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
    const m = monthKey || getMonthKey(getTodayKey());
    const txns = await listTransactions(m);

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

    return { income, expense, remaining, remainingPct, spentPct, month: m };
  }

  // =========================
  // Gatekeeper
  // =========================
  function addGatekeeperItem(item) {
    if (!item || !item.name || item.price == null || !item.categoryId) return Promise.resolve(null);

    const createdAt = item.createdAt || _now();
    const unlockAt = item.unlockAt || (createdAt + 72 * 60 * 60 * 1000);

    const normalized = Object.assign({}, item, {
      name: String(item.name || "").trim(),
      createdAt,
      unlockAt,
      price: Number(item.price || 0),
      categoryId: Number(item.categoryId),
      status: item.status || "locked",
      purchasedAt: item.purchasedAt || null,
      source: "gatekeeper"
    });

    if (!normalized.name) return Promise.resolve(null);
    if (!isFinite(normalized.price) || normalized.price <= 0) return Promise.resolve(null);

    return _withStores("gatekeeperItems", "readwrite", (s) => _reqToPromise(s.gatekeeperItems.add(normalized)))
      .then((id) => id)
      .catch(() => null);
  }

  function listGatekeeper() {
    return _withStores("gatekeeperItems", "readonly", async (s) => {
      // Prefer createdAt index (if present)
      try {
        if (s.gatekeeperItems.indexNames && s.gatekeeperItems.indexNames.contains("createdAt")) {
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
    normalized.categoryId = Number(normalized.categoryId || 0);
    normalized.name = String(normalized.name || "").trim();
    normalized.status = String(normalized.status || "locked");

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
      const it = items[i] || {};
      const st = String(it.status || "");
      if (st === "purchased") { purchased++; continue; }
      if (now >= Number(it.unlockAt || 0)) eligible++;
      else locked++;
    }

    return { locked, eligible, purchased, total: items.length };
  }

  async function purchaseGatekeeperItem(itemId) {
    // Marks item purchased + creates expense transaction
    try {
      const db = await openDB();
      const today = getTodayKey();
      const monthKey = getMonthKey(today);

      const tx = db.transaction(["gatekeeperItems", "financeTransactions"], "readwrite");
      const gk = tx.objectStore("gatekeeperItems");
      const ft = tx.objectStore("financeTransactions");

      const item = await _reqToPromise(gk.get(itemId)).catch(() => null);
      if (!item) { try { tx.abort(); } catch (_) {} return { ok: false, reason: "missing" }; }

      const now = _now();
      const eligible = now >= Number(item.unlockAt || 0);
      if (!eligible) { try { tx.abort(); } catch (_) {} return { ok: false, reason: "locked" }; }
      if (String(item.status || "") === "purchased") { try { tx.abort(); } catch (_) {} return { ok: false, reason: "already" }; }

      item.status = "purchased";
      item.purchasedAt = now;
      gk.put(item);

      ft.add({
        date: today,
        month: monthKey,
        type: "expense",
        categoryId: Number(item.categoryId),
        amount: Number(item.price || 0),
        source: "gatekeeper",
        note: String(item.name || "Gatekeeper")
      });

      await _txDone(tx);
      return { ok: true };
    } catch (_) {
      return { ok: false, reason: "error" };
    }
  }

  // =========================
  // Vault (Snapshots)
  // =========================
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

  async function listVaultDays() {
    const all = await listVault();
    return (all || []).map((x) => x && x.dayKey).filter(Boolean);
  }

  async function getVaultDay(dayKey) {
    return await getVaultSnapshot(dayKey);
  }

  async function closeDay() {
    const settings = await getSettings();
    if (!settings || _normalizeDayStatus(settings.dayStatus) !== "evening") return false;

    const dayKey = settings.currentDayKey || getTodayKey();
    const monthKey = getMonthKey(dayKey);

    // journal
    const journalRaw = await getJournal(dayKey);
    const journal = ensureJournalShape(journalRaw, dayKey);

    const perf = computePerformanceFromJournal(journal);

    // blocks
    const blocks = await listBlocks(dayKey);

    // finance summary
    const summary = await getMonthlySummary(monthKey);

    const snapshot = {
      dayKey,
      closedAt: _now(),
      performanceScore: perf.pct,
      todos: { total: perf.total, done: perf.done },
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
        remainingPct: Number(summary.remainingPct || 0),
        month: summary.month
      }
    };

    // write snapshot
    const storeName = _getVaultStore();
    const okSnap = await _withStores(storeName, "readwrite", (s) => {
      s[storeName].put(snapshot);
      return true;
    }).then(() => true).catch(() => false);

    if (!okSnap) return false;

    // finalize settings
    settings.dayStatus = "closed";
    settings.dayClosedAt = _now();
    const okSet = await putSettings(settings);
    return !!okSet;
  }

  // =========================
  // Dashboard Snapshot (Command Engine data)
  // =========================
  async function getTodaySnapshot() {
    try {
      const today = getTodayKey();
      const status = await getDayStatus();

      // Journal/performance
      const journal = await getJournalOrDefault(today);
      const perf = computePerformanceFromJournal(journal);

      // Next block
      const nextBlock = await getNextBlock(today);

      // Budget (monthly remaining)
      const monthKey = getMonthKey(today);
      const finance = await getMonthlySummary(monthKey);

      // Gatekeeper overview
      const gk = await getGatekeeperCounts();

      return {
        date: today,
        status,
        performance: perf, // {pct, done, total}
        nextBlock: nextBlock || null,
        budget: finance,   // {income, expense, remaining, remainingPct, spentPct, month}
        gatekeeper: gk     // {locked, eligible, purchased, total}
      };
    } catch (_) {
      return {
        date: getTodayKey(),
        status: "morning",
        performance: { pct: 0, done: 0, total: 0 },
        nextBlock: null,
        budget: { income: 0, expense: 0, remaining: 0, remainingPct: 0, spentPct: 0, month: getMonthKey(getTodayKey()) },
        gatekeeper: { locked: 0, eligible: 0, purchased: 0, total: 0 }
      };
    }
  }

  // =========================
  // Maintenance Tools (Export / Import / Reset)
  // =========================
  async function exportAll() {
    try {
      await openDB();
      const names = [];
      for (let i = 0; i < _db.objectStoreNames.length; i++) names.push(_db.objectStoreNames[i]);

      const out = { meta: { exportedAt: _now(), dbName: DB_NAME, dbVersion: DB_VERSION, buildId: META.buildId }, stores: {} };

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
    // Strict but safe: writes via put. No drops.
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
    // Deletes the whole DB.
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

  // =========================
  // Public API
  // =========================
  return {
    // meta
    getMeta: function () { return Object.assign({}, META); },

    // core
    openDB,
    ensureCoreSeed,
    ensureTodayState,

    // settings/day state
    getSettings,
    putSettings,
    getDayStatus,
    canEditMorning,
    canCheckTodos,
    canEditEvening,
    isReadOnly,
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
    getJournalOrDefault,
    putJournal,
    saveMorningJournal,
    saveEveningJournal,
    addTodo,
    toggleTodoDone,
    computePerformanceFromJournal,

    // blocks
    listBlocks,
    addBlock,
    deleteBlock,
    getNextBlock,

    // templates
    listTemplates,
    addTemplate,
    deleteTemplate,
    applyTemplateToDate,

    // finance categories
    listFinanceCategories,
    addFinanceCategory,
    updateFinanceCategory,
    deleteFinanceCategory,

    // finance transactions
    addTransaction,
    listTransactions,
    getMonthlySummary,

    // gatekeeper
    addGatekeeperItem,
    listGatekeeper,
    updateGatekeeperItem,
    getGatekeeperCounts,
    purchaseGatekeeperItem,

    // vault
    getVaultSnapshot,
    listVault,
    listVaultDays,
    getVaultDay,

    // dashboard snapshot
    getTodaySnapshot,

    // maintenance tools
    exportAll,
    importAll,
    resetDB
  };

})();
