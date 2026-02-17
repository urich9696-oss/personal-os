const DB_NAME = 'PersonalOS_DB';
const DB_VERSION = 1;

const db = {
    _instance: null,

    async getDB() {
        if (this._instance) return this._instance;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const database = e.target.result;
                // Stores erstellen, falls nicht vorhanden
                if (!database.objectStoreNames.contains('alignment')) {
                    database.createObjectStore('alignment', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('maintenance')) {
                    database.createObjectStore('maintenance', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('path')) {
                    database.createObjectStore('path', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('finance')) {
                    database.createObjectStore('finance', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('settings')) {
                    database.createObjectStore('settings', { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                this._instance = request.result;
                resolve(request.result);
            };
            request.onerror = () => reject('IndexedDB Fehler');
        });
    },

    async save(storeName, data) {
        const database = await this.getDB();
        return new Promise((resolve) => {
            const tx = database.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(data);
            tx.oncomplete = () => resolve(true);
        });
    },

    async getAll(storeName) {
        const database = await this.getDB();
        return new Promise((resolve) => {
            const tx = database.transaction(storeName, 'readonly');
            const request = tx.objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result);
        });
    }
};
