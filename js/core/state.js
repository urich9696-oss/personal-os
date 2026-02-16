(function () {
  "use strict";

  var State = {};
  var DB_NAME = "personalOS";
  var DB_VERSION = 99;

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

  // ---------- Defaults ----------
  async function ensureMainSettings() {
    var s = await DB.get("settings", "main");
    if (s) {
      if (!s.finance) s.finance = {};
      if (!s.finance.currentMonth) s.finance.currentMonth = currentMonthKey();
      if (!Array.isArray(s.finance.fixedItems)) s.finance.fixedItems = [];
      if (!s.finance.monthFlags) s.finance.monthFlags = {};
      if (!s.finance.reports) s.finance.reports = {};
      if (!s.version) s.version = { db: DB_VERSION, app: "0.1.2" };
      if (!s.version.db) s.version.db = DB_VERSION;
      s.version.app = "0.1.2";
      await DB.put("settings", s);
      return s;
    }

    var base = {
      key: "main",
      app: { name: "PERSONAL OS", slogan: "The Architecture of Excellence." },
      version: { db: DB_VERSION, app: "0.1.2" },
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

  // ---------- Settings ----------
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

  // ---------- Finance Month Logic ----------
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

  // ---------- Journal ----------
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

  // ---------- Vault ----------
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

  // ---------- Calendar Blocks ----------
  async function listBlocksByDate(dateISO) {
    var q = DB.makeRangeOnly(dateISO);
    var rows = await DB.getAllByIndex("calendarBlocks", "date", q);
    rows.sort(function (a, b) { return String(a.start || "").localeCompare(String(b.start || "")); });
    return rows;
  }

  async function addBlock(block) {
    if (!block || !block.date) throw new Error("addBlock: date missing");
    var b = { date: block.date, start: block.start || "", end: block.end || "", title: block.title || "" };
    var id = await DB.add("calendarBlocks", b);
    b.id = id;
    return b;
  }

  async function updateBlock(block) {
    if (!block || !block.id) throw new Error("updateBlock: id missing");
    await DB.put("calendarBlocks", block);
    return block;
  }

  async function deleteBlock(id) {
    return DB.del("calendarBlocks", id);
  }

  // ---------- Day Templates ----------
  async function listTemplates() { return DB.getAll("dayTemplates"); }

  async function createTemplate(name, blocksArray) {
    var t = { name: name || "Template", blocks: Array.isArray(blocksArray) ? blocksArray : [] };
    var id = await DB.add("dayTemplates", t);
    t.id = id;
    return t;
  }

  async function updateTemplate(template) {
    if (!template || !template.id) throw new Error("updateTemplate: id missing");
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
      await addBlock({ date: dateISO, start: blocks[j].start || "", end: blocks[j].end || "", title: blocks[j].title || "" });
    }
    return true;
  }

  // ---------- Finance Categories ----------
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

  // ---------- Finance Transactions ----------
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

  // ---------- Gatekeeper ----------
  async function addGatekeeper(item) {
    var createdAt = item.createdAt || nowISO();
    var unlockAt = item.unlockAt || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    var g = {
      name: item.name || "Gatekeeper Item",
      price: typeof item.price === "number" ? item.price : Number(item.price || 0),
      categoryId: item.categoryId || null,
      createdAt: createdAt,
      unlockAt: unlockAt,
      status: item.status || "locked",
      purchasedAt: item.purchasedAt || null
    };
    var id = await DB.add("gatekeeperItems", g);
    g.id = id;
    return g;
  }

  async function listGatekeepers(status) {
    var all = await DB.getAll("gatekeeperItems");
    if (status) all = all.filter(function (g) { return g.status === status; });
    all.sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
    return all;
  }

  async function updateGatekeeper(item) {
    if (!item || !item.id) throw new Error("updateGatekeeper: id missing");
    await DB.put("gatekeeperItems", item);
    return item;
  }

  async function markGatekeeperPurchased(id, purchaseDateISO) {
    var all = await DB.getAll("gatekeeperItems");
    var g = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) { g = all[i]; break; }
    }
    if (!g) throw new Error("markGatekeeperPurchased: not found");

    g.status = "purchased";
    g.purchasedAt = purchaseDateISO || nowISO();
    await DB.put("gatekeeperItems", g);

    await addTransaction({
      date: todayKey(),
      type: "expense",
      categoryId: g.categoryId || null,
      name: "Gatekeeper: " + (g.name || ""),
      amount: safeNum(g.price || 0),
      fixed: false
    });

    return g;
  }

  // ---------- Maintenance (Business API) ----------
  async function getEssentialsDoc() {
    var d = await DB.get("maintenanceEssentials", "main");
    if (!d) {
      d = { key: "main", categories: [] };
      await DB.put("maintenanceEssentials", d);
    }
    if (!Array.isArray(d.categories)) d.categories = [];
    return d;
  }

  async function saveEssentialsDoc(doc) {
    if (!doc || doc.key !== "main") throw new Error("saveEssentials: key main required");
    if (!Array.isArray(doc.categories)) doc.categories = [];
    await DB.put("maintenanceEssentials", doc);
    return doc;
  }

  async function essentialsListCategories() {
    var d = await getEssentialsDoc();
    return d.categories.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
  }

  async function essentialsAddCategory(name) {
    var d = await getEssentialsDoc();
    var c = { id: uid(), name: (name || "Category").trim() || "Category", items: [], createdAt: nowISO() };
    d.categories.push(c);
    await saveEssentialsDoc(d);
    return c;
  }

  async function essentialsRenameCategory(categoryId, newName) {
    var d = await getEssentialsDoc();
    for (var i = 0; i < d.categories.length; i++) {
      if (d.categories[i].id === categoryId) {
        d.categories[i].name = (newName || "").trim() || d.categories[i].name;
        d.categories[i].updatedAt = nowISO();
        break;
      }
    }
    await saveEssentialsDoc(d);
    return true;
  }

  async function essentialsDeleteCategory(categoryId) {
    var d = await getEssentialsDoc();
    d.categories = d.categories.filter(function (x) { return x.id !== categoryId; });
    await saveEssentialsDoc(d);
    return true;
  }

  async function essentialsAddItem(categoryId, item) {
    var d = await getEssentialsDoc();
    var target = null;
    for (var i = 0; i < d.categories.length; i++) {
      if (d.categories[i].id === categoryId) { target = d.categories[i]; break; }
    }
    if (!target) throw new Error("essentialsAddItem: category not found");

    var it = {
      id: uid(),
      name: (item.name || "Item").trim() || "Item",
      price: safeNum(item.price),
      frequency: (item.frequency || "").trim(),
      usage: (item.usage || "").trim(),
      imageDataUrl: item.imageDataUrl || null,
      createdAt: nowISO()
    };
    if (!Array.isArray(target.items)) target.items = [];
    target.items.push(it);
    target.updatedAt = nowISO();
    await saveEssentialsDoc(d);
    return it;
  }

  async function essentialsUpdateItem(categoryId, item) {
    if (!item || !item.id) throw new Error("essentialsUpdateItem: item.id missing");
    var d = await getEssentialsDoc();
    var target = null;
    for (var i = 0; i < d.categories.length; i++) {
      if (d.categories[i].id === categoryId) { target = d.categories[i]; break; }
    }
    if (!target) throw new Error("essentialsUpdateItem: category not found");
    if (!Array.isArray(target.items)) target.items = [];

    for (var j = 0; j < target.items.length; j++) {
      if (target.items[j].id === item.id) {
        target.items[j].name = (item.name || "").trim() || target.items[j].name;
        target.items[j].price = safeNum(item.price);
        target.items[j].frequency = (item.frequency || "").trim();
        target.items[j].usage = (item.usage || "").trim();
        if (item.imageDataUrl !== undefined) target.items[j].imageDataUrl = item.imageDataUrl;
        target.items[j].updatedAt = nowISO();
        break;
      }
    }
    target.updatedAt = nowISO();
    await saveEssentialsDoc(d);
    return true;
  }

  async function essentialsDeleteItem(categoryId, itemId) {
    var d = await getEssentialsDoc();
    var target = null;
    for (var i = 0; i < d.categories.length; i++) {
      if (d.categories[i].id === categoryId) { target = d.categories[i]; break; }
    }
    if (!target) throw new Error("essentialsDeleteItem: category not found");
    if (!Array.isArray(target.items)) target.items = [];

    target.items = target.items.filter(function (x) { return x.id !== itemId; });
    target.updatedAt = nowISO();
    await saveEssentialsDoc(d);
    return true;
  }

  async function getRoutinesDoc() {
    var d = await DB.get("maintenanceRoutines", "main");
    if (!d) {
      d = { key: "main", categories: [] };
      await DB.put("maintenanceRoutines", d);
    }
    if (!Array.isArray(d.categories)) d.categories = [];
    return d;
  }

  async function saveRoutinesDoc(doc) {
    if (!doc || doc.key !== "main") throw new Error("saveRoutines: key main required");
    if (!Array.isArray(doc.categories)) doc.categories = [];
    await DB.put("maintenanceRoutines", doc);
    return doc;
  }

  async function routinesListCategories() {
    var d = await getRoutinesDoc();
    return d.categories.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
  }

  async function routinesAddCategory(name) {
    var d = await getRoutinesDoc();
    var c = { id: uid(), name: (name || "Category").trim() || "Category", checklists: [], createdAt: nowISO() };
    d.categories.push(c);
    await saveRoutinesDoc(d);
    return c;
  }

  async function routinesRenameCategory(categoryId, newName) {
    var d = await getRoutinesDoc();
    for (var i = 0; i < d.categories.length; i++) {
      if (d.categories[i].id === categoryId) {
        d.categories[i].name = (newName || "").trim() || d.categories[i].name;
        d.categories[i].updatedAt = nowISO();
        break;
      }
    }
    await saveRoutinesDoc(d);
    return true;
  }

  async function routinesDeleteCategory(categoryId) {
    var d = await getRoutinesDoc();
    d.categories = d.categories.filter(function (x) { return x.id !== categoryId; });
    await saveRoutinesDoc(d);
    return true;
  }

  async function routinesAddChecklist(categoryId, name) {
    var d = await getRoutinesDoc();
    var c = null;
    for (var i = 0; i < d.categories.length; i++) {
      if (d.categories[i].id === categoryId) { c = d.categories[i]; break; }
    }
    if (!c) throw new Error("routinesAddChecklist: category not found");
    if (!Array.isArray(c.checklists)) c.checklists = [];

    var cl = { id: uid(), name: (name || "Checklist").trim() || "Checklist", items: [], createdAt: nowISO() };
    c.checklists.push(cl);
    c.updatedAt = nowISO();
    await saveRoutinesDoc(d);
    return cl;
  }

  async function routinesRenameChecklist(categoryId, checklistId, newName) {
    var d = await getRoutinesDoc();
    var c = null;
    for (var i = 0; i < d.categories.length; i++) {
      if (d.categories[i].id === categoryId) { c = d.categories[i]; break; }
    }
    if (!c) throw new Error("routinesRenameChecklist: category not found");
    if (!Array.isArray(c.checklists)) c.checklists = [];

    for (var j = 0; j < c.checklists.length; j++) {
      if (c.checklists[j].id === checklistId) {
        c.checklists[j].name = (newName || "").trim() || c.checklists[j].name;
        c.checklists[j].updatedAt = nowISO();
        break;
      }
    }
    c.updatedAt = nowISO();
    await saveRoutinesDoc(d);
    return true;
  }

  async function routinesDeleteChecklist(categoryId, checklistId) {
    var d = await getRoutinesDoc();
    var c = null;
    for (var i = 0; i < d.categories.length; i++) {
      if (d.categories[i].id === categoryId) { c = d.categories[i]; break; }
    }
    if (!c) throw new Error("routinesDeleteChecklist: category not found");
    if (!Array.isArray(c.checklists)) c.checklists = [];

    c.checklists = c.checklists.filter(function (x) { return x.id !== checklistId; });
    c.updatedAt = nowISO();
    await saveRoutinesDoc(d);
    return true;
  }

  async function routinesAddChecklistItem(categoryId, checklistId, text) {
    var d = await getRoutinesDoc();
    var c = null, cl = null;
    for (var i = 0; i < d.categories.length; i++) if (d.categories[i].id === categoryId) { c = d.categories[i]; break; }
    if (!c) throw new Error("routinesAddChecklistItem: category not found");
    if (!Array.isArray(c.checklists)) c.checklists = [];
    for (var j = 0; j < c.checklists.length; j++) if (c.checklists[j].id === checklistId) { cl = c.checklists[j]; break; }
    if (!cl) throw new Error("routinesAddChecklistItem: checklist not found");
    if (!Array.isArray(cl.items)) cl.items = [];

    var it = { id: uid(), text: (text || "Item").trim() || "Item", done: false, createdAt: nowISO() };
    cl.items.push(it);
    cl.updatedAt = nowISO();
    c.updatedAt = nowISO();
    await saveRoutinesDoc(d);
    return it;
  }

  async function routinesToggleChecklistItem(categoryId, checklistId, itemId) {
    var d = await getRoutinesDoc();
    var c = null, cl = null;
    for (var i = 0; i < d.categories.length; i++) if (d.categories[i].id === categoryId) { c = d.categories[i]; break; }
    if (!c) throw new Error("routinesToggleChecklistItem: category not found");
    for (var j = 0; j < (c.checklists || []).length; j++) if (c.checklists[j].id === checklistId) { cl = c.checklists[j]; break; }
    if (!cl) throw new Error("routinesToggleChecklistItem: checklist not found");

    for (var k = 0; k < (cl.items || []).length; k++) {
      if (cl.items[k].id === itemId) {
        cl.items[k].done = !cl.items[k].done;
        cl.items[k].updatedAt = nowISO();
        break;
      }
    }
    cl.updatedAt = nowISO();
    c.updatedAt = nowISO();
    await saveRoutinesDoc(d);
    return true;
  }

  async function routinesDeleteChecklistItem(categoryId, checklistId, itemId) {
    var d = await getRoutinesDoc();
    var c = null, cl = null;
    for (var i = 0; i < d.categories.length; i++) if (d.categories[i].id === categoryId) { c = d.categories[i]; break; }
    if (!c) throw new Error("routinesDeleteChecklistItem: category not found");
    for (var j = 0; j < (c.checklists || []).length; j++) if (c.checklists[j].id === checklistId) { cl = c.checklists[j]; break; }
    if (!cl) throw new Error("routinesDeleteChecklistItem: checklist not found");

    cl.items = (cl.items || []).filter(function (x) { return x.id !== itemId; });
    cl.updatedAt = nowISO();
    c.updatedAt = nowISO();
    await saveRoutinesDoc(d);
    return true;
  }

  async function routinesResetChecklist(categoryId, checklistId) {
    var d = await getRoutinesDoc();
    var c = null, cl = null;
    for (var i = 0; i < d.categories.length; i++) if (d.categories[i].id === categoryId) { c = d.categories[i]; break; }
    if (!c) throw new Error("routinesResetChecklist: category not found");
    for (var j = 0; j < (c.checklists || []).length; j++) if (c.checklists[j].id === checklistId) { cl = c.checklists[j]; break; }
    if (!cl) throw new Error("routinesResetChecklist: checklist not found");

    for (var k = 0; k < (cl.items || []).length; k++) {
      cl.items[k].done = false;
      cl.items[k].updatedAt = nowISO();
    }
    cl.updatedAt = nowISO();
    c.updatedAt = nowISO();
    await saveRoutinesDoc(d);
    return true;
  }

  // ---------- Backup / Reset ----------
  async function exportBackup() {
    var stores = [
      "settings",
      "journalEntries",
      "calendarBlocks",
      "dayTemplates",
      "financeCategories",
      "financeTransactions",
      "gatekeeperItems",
      "vaultEntries",
      "maintenanceEssentials",
      "maintenanceRoutines"
    ];
    var out = { meta: { exportedAt: nowISO(), dbName: DB_NAME, dbVersion: DB_VERSION }, data: {} };
    for (var i = 0; i < stores.length; i++) out.data[stores[i]] = await DB.getAll(stores[i]);
    return out;
  }

  async function hardReset() { await DB.destroyDatabase(DB_NAME); return true; }

  async function softResetTodayOnly() {
    var dk = todayKey();
    await DB.del("journalEntries", dk);

    var blocks = await listBlocksByDate(dk);
    for (var i = 0; i < blocks.length; i++) await deleteBlock(blocks[i].id);

    await DB.del("vaultEntries", dk);
    await ensureTodayState();
    return true;
  }

  // ---------- Public API ----------
  State.init = init;
  State.ensureTodayState = ensureTodayState;

  State.getSettings = getSettings;
  State.updateSettings = updateSettings;

  State.financeEnsureMonth = financeEnsureMonth;
  State.financeDismissReminder = financeDismissReminder;
  State.financeCloseMonth = financeCloseMonth;

  State.financeListFixedItems = financeListFixedItems;
  State.financeAddFixedItem = financeAddFixedItem;
  State.financeUpdateFixedItem = financeUpdateFixedItem;
  State.financeDeleteFixedItem = financeDeleteFixedItem;
  State.financeApplyFixedForMonth = financeApplyFixedForMonth;

  State.financeBuildReport = financeBuildReport;
  State.financeSaveReport = financeSaveReport;
  State.financeGetReport = financeGetReport;
  State.financeListReports = financeListReports;

  State.getJournal = getJournal;
  State.saveJournal = saveJournal;
  State.setMorningTodos = setMorningTodos;
  State.completeEvening = completeEvening;

  State.snapshotToVault = snapshotToVault;
  State.listVault = listVault;
  State.getVaultSnapshot = getVaultSnapshot;

  State.listBlocksByDate = listBlocksByDate;
  State.addBlock = addBlock;
  State.updateBlock = updateBlock;
  State.deleteBlock = deleteBlock;

  State.listTemplates = listTemplates;
  State.createTemplate = createTemplate;
  State.updateTemplate = updateTemplate;
  State.deleteTemplate = deleteTemplate;
  State.applyTemplateToDate = applyTemplateToDate;

  State.listFinanceCategories = listFinanceCategories;
  State.getFinanceCategory = getFinanceCategory;
  State.addFinanceCategory = addFinanceCategory;
  State.updateFinanceCategory = updateFinanceCategory;
  State.deleteFinanceCategory = deleteFinanceCategory;

  State.listTransactionsByMonth = listTransactionsByMonth;
  State.addTransaction = addTransaction;
  State.updateTransaction = updateTransaction;
  State.deleteTransaction = deleteTransaction;

  State.addGatekeeper = addGatekeeper;
  State.listGatekeepers = listGatekeepers;
  State.updateGatekeeper = updateGatekeeper;
  State.markGatekeeperPurchased = markGatekeeperPurchased;

  // Maintenance API
  State.essentialsListCategories = essentialsListCategories;
  State.essentialsAddCategory = essentialsAddCategory;
  State.essentialsRenameCategory = essentialsRenameCategory;
  State.essentialsDeleteCategory = essentialsDeleteCategory;
  State.essentialsAddItem = essentialsAddItem;
  State.essentialsUpdateItem = essentialsUpdateItem;
  State.essentialsDeleteItem = essentialsDeleteItem;

  State.routinesListCategories = routinesListCategories;
  State.routinesAddCategory = routinesAddCategory;
  State.routinesRenameCategory = routinesRenameCategory;
  State.routinesDeleteCategory = routinesDeleteCategory;
  State.routinesAddChecklist = routinesAddChecklist;
  State.routinesRenameChecklist = routinesRenameChecklist;
  State.routinesDeleteChecklist = routinesDeleteChecklist;
  State.routinesAddChecklistItem = routinesAddChecklistItem;
  State.routinesToggleChecklistItem = routinesToggleChecklistItem;
  State.routinesDeleteChecklistItem = routinesDeleteChecklistItem;
  State.routinesResetChecklist = routinesResetChecklist;

  State.exportBackup = exportBackup;
  State.hardReset = hardReset;
  State.softResetTodayOnly = softResetTodayOnly;

  window.State = State;
})();
