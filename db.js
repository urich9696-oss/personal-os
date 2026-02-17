/* db.js — IndexedDB Wrapper & Schema (Batch 2)
   Additions:
   - Meta helpers
   - Journal + Vault helpers
*/

(function () {
  "use strict";

  var DB = {};
  var _db = null;

  var DB_NAME = "personal_os_db";
  var DB_VERSION = 1;

  function open() {
    if (_db) return Promise.resolve(_db);

    return new Promise(function (resolve, reject) {
      try {
        var req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = function (ev) {
          try {
            var db = req.result;
            var oldVersion = ev.oldVersion || 0;

            if (oldVersion < 1) {
              if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "key" });
              }

              if (!db.objectStoreNames.contains("journal")) {
                var s1 = db.createObjectStore("journal", { keyPath: "id" });
                s1.createIndex("by_day", "dayKey", { unique: false });
                s1.createIndex("by_flow", "flow", { unique: false });
              }

              if (!db.objectStoreNames.contains("vault")) {
                db.createObjectStore("vault", { keyPath: "dayKey" });
              }

              if (!db.objectStoreNames.contains("habits")) {
                db.createObjectStore("habits", { keyPath: "id" });
              }
              if (!db.objectStoreNames.contains("tasks")) {
                db.createObjectStore("tasks", { keyPath: "id" });
              }
              if (!db.objectStoreNames.contains("checks")) {
                var s2 = db.createObjectStore("checks", { keyPath: "id" });
                s2.createIndex("by_day", "dayKey", { unique: false });
              }

              if (!db.objectStoreNames.contains("blocks")) {
                var s3 = db.createObjectStore("blocks", { keyPath: "id" });
                s3.createIndex("by_day", "dayKey", { unique: false });
              }
              if (!db.objectStoreNames.contains("templates")) {
                db.createObjectStore("templates", { keyPath: "id" });
              }

              if (!db.objectStoreNames.contains("transactions")) {
                var s4 = db.createObjectStore("transactions", { keyPath: "id" });
                s4.createIndex("by_month", "monthKey", { unique: false });
                s4.createIndex("by_ts", "ts", { unique: false });
              }
              if (!db.objectStoreNames.contains("budgets")) {
                db.createObjectStore("budgets", { keyPath: "monthKey" });
              }

              if (!db.objectStoreNames.contains("gatekeeper")) {
                db.createObjectStore("gatekeeper", { keyPath: "id" });
              }
            }
          } catch (e) {
            reject(e);
          }
        };

        req.onsuccess = function () {
          _db = req.result;

          _db.onversionchange = function () {
            try { _db.close(); } catch (e) {}
            _db = null;
          };

          resolve(_db);
        };

        req.onerror = function () {
          reject(req.error || new Error("IndexedDB open failed"));
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  function tx(storeName, mode) {
    return open().then(function (db) {
      var t = db.transaction([storeName], mode || "readonly");
      return t.objectStore(storeName);
    });
  }

  function get(storeName, key) {
    return tx(storeName, "readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error || new Error("get failed")); };
      });
    });
  }

  function put(storeName, value) {
    return tx(storeName, "readwrite").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.put(value);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error || new Error("put failed")); };
      });
    });
  }

  function del(storeName, key) {
    return tx(storeName, "readwrite").then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.delete(key);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error || new Error("delete failed")); };
      });
    });
  }

  function listByIndex(storeName, indexName, queryValue) {
    return tx(storeName, "readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var idx = store.index(indexName);
        var range = IDBKeyRange.only(queryValue);
        var req = idx.openCursor(range);

        req.onsuccess = function () {
          var cursor = req.result;
          if (!cursor) return resolve(out);
          out.push(cursor.value);
          cursor.continue();
        };

        req.onerror = function () { reject(req.error || new Error("cursor failed")); };
      });
    });
  }

  function listAll(storeName) {
    return tx(storeName, "readonly").then(function (store) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var req = store.openCursor();
        req.onsuccess = function () {
          var cursor = req.result;
          if (!cursor) return resolve(out);
          out.push(cursor.value);
          cursor.continue();
        };
        req.onerror = function () { reject(req.error || new Error("cursor failed")); };
      });
    });
  }

  // -------- Meta helpers --------
  async function metaGet(key, fallback) {
    var row = await get("meta", key);
    if (!row) return (typeof fallback === "undefined" ? null : fallback);
    return row.value;
  }

  async function metaSet(key, value) {
    return put("meta", { key: key, value: value, updatedAt: Date.now() });
  }

  // -------- Journal helpers --------
  function uid(prefix) {
    return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  async function upsertJournal(dayKey, flow, payload) {
    // Use deterministic id per day+flow to avoid duplicates
    var id = "journal_" + dayKey + "_" + flow;
    var existing = await get("journal", id);
    var now = Date.now();
    var row = {
      id: id,
      dayKey: dayKey,
      flow: flow,
      payload: payload || {},
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    await put("journal", row);
    return row;
  }

  async function getJournal(dayKey, flow) {
    var id = "journal_" + dayKey + "_" + flow;
    return get("journal", id);
  }

  async function listJournalByDay(dayKey) {
    return listByIndex("journal", "by_day", dayKey);
  }

  // -------- Vault helpers --------
  async function getVaultSnapshot(dayKey) {
    return get("vault", dayKey);
  }

  async function listVault() {
    var all = await listAll("vault");
    // newest first by dayKey
    all.sort(function (a, b) {
      if (a.dayKey > b.dayKey) return -1;
      if (a.dayKey < b.dayKey) return 1;
      return 0;
    });
    return all;
  }

  async function putVaultSnapshot(dayKey, snapshot) {
    // Read-only semantics are enforced at app layer: we only write when closing day.
    var row = {
      dayKey: dayKey,
      snapshot: snapshot || {},
      closedAt: Date.now()
    };
    await put("vault", row);
    return row;
  }

  DB.open = open;
  DB.get = get;
  DB.put = put;
  DB.del = del;
  DB.listAll = listAll;
  DB.listByIndex = listByIndex;

  DB.metaGet = metaGet;
  DB.metaSet = metaSet;

  DB.upsertJournal = upsertJournal;
  DB.getJournal = getJournal;
  DB.listJournalByDay = listJournalByDay;

  DB.getVaultSnapshot = getVaultSnapshot;
  DB.listVault = listVault;
  DB.putVaultSnapshot = putVaultSnapshot;

  DB._uid = uid; // internal use

  window.DB = DB;
})();
