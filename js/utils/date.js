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
  const interval = Math.max(1, Number(event.recurrenceInterval) || 1);
  const until = event.recurrenceUntil ? parseLocal(`${event.recurrenceUntil}T23:59`) : to;
  const result = [];
  let cursor = new Date(start);
  if (cursor < from && rule !== "none") {
    if (rule === "daily" || rule === "customDays" || rule === "weekly") {
      const step = interval * (rule === "weekly" ? 7 : 1);
      const skip = Math.max(0, Math.floor((from - cursor) / 86400000 / step));
      cursor = addDays(cursor, skip * step);
    } else if (rule === "monthly") {
      const months = (from.getFullYear() - cursor.getFullYear()) * 12 + from.getMonth() - cursor.getMonth();
      cursor = addMonthsClamped(cursor, Math.max(0, Math.floor(months / interval)) * interval, start.getDate());
    } else if (rule === "yearly") {
      cursor.setFullYear(cursor.getFullYear() + Math.max(0, Math.floor((from.getFullYear() - cursor.getFullYear()) / interval)) * interval);
    }
  }
  let guard = 0;
  while (cursor <= to && cursor <= until && guard++ < 800) {
    if (cursor >= from) result.push({ ...event, occurrenceStart: new Date(cursor), occurrenceEnd: new Date(cursor.getTime() + duration) });
    if (rule === "daily" || rule === "customDays") cursor = addDays(cursor, interval);
    else if (rule === "weekly") cursor = addDays(cursor, 7 * interval);
    else if (rule === "monthly") cursor = addMonthsClamped(cursor, interval, start.getDate());
    else if (rule === "yearly") cursor.setFullYear(cursor.getFullYear() + interval);
    else break;
  }
  return result;
}

function addMonthsClamped(date, count, preferredDay) {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + count);
  result.setDate(Math.min(preferredDay, daysInMonth(result)));
  return result;
}

export function maintenanceDue(template, date) {
  if (template.paused) return false;
  const start = parseLocal(`${template.startDate || dateKey(date)}T00:00`);
  if (date < start) return false;
  if (template.endDate && dateKey(date) > template.endDate) return false;
  if (template.maxOccurrences && occurrenceNumber(template, start, date) > Number(template.maxOccurrences)) return false;
  const diff = Math.floor((new Date(dateKey(date)) - new Date(dateKey(start))) / 86400000);
  const interval = Math.max(1, Number(template.interval) || 1);
  const weeks = Math.floor(diff / 7);
  const months = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
  if (template.recurrence === "daily" || template.recurrence === "customDays") return diff % interval === 0;
  if (template.recurrence === "weekly") return weeks % interval === 0 && (template.weekdays || [start.getDay()]).includes(date.getDay());
  if (template.recurrence === "monthly") return months % interval === 0 && date.getDate() === Math.min(start.getDate(), daysInMonth(date));
  if (template.recurrence === "yearly") return (date.getFullYear() - start.getFullYear()) % interval === 0 && date.getMonth() === start.getMonth() && date.getDate() === start.getDate();
  return dateKey(date) === dateKey(start);
}

function occurrenceNumber(template, start, date) {
  const diff = Math.floor((new Date(dateKey(date)) - new Date(dateKey(start))) / 86400000);
  const interval = Math.max(1, Number(template.interval) || 1);
  if (template.recurrence === "daily" || template.recurrence === "customDays") return Math.floor(diff / interval) + 1;
  if (template.recurrence === "weekly") return Math.floor(diff / (7 * interval)) + 1;
  if (template.recurrence === "monthly") return Math.floor(((date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth()) / interval) + 1;
  if (template.recurrence === "yearly") return Math.floor((date.getFullYear() - start.getFullYear()) / interval) + 1;
  return 1;
}
