(function () {
  "use strict";

  // PERSONAL OS — IndexedDB Wrapper (low-level)
  // - Only file allowed to touch IndexedDB directly
  // - Promise-based, iOS-safe, crash-safe

  var DB = {};
  var _db = null;

  function open(dbName, dbVersion, onUpgrade) {
    return new Promise(function (resolve, reject) {
      try {
        var req = indexedDB.open(dbName, dbVersion);

        req.onupgradeneeded = function (ev) {
          try {
            var db = req.result;
            var tx = req.transaction;
            var oldVersion = ev.oldVersion || 0;
            var newVersion = ev.newVersion || dbVersion;

            if (typeof onUpgrade === "function") {
              onUpgrade(db, tx, oldVersion, newVersion);
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
          reject(req.error || new Error("IndexedDB open() failed"));
        };

        req.onblocked = function () {
          reject(new Error("IndexedDB blocked (another tab open?)"));
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  function getDb() {
    if (!_db) throw new Error("DB not initialized. Call DB.init() first.");
    return _db;
  }

  function init(dbName, dbVersion, onUpgrade) {
    return open(dbName, dbVersion, onUpgrade).then(function (db) {
      return db;
    });
  }

  function tx(storeNames, mode) {
    var db = getDb();
    if (!Array.isArray(storeNames)) storeNames = [storeNames];
    return db.transaction(storeNames, mode);
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("IDB request failed")); };
    });
  }

  function completeToPromise(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(true); };
      transaction.onerror = function () { reject(transaction.error || new Error("IDB tx error")); };
      transaction.onabort = function () { reject(transaction.error || new Error("IDB tx abort")); };
    });
  }

  function withStore(storeName, mode, fn) {
    return new Promise(function (resolve, reject) {
      try {
        var t = tx(storeName, mode);
        var store = t.objectStore(storeName);
        Promise.resolve(fn(store, t))
          .then(function (res) {
            completeToPromise(t).then(function () { resolve(res); }).catch(reject);
          })
          .catch(function (e) {
            try { t.abort(); } catch (x) {}
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    });
  }

  function withStores(storeNames, mode, fn) {
    return new Promise(function (resolve, reject) {
      try {
        var t = tx(storeNames, mode);
        var stores = {};
        for (var i = 0; i < storeNames.length; i++) {
          stores[storeNames[i]] = t.objectStore(storeNames[i]);
        }
        Promise.resolve(fn(stores, t))
          .then(function (res) {
            completeToPromise(t).then(function () { resolve(res); }).catch(reject);
          })
          .catch(function (e) {
            try { t.abort(); } catch (x) {}
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    });
  }

  // CRUD Helpers
  function get(storeName, key) {
    return withStore(storeName, "readonly", function (store) {
      return reqToPromise(store.get(key));
    });
  }

  function put(storeName, value) {
    return withStore(storeName, "readwrite", function (store) {
      return reqToPromise(store.put(value));
    });
  }

  function add(storeName, value) {
    return withStore(storeName, "readwrite", function (store) {
      return reqToPromise(store.add(value));
    });
  }

  function del(storeName, key) {
    return withStore(storeName, "readwrite", function (store) {
      return reqToPromise(store.delete(key));
    });
  }

  function clear(storeName) {
    return withStore(storeName, "readwrite", function (store) {
      return reqToPromise(store.clear());
    });
  }

  function getAll(storeName) {
    return withStore(storeName, "readonly", function (store) {
      if (store.getAll) return reqToPromise(store.getAll());
      // Fallback cursor
      return new Promise(function (resolve, reject) {
        var out = [];
        var req = store.openCursor();
        req.onsuccess = function (ev) {
          var cur = ev.target.result;
          if (cur) {
            out.push(cur.value);
            cur.continue();
          } else {
            resolve(out);
          }
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getAllByIndex(storeName, indexName, query) {
    return withStore(storeName, "readonly", function (store) {
      var idx = store.index(indexName);
      if (idx.getAll) return reqToPromise(idx.getAll(query));
      // Fallback cursor
      return new Promise(function (resolve, reject) {
        var out = [];
        var req = idx.openCursor(query);
        req.onsuccess = function (ev) {
          var cur = ev.target.result;
          if (cur) {
            out.push(cur.value);
            cur.continue();
          } else {
            resolve(out);
          }
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function makeRangeOnly(value) {
    return IDBKeyRange.only(value);
  }

  function destroyDatabase(dbName) {
    // Closes and deletes DB
    return new Promise(function (resolve, reject) {
      try {
        if (_db) {
          try { _db.close(); } catch (e) {}
          _db = null;
        }
        var req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error || new Error("deleteDatabase failed")); };
        req.onblocked = function () { reject(new Error("deleteDatabase blocked")); };
      } catch (e) {
        reject(e);
      }
    });
  }

  DB.init = init;
  DB.get = get;
  DB.put = put;
  DB.add = add;
  DB.del = del;
  DB.clear = clear;
  DB.getAll = getAll;
  DB.getAllByIndex = getAllByIndex;
  DB.withStore = withStore;
  DB.withStores = withStores;
  DB.makeRangeOnly = makeRangeOnly;
  DB.destroyDatabase = destroyDatabase;

  window.DB = DB;
})();
