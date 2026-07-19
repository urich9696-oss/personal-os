import { db, logActivity } from "../db.js";

export async function saveEntity(store, value, action = "save") {
  const row = await db.put(store, value);
  await logActivity(action, store, row.id, row.title || row.name || row.description || "");
  window.dispatchEvent(new CustomEvent("personalos:data", { detail: { store, id: row.id } }));
  return row;
}

export async function removeEntity(store, id) {
  await db.delete(store, id);
  await logActivity("delete", store, id);
  window.dispatchEvent(new CustomEvent("personalos:data", { detail: { store, id } }));
}

export const byUpdated = rows => rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
export const groupBy = (rows, key) => rows.reduce((groups, row) => {
  const value = typeof key === "function" ? key(row) : row[key];
  (groups[value || "Andere"] ||= []).push(row);
  return groups;
}, {});

export async function globalSearch(query) {
  const needle = query.trim().toLocaleLowerCase("de");
  if (!needle) return [];
  const stores = ["tasks", "calendarEvents", "lifeAreas", "goals", "milestones", "journalEntries", "transactions", "maintenanceTemplates"];
  const result = [];
  for (const store of stores) {
    for (const row of await db.all(store)) {
      if (JSON.stringify(row).toLocaleLowerCase("de").includes(needle)) result.push({ store, row });
    }
  }
  return result.slice(0, 100);
}
