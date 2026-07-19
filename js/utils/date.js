export const pad = value => String(value).padStart(2, "0");
export const dateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const monthKey = (date = new Date()) => dateKey(date).slice(0, 7);
export const parseLocal = value => {
  if (!value) return null;
  const [date, time = "00:00"] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
};
export const localDateTime = date => `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const addDays = (date, count) => {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
};
export const startOfWeek = (date, monday = true) => {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (monday ? (day + 6) % 7 : day));
  result.setHours(0, 0, 0, 0);
  return result;
};
export const daysInMonth = date => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

export function eventOccurrences(event, from, to) {
  const start = parseLocal(event.start);
  if (!start) return [];
  const duration = Math.max(0, (parseLocal(event.end) || start) - start);
  const rule = event.recurrence || "none";
  const until = event.recurrenceUntil ? parseLocal(`${event.recurrenceUntil}T23:59`) : to;
  const result = [];
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= to && cursor <= until && guard++ < 800) {
    if (cursor >= from) result.push({ ...event, occurrenceStart: new Date(cursor), occurrenceEnd: new Date(cursor.getTime() + duration) });
    if (rule === "daily") cursor = addDays(cursor, 1);
    else if (rule === "weekly") cursor = addDays(cursor, 7);
    else if (rule === "monthly") cursor.setMonth(cursor.getMonth() + 1);
    else if (rule === "yearly") cursor.setFullYear(cursor.getFullYear() + 1);
    else break;
  }
  return result;
}

export function maintenanceDue(template, date) {
  if (template.paused) return false;
  const start = parseLocal(`${template.startDate || dateKey(date)}T00:00`);
  if (date < start) return false;
  const diff = Math.floor((new Date(dateKey(date)) - new Date(dateKey(start))) / 86400000);
  if (template.recurrence === "daily") return diff % Math.max(1, Number(template.interval) || 1) === 0;
  if (template.recurrence === "weekly") return (template.weekdays || [start.getDay()]).includes(date.getDay());
  if (template.recurrence === "monthly") return date.getDate() === start.getDate();
  return dateKey(date) === dateKey(start);
}
