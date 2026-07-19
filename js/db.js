export const DB_NAME = "personalOS";
export const DB_VERSION = 1;
export const STORES = [
  "tasks", "calendarEvents", "lifeAreas", "goals", "milestones",
  "blockTemplates", "dayPlans", "journalEntries", "transactions",
  "financeCategories", "monthlyBudgets", "maintenanceTemplates",
  "maintenanceDays", "settings", "uiState", "activityLog"
];

let instance;
const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error("IndexedDB-Anfrage fehlgeschlagen"));
});

export function openDB() {
  if (instance) return Promise.resolve(instance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach(name => {
        if (db.objectStoreNames.contains(name)) return;
        const store = db.createObjectStore(name, { keyPath: "id" });
        if (name === "activityLog") store.createIndex("timestamp", "timestamp");
      });
    };
    req.onsuccess = () => {
      instance = req.result;
      instance.onversionchange = () => { instance.close(); instance = null; };
      resolve(instance);
    };
    req.onerror = () => reject(req.error || new Error("PersonalOS-Speicher konnte nicht geöffnet werden"));
    req.onblocked = () => reject(new Error("Datenbank-Update ist durch einen anderen Tab blockiert"));
  });
}

const store = async (name, mode = "readonly") => {
  if (!STORES.includes(name)) throw new Error(`Unbekannter Store: ${name}`);
  return (await openDB()).transaction(name, mode).objectStore(name);
};

export const db = {
  async get(name, id) { return (await request((await store(name)).get(id))) || null; },
  async all(name) { return request((await store(name)).getAll()); },
  async put(name, value) {
    const now = new Date().toISOString();
    const row = { ...value, id: value.id || crypto.randomUUID(), updatedAt: now };
    if (!row.createdAt) row.createdAt = now;
    await request((await store(name, "readwrite")).put(row));
    return row;
  },
  async delete(name, id) { await request((await store(name, "readwrite")).delete(id)); },
  async clear(name) { await request((await store(name, "readwrite")).clear()); },
  async bulkPut(name, rows) {
    const target = await store(name, "readwrite");
    await Promise.all(rows.map(row => request(target.put(row))));
  }
};

export async function logActivity(action, entity, entityId, detail = "") {
  await db.put("activityLog", { action, entity, entityId, detail, timestamp: new Date().toISOString() });
  const rows = (await db.all("activityLog")).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  await Promise.all(rows.slice(500).map(row => db.delete("activityLog", row.id)));
}

export async function exportDatabase() {
  const data = {};
  for (const name of STORES) data[name] = await db.all(name);
  return { app: "PersonalOS", schemaVersion: DB_VERSION, exportedAt: new Date().toISOString(), data };
}

export function validateBackup(value) {
  if (!value || value.app !== "PersonalOS" || !value.data || typeof value.data !== "object") {
    throw new Error("Keine gültige PersonalOS-Sicherung");
  }
  for (const [name, rows] of Object.entries(value.data)) {
    if (!STORES.includes(name) || !Array.isArray(rows) || rows.some(row => !row?.id)) {
      throw new Error(`Ungültige Daten in ${name}`);
    }
  }
  return true;
}

export async function importDatabase(value, mode = "merge") {
  validateBackup(value);
  if (mode === "replace") for (const name of STORES) await db.clear(name);
  for (const name of STORES) if (value.data[name]) await db.bulkPut(name, value.data[name]);
  await logActivity("import", "settings", "backup", mode);
}

export async function resetDatabase() {
  for (const name of STORES) await db.clear(name);
}
