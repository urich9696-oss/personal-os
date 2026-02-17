const DB_NAME = 'PERSONAL_OS_DB';

export const db = {
    async request() {
        return new Promise((resolve) => {
            const req = indexedDB.open(DB_NAME, 3);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('store')) d.createObjectStore('store', { keyPath: 'id', autoIncrement: true });
            };
            req.onsuccess = (e) => resolve(e.target.result);
        });
    },
    async save(type, data) {
        const d = await this.request();
        return new Promise(r => {
            const tx = d.transaction('store', 'readwrite');
            tx.objectStore('store').put({ type, ...data });
            tx.oncomplete = () => r();
        });
    },
    async getAll(type) {
        const d = await this.request();
        return new Promise(r => {
            const tx = d.transaction('store', 'readonly');
            tx.objectStore('store').getAll().onsuccess = (e) => {
                r(e.target.result.filter(i => i.type === type));
            };
        });
    }
};
