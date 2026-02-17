// js/core/state.js
(function () {
  "use strict";

  var State = {};
  var DB_NAME = "personalOS";
  var DB_VERSION = 99;
  var APP_VERSION = "0.1.3";

  function nowISO() { return new Date().toISOString(); }
  function todayKey() { return UI.formatDateISO(new Date()); }
  function currentMonthKey() { return todayKey().slice(0, 7); }

  function monthKeyFromDateISO(dateISO) {
    if (!dateISO || dateISO.length < 7) return currentMonthKey();
    return dateISO.slice(0, 7);
  }

  function safeNum(x) {
    var n = Number(x);
    if (isNaN(n)) return 0;
    return n;
  }

  function uid() {
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  // -------------------- DB UPGRADE --------------------
  function upgrade(db, tx) {
    if (!db.objectStoreNames.contains("settings")) {
      db.createObjectStore("settings", { keyPath: "key" });
    }

    if (!db.objectStoreNames.contains("journalEntries")) {
      db.createObjectStore("journalEntries", { keyPath: "date" });
    }

    if (!db.objectStoreNames.contains("calendarBlocks")) {
      var sBlocks = db.createObjectStore("calendarBlocks", { keyPath: "id", autoIncrement: true });
      sBlocks.createIndex("date", "date", { unique: false });
    } else {
      try {
        var exBlocks = tx.objectStore("calendarBlocks");
        if (!exBlocks.indexNames.contains("date")) exBlocks.createIndex("date", "date", { unique: false });
      } catch (e) {}
    }

    if (!db.objectStoreNames.contains("dayTemplates")) {
      db.createObjectStore("dayTemplates", { keyPath: "id", autoIncrement: true });
    }

    if (!db.objectStoreNames.contains("financeCategories")) {
      var sCat = db.createObjectStore("financeCategories", { keyPath: "id", autoIncrement: true });
      sCat.createIndex("type", "type", { unique: false });
      sCat.createIndex("order", "order", { unique: false });
    } else {
      try {
        var exCat = tx.objectStore("financeCategories");
        if (!exCat.indexNames.contains("type")) exCat.createIndex("type", "type", { unique: false });
        if (!exCat.indexNames.contains("order")) exCat.createIndex("order", "order", { unique: false });
      } catch (e) {}
    }

    if (!db.objectStoreNames.contains("financeTransactions")) {
      var sTx = db.createObjectStore("financeTransactions", { keyPath: "id", autoIncrement: true });
      sTx.createIndex("month", "month", { unique: false });
      sTx.createIndex("date", "date", { unique: false });
      sTx.createIndex("type", "type", { unique: false });
      sTx.createIndex("categoryId", "categoryId", { unique: false });
    } else {
      try {
        var exTx = tx.objectStore("financeTransactions");
        if (!exTx.indexNames.contains("month")) exTx.createIndex("month", "month", { unique: false });
        if (!exTx.indexNames.contains("date")) exTx.createIndex("date", "date", { unique: false });
        if (!exTx.indexNames.contains("type")) exTx.createIndex("type", "type", { unique: false });
        if (!exTx.indexNames.contains("categoryId")) exTx.createIndex("categoryId", "categoryId", { unique: false });
      } catch (e) {}
    }

    if (!db.objectStoreNames.contains("gatekeeperItems")) {
      var sGk = db.createObjectStore("gatekeeperItems", { keyPath: "id", autoIncrement: true });
      sGk.createIndex("status", "status", { unique: false });
      sGk.createIndex("unlockAt", "unlockAt", { unique: false });
      sGk.createIndex("createdAt", "createdAt", { unique: false });
    } else {
      try {
        var exGk = tx.objectStore("gatekeeperItems");
        if (!exGk.indexNames.contains("status")) exGk.createIndex("status", "status", { unique: false });
        if (!exGk.indexNames.contains("unlockAt")) exGk.createIndex("unlockAt", "unlockAt", { unique: false });
        if (!exGk.indexNames.contains("createdAt")) exGk.createIndex("createdAt", "createdAt", { unique: false });
      } catch (e) {}
    }

    if (!db.objectStoreNames.contains("vaultEntries")) {
      db.createObjectStore("vaultEntries", { keyPath: "dayKey" });
    }

    if (!db.objectStoreNames.contains("maintenanceEssentials")) {
      db.createObjectStore("maintenanceEssentials", { keyPath: "key" });
    }

    if (!db.objectStoreNames.contains("maintenanceRoutines")) {
      db.createObjectStore("maintenanceRoutines", { keyPath: "key" });
    }
  }

  async function init() {
    await DB.init(DB_NAME, DB_VERSION, upgrade);
    await ensureMainSettings();
    await ensureMaintenanceDefaults();
    await ensureFinanceDefaults();
    return true;
  }

  // -------------------- DEFAULTS --------------------
  async function ensureMainSettings() {
    var s = await DB.get("settings", "main");
    if (s) {
      if (!s.finance) s.finance = {};
      if (!s.finance.currentMonth) s.finance.currentMonth = currentMonthKey();
      if (!Array.isArray(s.finance.fixedItems)) s.finance.fixedItems = [];
      if (!s.finance.monthFlags) s.finance.monthFlags = {};
      if (!s.finance.reports) s.finance.reports = {};
      if (!s.version) s.version = { db: DB_VERSION, app: APP_VERSION };
      if (!s.version.db) s.version.db = DB_VERSION;
      s.version.app = APP_VERSION;
      await DB.put("settings", s);
      return s;
    }

    var base = {
      key: "main",
      app: { name: "PERSONAL OS", slogan: "The Architecture of Excellence." },
      version: { db: DB_VERSION, app: APP_VERSION },
      createdAt: nowISO(),
      updatedAt: nowISO(),
      debug: { enabled: false },
      finance: {
        currentMonth: currentMonthKey(),
        fixedItems: [],
        monthFlags: {},
        reports: {}
      }
    };
    await DB.put("settings", base);
    return base;
  }

  async function ensureMaintenanceDefaults() {
    var e = await DB.get("maintenanceEssentials", "main");
    if (!e) await DB.put("maintenanceEssentials", { key: "main", categories: [] });
    var r = await DB.get("maintenanceRoutines", "main");
    if (!r) await DB.put("maintenanceRoutines", { key: "main", categories: [] });
  }

  async function ensureFinanceDefaults() {
    var cats = await DB.getAll("financeCategories");
    if (cats && cats.length) return;

    await DB.add("financeCategories", { type: "income", name: "Salary", order: 10 });
    await DB.add("financeCategories", { type: "income", name: "Other Income", order: 20 });

    await DB.add("financeCategories", { type: "expense", name: "Rent", order: 10 });
    await DB.add("financeCategories", { type: "expense", name: "Groceries", order: 20 });
    await DB.add("financeCategories", { type: "expense", name: "Transport", order: 30 });
    await DB.add("financeCategories", { type: "expense", name: "Subscriptions", order: 40 });
    await DB.add("financeCategories", { type: "expense", name: "Other Expense", order: 90 });

    await DB.add("financeCategories", { type: "gatekeeper", name: "Gatekeeper", order: 10 });
  }

  async function ensureTodayState() {
    var dk = todayKey();
    var j = await DB.get("journalEntries", dk);
    if (!j) {
      await DB.put("journalEntries", {
        date: dk,
        morning: { todos: [], notes: "" },
        evening: { answers: { q1: "", q2: "", q3: "", q4: "" }, notes: "", completedAt: null },
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
    }
    return true;
  }

  // -------------------- SETTINGS --------------------
  async function getSettings() { return DB.get("settings", "main"); }

  async function updateSettings(patch) {
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) s[k] = patch[k];
    }
    s.updatedAt = nowISO();
    await DB.put("settings", s);
    return s;
  }

  // -------------------- FINANCE MONTH LOGIC --------------------
  function isFirstDay() {
    try { return new Date().getDate() === 1; } catch (e) { return false; }
  }

  async function financeEnsureMonth() {
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();

    var cur = currentMonthKey();
    var prev = (s.finance && s.finance.currentMonth) ? s.finance.currentMonth : cur;

    if (!s.finance) s.finance = {};
    if (!Array.isArray(s.finance.fixedItems)) s.finance.fixedItems = [];
    if (!s.finance.monthFlags) s.finance.monthFlags = {};
    if (!s.finance.reports) s.finance.reports = {};

    if (prev !== cur) {
      var prevReport = await financeBuildReport(prev);
      s.finance.reports[prev] = prevReport;
      s.finance.currentMonth = cur;

      if (!s.finance.monthFlags[cur]) s.finance.monthFlags[cur] = {};
      s.finance.monthFlags[cur].reminderDismissed = false;
      s.updatedAt = nowISO();
      await DB.put("settings", s);

      return { changed: true, month: cur, prev: prev, showReminder: isFirstDay() };
    }

    if (!s.finance.monthFlags[cur]) s.finance.monthFlags[cur] = {};
    var dismissed = !!s.finance.monthFlags[cur].reminderDismissed;
    s.updatedAt = nowISO();
    await DB.put("settings", s);

    return { changed: false, month: cur, prev: prev, showReminder: isFirstDay() && !dismissed };
  }

  async function financeDismissReminder(month) {
    var m = month || currentMonthKey();
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    if (!s.finance.monthFlags) s.finance.monthFlags = {};
    if (!s.finance.monthFlags[m]) s.finance.monthFlags[m] = {};
    s.finance.monthFlags[m].reminderDismissed = true;
    s.updatedAt = nowISO();
    await DB.put("settings", s);
    return true;
  }

  async function financeCloseMonth(month) {
    var m = month || currentMonthKey();
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();

    if (!s.finance.monthFlags) s.finance.monthFlags = {};
    if (!s.finance.monthFlags[m]) s.finance.monthFlags[m] = {};

    if (s.finance.monthFlags[m].closedAt) {
      return { closed: false, reason: "already-closed", closedAt: s.finance.monthFlags[m].closedAt };
    }

    var rep = await financeBuildReport(m);
    if (!s.finance.reports) s.finance.reports = {};
    s.finance.reports[m] = rep;

    s.finance.monthFlags[m].closedAt = nowISO();
    s.updatedAt = nowISO();
    await DB.put("settings", s);

    return { closed: true, report: rep };
  }

  async function financeListFixedItems() {
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    var items = (s.finance && Array.isArray(s.finance.fixedItems)) ? s.finance.fixedItems : [];
    return items.slice().sort(function (a, b) {
      var ta = a.type === "income" ? 0 : 1;
      var tb = b.type === "income" ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  async function financeAddFixedItem(item) {
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    if (!s.finance) s.finance = {};
    if (!Array.isArray(s.finance.fixedItems)) s.finance.fixedItems = [];

    var fi = {
      id: uid(),
      type: item.type === "income" ? "income" : "expense",
      name: (item.name || "").trim() || "Fixed",
      amount: safeNum(item.amount),
      categoryId: (item.categoryId === null || item.categoryId === undefined) ? null : item.categoryId,
      createdAt: nowISO()
    };
    s.finance.fixedItems.push(fi);
    s.updatedAt = nowISO();
    await DB.put("settings", s);
    return fi;
  }

  async function financeUpdateFixedItem(item) {
    if (!item || !item.id) throw new Error("financeUpdateFixedItem: id missing");
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    var arr = (s.finance && Array.isArray(s.finance.fixedItems)) ? s.finance.fixedItems : [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === item.id) {
        arr[i].type = item.type === "income" ? "income" : "expense";
        arr[i].name = (item.name || "").trim() || "Fixed";
        arr[i].amount = safeNum(item.amount);
        arr[i].categoryId = (item.categoryId === null || item.categoryId === undefined) ? null : item.categoryId;
        arr[i].updatedAt = nowISO();
        break;
      }
    }
    s.updatedAt = nowISO();
    await DB.put("settings", s);
    return true;
  }

  async function financeDeleteFixedItem(id) {
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    var arr = (s.finance && Array.isArray(s.finance.fixedItems)) ? s.finance.fixedItems : [];
    s.finance.fixedItems = arr.filter(function (x) { return x.id !== id; });
    s.updatedAt = nowISO();
    await DB.put("settings", s);
    return true;
  }

  async function financeApplyFixedForMonth(month) {
    var m = month || currentMonthKey();
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();

    if (!s.finance.monthFlags) s.finance.monthFlags = {};
    if (!s.finance.monthFlags[m]) s.finance.monthFlags[m] = {};

    if (s.finance.monthFlags[m].fixedAppliedAt) {
      return { applied: false, reason: "already-applied", appliedAt: s.finance.monthFlags[m].fixedAppliedAt };
    }

    var fixed = (s.finance && Array.isArray(s.finance.fixedItems)) ? s.finance.fixedItems : [];
    if (!fixed.length) {
      s.finance.monthFlags[m].fixedAppliedAt = nowISO();
      s.updatedAt = nowISO();
      await DB.put("settings", s);
      return { applied: false, reason: "no-fixed-items" };
    }

    for (var i = 0; i < fixed.length; i++) {
      var fi = fixed[i];
      await addTransaction({
        month: m,
        date: m + "-01",
        type: fi.type,
        categoryId: (fi.categoryId === undefined) ? null : fi.categoryId,
        name: fi.name,
        amount: safeNum(fi.amount),
        fixed: true,
        fixedId: fi.id
      });
    }

    s.finance.monthFlags[m].fixedAppliedAt = nowISO();
    s.updatedAt = nowISO();
    await DB.put("settings", s);
    return { applied: true, count: fixed.length };
  }

  async function financeBuildReport(month) {
    var m = month || currentMonthKey();
    var txs = await listTransactionsByMonth(m);

    var income = 0, expense = 0, fixedIncome = 0, fixedExpense = 0;
    var gatekeeperPurchases = 0;

    for (var i = 0; i < txs.length; i++) {
      var t = txs[i];
      var amt = safeNum(t.amount);

      if (t.type === "income") {
        income += amt;
        if (t.fixed) fixedIncome += amt;
      } else {
        expense += amt;
        if (t.fixed) fixedExpense += amt;
      }

      if (t.type === "expense" && String(t.name || "").indexOf("Gatekeeper:") === 0) gatekeeperPurchases += 1;
    }

    var remaining = income - expense;
    var pct = income > 0 ? Math.max(0, Math.min(100, (remaining / income) * 100)) : 0;

    var variableExpense = expense - fixedExpense;

    var varList = [];
    for (var j = 0; j < txs.length; j++) {
      var x = txs[j];
      if (x.type !== "expense") continue;
      if (x.fixed) continue;
      varList.push({ name: x.name || "—", amount: safeNum(x.amount), date: x.date || "", categoryId: x.categoryId || null });
    }
    varList.sort(function (a, b) { return safeNum(b.amount) - safeNum(a.amount); });

    return {
      month: m,
      createdAt: nowISO(),
      totals: { income: income, expense: expense, remaining: remaining, remainingPct: pct },
      fixed: { income: fixedIncome, expense: fixedExpense },
      variable: { expense: variableExpense, top: varList.slice(0, 10) },
      gatekeeper: { purchases: gatekeeperPurchases },
      notes: ""
    };
  }

  async function financeSaveReport(month, report) {
    var m = month || currentMonthKey();
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    if (!s.finance) s.finance = {};
    if (!s.finance.reports) s.finance.reports = {};
    s.finance.reports[m] = report;
    s.updatedAt = nowISO();
    await DB.put("settings", s);
    return true;
  }

  async function financeGetReport(month) {
    var m = month || currentMonthKey();
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    if (s.finance && s.finance.reports && s.finance.reports[m]) return s.finance.reports[m];
    return null;
  }

  async function financeListReports() {
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    var rep = (s.finance && s.finance.reports) ? s.finance.reports : {};
    var months = Object.keys(rep);
    months.sort(function (a, b) { return a < b ? 1 : (a > b ? -1 : 0); });
    return months.map(function (m) { return rep[m]; });
  }

  // -------------------- JOURNAL --------------------
  async function getJournal(date) {
    var d = date || todayKey();
    var j = await DB.get("journalEntries", d);
    if (!j && d === todayKey()) {
      await ensureTodayState();
      j = await DB.get("journalEntries", d);
    }
    return j;
  }

  async function saveJournal(date, journalObj) {
    if (!journalObj || !journalObj.date) throw new Error("saveJournal: journalObj.date missing");
    journalObj.updatedAt = nowISO();
    await DB.put("journalEntries", journalObj);
    return journalObj;
  }

  async function setMorningTodos(date, todos) {
    var j = await getJournal(date);
    if (!j) throw new Error("setMorningTodos: journal missing");
    j.morning = j.morning || {};
    j.morning.todos = Array.isArray(todos) ? todos : [];
    j.updatedAt = nowISO();
    await DB.put("journalEntries", j);
    return j;
  }

  async function completeEvening(date, answersObj) {
    var d = date || todayKey();
    var j = await getJournal(d);
    if (!j) throw new Error("completeEvening: journal missing");
    j.evening = j.evening || {};
    j.evening.answers = answersObj || j.evening.answers || {};
    j.evening.completedAt = nowISO();
    j.updatedAt = nowISO();
    await DB.put("journalEntries", j);

    await snapshotToVault(d);
    return j;
  }

  // -------------------- VAULT --------------------
  async function snapshotToVault(dayKey) {
    var d = dayKey || todayKey();
    var j = await DB.get("journalEntries", d);
    var payload = { dayKey: d, createdAt: nowISO(), journal: j || null };
    await DB.put("vaultEntries", payload);
    return payload;
  }

  async function listVault() {
    var all = await DB.getAll("vaultEntries");
    all.sort(function (a, b) {
      if (a.dayKey < b.dayKey) return 1;
      if (a.dayKey > b.dayKey) return -1;
      return 0;
    });
    return all;
  }

  async function getVaultSnapshot(dayKey) {
    return DB.get("vaultEntries", dayKey);
  }

  // -------------------- CALENDAR BLOCKS (COMPAT) --------------------
  function normalizeBlockForRead(row) {
    if (!row) return null;

    var needsWrite = false;

    // Backward compat: start/end -> startTime/endTime
    if (row.startTime === undefined && row.start !== undefined) {
      row.startTime = row.start;
      needsWrite = true;
    }
    if (row.endTime === undefined && row.end !== undefined) {
      row.endTime = row.end;
      needsWrite = true;
    }

    // Forward compat for UI: expose start/end expected by screens
    if (row.start === undefined && row.startTime !== undefined) {
      row.start = row.startTime;
      needsWrite = true;
    }
    if (row.end === undefined && row.endTime !== undefined) {
      row.end = row.endTime;
      needsWrite = true;
    }

    // Fix broken logic: title should always exist as string
    if (row.title === undefined || row.title === null) {
      row.title = "";
      needsWrite = true;
    }

    if (row.note === undefined || row.note === null) { row.note = ""; needsWrite = true; }
    if (row.type === undefined || row.type === null) { row.type = "block"; needsWrite = true; }

    if (row.createdAt === undefined || row.createdAt === null) { row.createdAt = nowISO(); needsWrite = true; }
    if (row.updatedAt === undefined || row.updatedAt === null) { row.updatedAt = nowISO(); needsWrite = true; }

    if (needsWrite && row.id !== undefined && row.id !== null) {
      DB.put("calendarBlocks", row).catch(function () {});
    }

    return row;
  }

  function cmpBlocks(a, b) {
    // Screens assume "start" exists; we ensure it above
    var sa = String(a.start || a.startTime || "");
    var sb = String(b.start || b.startTime || "");
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    var ta = String(a.title || "");
    var tb = String(b.title || "");
    return ta.localeCompare(tb);
  }

  async function listBlocksByDate(dateKey) {
    var q = DB.makeRangeOnly(dateKey);
    var rows = await DB.getAllByIndex("calendarBlocks", "date", q);

    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = normalizeBlockForRead(rows[i]);
      if (r) out.push(r);
    }
    out.sort(cmpBlocks);
    return out;
  }

  function coerceBlockTime(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  async function addBlock(payload) {
    if (!payload || !payload.date) throw new Error("addBlock: date missing");

    var p = payload || {};

    // Accept both {start,end} and {startTime,endTime}
    var startTime = (p.startTime !== undefined) ? p.startTime : p.start;
    var endTime = (p.endTime !== undefined) ? p.endTime : p.end;

    var b = {
      date: String(p.date),
      title: (p.title || "").trim(),
      startTime: coerceBlockTime(startTime),
      endTime: coerceBlockTime(endTime),
      // also store start/end for screens (kept in sync)
      start: coerceBlockTime(startTime),
      end: coerceBlockTime(endTime),
      note: (p.note || "").trim(),
      type: (p.type || "block").trim() || "block",
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    var id = await DB.add("calendarBlocks", b);
    b.id = id;
    return normalizeBlockForRead(b);
  }

  // Overload:
  // - updateBlock(id, patch)
  // - updateBlock(blockObj)  <-- what your screens currently do
  async function updateBlock(arg1, arg2) {
    var id, patch;

    if (typeof arg1 === "object" && arg1 && arg1.id !== undefined && arg1.id !== null) {
      id = arg1.id;
      patch = arg1; // treat whole object as patch
    } else {
      id = arg1;
      patch = arg2 || {};
    }

    if (id === undefined || id === null) throw new Error("updateBlock: id missing");

    var existing = await DB.get("calendarBlocks", id);
    if (!existing) throw new Error("updateBlock: block not found");

    existing = normalizeBlockForRead(existing);

    var p = patch || {};

    if (p.date !== undefined) existing.date = String(p.date);

    if (p.title !== undefined) existing.title = String(p.title || "").trim();

    // Accept both start/startTime and end/endTime
    if (p.startTime !== undefined || p.start !== undefined) {
      var st = (p.startTime !== undefined) ? p.startTime : p.start;
      existing.startTime = coerceBlockTime(st);
      existing.start = coerceBlockTime(st);
    }
    if (p.endTime !== undefined || p.end !== undefined) {
      var et = (p.endTime !== undefined) ? p.endTime : p.end;
      existing.endTime = coerceBlockTime(et);
      existing.end = coerceBlockTime(et);
    }

    if (p.note !== undefined) existing.note = String(p.note || "").trim();
    if (p.type !== undefined) existing.type = String(p.type || "").trim() || "block";

    existing.updatedAt = nowISO();
    await DB.put("calendarBlocks", existing);
    return normalizeBlockForRead(existing);
  }

  async function deleteBlock(id) {
    return DB.del("calendarBlocks", id);
  }

  // -------------------- DAY TEMPLATES --------------------
  async function listTemplates() { return DB.getAll("dayTemplates"); }

  function normalizeTemplateBlock(tb) {
    var b = tb || {};
    var startTime = (b.startTime !== undefined) ? b.startTime : (b.start !== undefined ? b.start : "");
    var endTime = (b.endTime !== undefined) ? b.endTime : (b.end !== undefined ? b.end : "");
    return {
      title: (b.title || "").trim(),
      startTime: String(startTime || "").trim(),
      endTime: String(endTime || "").trim(),
      note: (b.note || "").trim(),
      type: (b.type || "block").trim() || "block"
    };
  }

  async function createTemplate(name, blocksArray) {
    var arr = Array.isArray(blocksArray) ? blocksArray : [];
    var normalized = arr.map(normalizeTemplateBlock);
    var t = { name: name || "Template", blocks: normalized };
    var id = await DB.add("dayTemplates", t);
    t.id = id;
    return t;
  }

  async function updateTemplate(template) {
    if (!template || !template.id) throw new Error("updateTemplate: id missing");
    if (!Array.isArray(template.blocks)) template.blocks = [];
    template.blocks = template.blocks.map(normalizeTemplateBlock);
    await DB.put("dayTemplates", template);
    return template;
  }

  async function deleteTemplate(id) { return DB.del("dayTemplates", id); }

  async function applyTemplateToDate(templateId, dateISO) {
    var templates = await listTemplates();
    var t = null;
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === templateId) { t = templates[i]; break; }
    }
    if (!t) throw new Error("applyTemplateToDate: template not found");

    var blocks = Array.isArray(t.blocks) ? t.blocks : [];
    for (var j = 0; j < blocks.length; j++) {
      var nb = normalizeTemplateBlock(blocks[j]);
      await addBlock({
        date: dateISO,
        title: nb.title,
        startTime: nb.startTime,
        endTime: nb.endTime,
        note: nb.note,
        type: nb.type
      });
    }
    return true;
  }

  // -------------------- FINANCE CATEGORIES --------------------
  async function listFinanceCategories(type) {
    var all = await DB.getAll("financeCategories");
    if (type) all = all.filter(function (c) { return c.type === type; });
    all.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    return all;
  }

  async function getFinanceCategory(id) {
    if (id === null || id === undefined) return null;
    return DB.get("financeCategories", id);
  }

  async function addFinanceCategory(cat) {
    var c = {
      type: (cat.type === "income" || cat.type === "expense" || cat.type === "gatekeeper") ? cat.type : "expense",
      name: (cat.name || "Category").trim(),
      order: (typeof cat.order === "number") ? cat.order : 999
    };
    var id = await DB.add("financeCategories", c);
    c.id = id;
    return c;
  }

  async function updateFinanceCategory(cat) {
    if (!cat || !cat.id) throw new Error("updateFinanceCategory: id missing");
    await DB.put("financeCategories", cat);
    return cat;
  }

  async function deleteFinanceCategory(id) {
    return DB.del("financeCategories", id);
  }

  // -------------------- FINANCE TRANSACTIONS --------------------
  async function listTransactionsByMonth(month) {
    var m = month || currentMonthKey();
    var q = DB.makeRangeOnly(m);
    var rows = await DB.getAllByIndex("financeTransactions", "month", q);
    rows.sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")); });
    return rows;
  }

  async function addTransaction(txn) {
    if (!txn) throw new Error("addTransaction: missing txn");
    var date = txn.date || todayKey();
    var t = {
      month: txn.month || monthKeyFromDateISO(date),
      date: date,
      type: txn.type || "expense",
      categoryId: (txn.categoryId === undefined) ? null : txn.categoryId,
      name: txn.name || "",
      amount: typeof txn.amount === "number" ? txn.amount : Number(txn.amount || 0),
      fixed: !!txn.fixed
    };
    if (txn.fixedId) t.fixedId = txn.fixedId;

    var id = await DB.add("financeTransactions", t);
    t.id = id;
    return t;
  }

  async function updateTransaction(txn) {
    if (!txn || !txn.id) throw new Error("updateTransaction: id missing");
    await DB.put("financeTransactions", txn);
    return txn;
  }

  async function deleteTransaction(id) { return DB.del("financeTransactions", id); }

  // -------------------- GATEKEEPER --------------------
  async function addGatekeeper(item) {
    var createdAt = item.createdAt || nowISO();
    var unlockAt = item.unlockAt |
