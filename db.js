const DB_NAME = 'PersonalOS_DB';
const DB_VERSION = 1;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('journals')) db.createObjectStore('journals', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('maintenance')) db.createObjectStore('maintenance', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('path')) db.createObjectStore('path', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('finance')) db.createObjectStore('finance', { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const dbProvider = {
  async saveJournal(journal) {
    const db = await initDB();
    const tx = db.transaction('journals', 'readwrite');
    tx.objectStore('journals').put(journal);
    return tx.complete;
  },
  async getJournal(date) {
    const db = await initDB();
    return new Promise(r => {
      const req = db.transaction('journals', 'readonly').objectStore('journals').get(date);
      req.onsuccess = () => r(req.result);
    });
  },
  async getAllJournals() {
    const db = await initDB();
    return new Promise(r => {
      db.transaction('journals', 'readonly').objectStore('journals').getAll().onsuccess = (e) => r(e.target.result);
    });
  },
  async getMaintenance() {
    const db = await initDB();
    return new Promise(r => {
      db.transaction('maintenance', 'readonly').objectStore('maintenance').getAll().onsuccess = (e) => r(e.target.result);
    });
  },
  async addMaintenanceItem(item) {
    const db = await initDB();
    const tx = db.transaction('maintenance', 'readwrite');
    tx.objectStore('maintenance').add(item);
    return tx.complete;
  },
  async updateMaintenanceItem(item) {
    const db = await initDB();
    const tx = db.transaction('maintenance', 'readwrite');
    tx.objectStore('maintenance').put(item);
    return tx.complete;
  }
};

export const pathDB = {
  async getBlocks() {
    const db = await initDB();
    return new Promise(r => {
      db.transaction('path', 'readonly').objectStore('path').getAll().onsuccess = (e) => r(e.target.result);
    });
  },
  async saveBlock(block) {
    const db = await initDB();
    db.transaction('path', 'readwrite').objectStore('path').put(block);
  },
  async clearAll() {
    const db = await initDB();
    db.transaction('path', 'readwrite').objectStore('path').clear();
  },
  async deleteBlock(id) {
    const db = await initDB();
    db.transaction('path', 'readwrite').objectStore('path').delete(id);
  }
};

export const financeDB = {
  async getItems() {
    const db = await initDB();
    return new Promise(r => {
      db.transaction('finance', 'readonly').objectStore('finance').getAll().onsuccess = (e) => r(e.target.result);
    });
  },
  async saveItem(item) {
    const db = await initDB();
    db.transaction('finance', 'readwrite').objectStore('finance').put(item);
  },
  async deleteItem(id) {
    const db = await initDB();
    db.transaction('finance', 'readwrite').objectStore('finance').delete(id);
  }
};
