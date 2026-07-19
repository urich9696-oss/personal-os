import { parseLocal } from "./date.js";

export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char]));

export const formatDate = (value, options = {}) => {
  const date = typeof value === "string" ? parseLocal(value) : value;
  if (!date) return "–";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: options.year ? "numeric" : undefined }).format(date);
};
export const formatTime = (value, hour12 = false) => {
  const date = typeof value === "string" ? parseLocal(value) : value;
  return date ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12 }).format(date) : "";
};
export const money = (amount, currency = "EUR") => new Intl.NumberFormat("de-DE", {
  style: "currency", currency
}).format(Number(amount) || 0);
export const tags = value => Array.isArray(value) ? value : String(value || "").split(",").map(item => item.trim()).filter(Boolean);
export const download = (name, content, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: name });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
