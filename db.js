/* db.js — IndexedDB Wrapper & Schema (Batch 1)
   Rules:
   - Offline-first, local only
   - Promise-based, iOS-safe
   - Schema is forward-compatible (stores exist now, features come in later batches)
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

            // v1 baseline schema
            if (oldVersion < 1) {
              // Meta store (singletons, app state, version flags)
              if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "key" });
              }

              // Journal entries: { id, dayKey, flow: "morning"|"evening", payload, createdAt }
              if (!db.objectStoreNames.contains("journal")) {
                var s1 = db.createObjectStore("journal", { keyPath: "id" });
                s1.createIndex("by_day", "dayKey", { unique: false });
                s1.createIndex("by_flow", "flow", { unique: false });
              }

              // Vault snapshots (read-only archive): { dayKey, snapshot, closedAt }
              if (!db.objectStoreNames.contains("vault")) {
                db.createObjectStore("vault", { keyPath: "dayKey" });
              }

              // Maintenance: habits and tasks
              // habits: { id, name, active, createdAt }
              if (!db.objectStoreNames.contains("habits")) {
                db.createObjectStore("habits", { keyPath: "id" });
              }
              // tasks: { id, name, category, active, createdAt }
              if (!db.objectStoreNames.contains("tasks")) {
                db.createObjectStore("tasks", { keyPath: "id" });
              }

              // Daily checkmarks for maintenance: { id, dayKey, habitId?, taskId?, doneAt }
              if (!db.objectStoreNames.contains("checks")) {
                var s2 = db.createObjectStore("checks", { keyPath: "id" });
                s2.createIndex("by_day", "dayKey", { unique: false });
              }

              // Today’s Path: blocks + templates
              // blocks: { id, dayKey, title, startMin, endMin, status, createdAt }
              if (!db.objectStoreNames.contains("blocks")) {
                var s3 = db.createObjectStore("blocks", { keyPath: "id" });
                s3.createIndex("by_day", "dayKey", { unique: false });
              }
              // templates: { id, name, blocks: [{title,startMin,endMin}], createdAt }
              if (!db.objectStoreNames.contains("templates")) {
                db.createObjectStore("templates", { keyPath: "id" });
              }

              // Finance: transactions + monthly budgets
              // transactions: { id, ts, amountCents, merchant, note, monthKey }
              if (!db.objectStoreNames.contains("transactions")) {
                var s4 = db.createObjectStore("transactions", { keyPath: "id" });
                s4.createIndex("by_month", "monthKey", { unique: false });
                s4.createIndex("by_ts", "ts", { unique: false });
              }
              // budgets: { monthKey, limitCents, updatedAt }
              if (!db.objectStoreNames.contains("budgets")) {
                db.createObjectStore("budgets", { keyPath: "monthKey" });
              }

              // Gatekeeper: { id, createdAt, unlockAt, amountCents, item, status }
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

  // Expose
  DB.open = open;
  DB.get = get;
  DB.put = put;
  DB.del = del;
  DB.listAll = listAll;
  DB.listByIndex = listByIndex;

  window.DB = DB;
})();
