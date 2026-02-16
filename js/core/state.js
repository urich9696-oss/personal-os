(function () {
  "use strict";

  // PERSONAL OS — State (Business API)
  // - The ONLY layer screens may call
  // - Owns defaults, migrations, and all CRUD
  // - Uses DB.* (db.js) internally

  var State = {};

  var DB_NAME = "personalOS";
  var DB_VERSION = 1;

  function nowISO() {
    return new Date().toISOString();
  }

  function todayKey() {
    return UI.formatDateISO(new Date());
  }

  function monthKeyFromDateISO(dateISO) {
    // "YYYY-MM-DD" -> "YYYY-MM"
    if (!dateISO || dateISO.length < 7) return UI.formatDateISO(new Date()).slice(0, 7);
    return dateISO.slice(0, 7);
  }

  function upgrade(db, tx, oldVersion, newVersion) {
    // Version 1: create all final stores + indexes
    if (oldVersion < 1) {
      // settings (key: "main")
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      // journalEntries (key: date "YYYY-MM-DD")
      if (!db.objectStoreNames.contains("journalEntries")) {
        db.createObjectStore("journalEntries", { keyPath: "date" });
      }

      // calendarBlocks (autoIncrement id)
      if (!db.objectStoreNames.contains("calendarBlocks")) {
        var sBlocks = db.createObjectStore("calendarBlocks", { keyPath: "id", autoIncrement: true });
        sBlocks.createIndex("date", "date", { unique: false });
      }

      // dayTemplates (autoIncrement id)
      if (!db.objectStoreNames.contains("dayTemplates")) {
        db.createObjectStore("dayTemplates", { keyPath: "id", autoIncrement: true });
      }

      // financeCategories (autoIncrement id)
      if (!db.objectStoreNames.contains("financeCategories")) {
        var sCat = db.createObjectStore("financeCategories", { keyPath: "id", autoIncrement: true });
        sCat.createIndex("type", "type", { unique: false });
        sCat.createIndex("order", "order", { unique: false });
      }

      // financeTransactions (autoIncrement id)
      if (!db.objectStoreNames.contains("financeTransactions")) {
        var sTx = db.createObjectStore("financeTransactions", { keyPath: "id", autoIncrement: true });
        sTx.createIndex("month", "month", { unique: false });
        sTx.createIndex("date", "date", { unique: false });
        sTx.createIndex("type", "type", { unique: false });
        sTx.createIndex("categoryId", "categoryId", { unique: false });
      }

      // gatekeeperItems (autoIncrement id)
      if (!db.objectStoreNames.contains("gatekeeperItems")) {
        var sGk = db.createObjectStore("gatekeeperItems", { keyPath: "id", autoIncrement: true });
        sGk.createIndex("status", "status", { unique: false });
        sGk.createIndex("unlockAt", "unlockAt", { unique: false });
        sGk.createIndex("createdAt", "createdAt", { unique: false });
      }

      // vaultEntries (key: dayKey)
      if (!db.objectStoreNames.contains("vaultEntries")) {
        db.createObjectStore("vaultEntries", { keyPath: "dayKey" });
      }

      // maintenanceEssentials (key: "main")
      if (!db.objectStoreNames.contains("maintenanceEssentials")) {
        db.createObjectStore("maintenanceEssentials", { keyPath: "key" });
      }

      // maintenanceRoutines (key: "main")
      if (!db.objectStoreNames.contains("maintenanceRoutines")) {
        db.createObjectStore("maintenanceRoutines", { keyPath: "key" });
      }
    }
  }

  async function init() {
    await DB.init(DB_NAME, DB_VERSION, upgrade);

    // Ensure base docs exist
    await ensureMainSettings();
    await ensureMaintenanceDefaults();
    await ensureFinanceDefaults();
    return true;
  }

  // ---------- Defaults ----------
  async function ensureMainSettings() {
    var s = await DB.get("settings", "main");
    if (s) return s;

    var base = {
      key: "main",
      app: {
        name: "PERSONAL OS",
        slogan: "The Architecture of Excellence."
      },
      version: {
        db: DB_VERSION,
        app: "0.1.0"
      },
      createdAt: nowISO(),
      debug: {
        enabled: false
      }
    };
    await DB.put("settings", base);
    return base;
  }

  async function ensureMaintenanceDefaults() {
    var e = await DB.get("maintenanceEssentials", "main");
    if (!e) {
      await DB.put("maintenanceEssentials", {
        key: "main",
        categories: [] // {id, name, items:[{id,name,price,frequency,usage,imageDataUrl?}]}
      });
    }
    var r = await DB.get("maintenanceRoutines", "main");
    if (!r) {
      await DB.put("maintenanceRoutines", {
        key: "main",
        categories: [] // {id, name, checklists:[{id,name,items:[{id,text,done}]}]}
      });
    }
  }

  async function ensureFinanceDefaults() {
    // Create minimal categories if none exist
    var cats = await DB.getAll("financeCategories");
    if (cats && cats.length) return;

    // Base categories (minimal, user can edit later)
    await DB.add("financeCategories", { type: "income", name: "Income", order: 1 });
    await DB.add("financeCategories", { type: "expense", name: "Expense", order: 2 });
    await DB.add("financeCategories", { type: "gatekeeper", name: "Gatekeeper", order: 3 });
  }

  async function ensureTodayState() {
    // Ensure today's journal entry exists (empty default)
    var dk = todayKey();
    var j = await DB.get("journalEntries", dk);
    if (!j) {
      await DB.put("journalEntries", {
        date: dk,
        morning: {
          todos: [], // [{id,text,done,scheduledTime? "HH:MM"}]
          notes: ""
        },
        evening: {
          answers: {
            q1: "",
            q2: "",
            q3: "",
            q4: ""
          },
          notes: "",
          completedAt: null
        },
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
    }
    return true;
  }

  // ---------- Settings ----------
  async function getSettings() {
    return DB.get("settings", "main");
  }

  async function updateSettings(patch) {
    var s = await getSettings();
    if (!s) s = await ensureMainSettings();
    // shallow merge
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) s[k] = patch[k];
    }
    await DB.put("settings", s);
    return s;
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
    if (!journalObj || !journalObj.date) {
      throw new Error("saveJournal: journalObj.date missing");
    }
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

    // Create vault snapshot
    await snapshotToVault(d);
    return j;
  }

  // ---------- Vault ----------
  async function snapshotToVault(dayKey) {
    var d = dayKey || todayKey();
    var j = await DB.get("journalEntries", d);

    var payload = {
      dayKey: d,
      createdAt: nowISO(),
      journal: j || null
      // In later batches we will include calendar blocks + finance report snapshot
    };

    await DB.put("vaultEntries", payload);
    return payload;
  }

  async function listVault() {
    // returns all vault entries sorted by dayKey desc
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
    rows.sort(function (a, b) {
      return String(a.start || "").localeCompare(String(b.start || ""));
    });
    return rows;
  }

  async function addBlock(block) {
    // {date,start,end,title}
    if (!block || !block.date) throw new Error("addBlock: date missing");
    var b = {
      date: block.date,
      start: block.start || "",
      end: block.end || "",
      title: block.title || ""
    };
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
  async function listTemplates() {
    return DB.getAll("dayTemplates");
  }

  async function createTemplate(name, blocksArray) {
    var t = {
      name: name || "Template",
      blocks: Array.isArray(blocksArray) ? blocksArray : []
    };
    var id = await DB.add("dayTemplates", t);
    t.id = id;
    return t;
  }

  async function updateTemplate(template) {
    if (!template || !template.id) throw new Error("updateTemplate: id missing");
    await DB.put("dayTemplates", template);
    return template;
  }

  async function deleteTemplate(id) {
    return DB.del("dayTemplates", id);
  }

  async function applyTemplateToDate(templateId, dateISO) {
    var templates = await listTemplates();
    var t = null;
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === templateId) { t = templates[i]; break; }
    }
    if (!t) throw new Error("applyTemplateToDate: template not found");

    var blocks = Array.isArray(t.blocks) ? t.blocks : [];
    for (var j = 0; j < blocks.length; j++) {
      await addBlock({
        date: dateISO,
        start: blocks[j].start || "",
        end: blocks[j].end || "",
        title: blocks[j].title || ""
      });
    }
    return true;
  }

  // ---------- Finance ----------
  async function listFinanceCategories(type) {
    var all = await DB.getAll("financeCategories");
    if (type) all = all.filter(function (c) { return c.type === type; });
    all.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    return all;
  }

  async function addFinanceCategory(cat) {
    var c = {
      type: cat.type || "expense",
      name: cat.name || "Category",
      order: typeof cat.order === "number" ? cat.order : 999
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

  async function listTransactionsByMonth(month) {
    var m = month || monthKeyFromDateISO(todayKey());
    var q = DB.makeRangeOnly(m);
    var rows = await DB.getAllByIndex("financeTransactions", "month", q);
    rows.sort(function (a, b) {
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
    return rows;
  }

  async function addTransaction(txn) {
    // {month,date,type,categoryId,name?,amount,fixed?}
    if (!txn) throw new Error("addTransaction: missing txn");
    var date = txn.date || todayKey();
    var t = {
      month: txn.month || monthKeyFromDateISO(date),
      date: date,
      type: txn.type || "expense",
      categoryId: txn.categoryId || null,
      name: txn.name || "",
      amount: typeof txn.amount === "number" ? txn.amount : Number(txn.amount || 0),
      fixed: !!txn.fixed
    };
    var id = await DB.add("financeTransactions", t);
    t.id = id;
    return t;
  }

  async function updateTransaction(txn) {
    if (!txn || !txn.id) throw new Error("updateTransaction: id missing");
    await DB.put("financeTransactions", txn);
    return txn;
  }

  async function deleteTransaction(id) {
    return DB.del("financeTransactions", id);
  }

  // Gatekeeper
  async function addGatekeeper(item) {
    // {name,price,categoryId,createdAt,unlockAt,status,purchasedAt?}
    var createdAt = item.createdAt || nowISO();
    var unlockAt = item.unlockAt || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    var g = {
      name: item.name || "Gatekeeper Item",
      price: typeof item.price === "number" ? item.price : Number(item.price || 0),
      categoryId: item.categoryId || null,
      createdAt: createdAt,
      unlockAt: unlockAt,
      status: item.status || "locked", // locked|eligible|purchased|cancelled
      purchasedAt: item.purchasedAt || null
    };
    var id = await DB.add("gatekeeperItems", g);
    g.id = id;
    return g;
  }

  async function listGatekeepers(status) {
    var all = await DB.getAll("gatekeeperItems");
    if (status) all = all.filter(function (g) { return g.status === status; });
    all.sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
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

    // Create expense transaction automatically
    await addTransaction({
      date: todayKey(),
      type: "expense",
      categoryId: null,
      name: "Gatekeeper: " + (g.name || ""),
      amount: Number(g.price || 0),
      fixed: false
    });

    return g;
  }

  // ---------- Maintenance ----------
  async function getEssentials() {
    return DB.get("maintenanceEssentials", "main");
  }

  async function saveEssentials(doc) {
    if (!doc || doc.key !== "main") throw new Error("saveEssentials: key main required");
    await DB.put("maintenanceEssentials", doc);
    return doc;
  }

  async function getRoutines() {
    return DB.get("maintenanceRoutines", "main");
  }

  async function saveRoutines(doc) {
    if (!doc || doc.key !== "main") throw new Error("saveRoutines: key main required");
    await DB.put("maintenanceRoutines", doc);
    return doc;
  }

  // ---------- Backup / Reset ----------
  async function exportBackup() {
    // Full JSON snapshot (all stores)
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

    for (var i = 0; i < stores.length; i++) {
      out.data[stores[i]] = await DB.getAll(stores[i]);
    }
    return out;
  }

  async function hardReset() {
    await DB.destroyDatabase(DB_NAME);
    // After deletion, caller should reload; on next init DB recreates
    return true;
  }

  async function softResetTodayOnly() {
    var dk = todayKey();
    // Remove today's journal + today's blocks (by date) only
    await DB.del("journalEntries", dk);

    // Delete blocks by date: iterate all blocks of date and delete by id
    var blocks = await listBlocksByDate(dk);
    for (var i = 0; i < blocks.length; i++) {
      await deleteBlock(blocks[i].id);
    }
    // Vault entry for today
    await DB.del("vaultEntries", dk);

    // Re-create default journal for today
    await ensureTodayState();
    return true;
  }

  // Public API
  State.init = init;
  State.ensureTodayState = ensureTodayState;

  State.getSettings = getSettings;
  State.updateSettings = updateSettings;

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

  State.getEssentials = getEssentials;
  State.saveEssentials = saveEssentials;
  State.getRoutines = getRoutines;
  State.saveRoutines = saveRoutines;

  State.exportBackup = exportBackup;
  State.hardReset = hardReset;
  State.softResetTodayOnly = softResetTodayOnly;

  window.State = State;
})();
