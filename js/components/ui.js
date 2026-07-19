import { escapeHTML } from "../utils/format.js";

export const icon = name => ({
  dashboard: "⌂", calendar: "▦", path: "◇", blocks: "◫", more: "•••",
  tasks: "✓", journal: "✎", finance: "€", maintenance: "↻", settings: "⚙"
}[name] || "•");

export function toast(message, kind = "") {
  const node = document.createElement("div");
  node.className = `toast ${kind}`;
  node.textContent = message;
  document.querySelector("#toast-root").append(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => { node.classList.remove("show"); setTimeout(() => node.remove(), 250); }, 2800);
}

export function closeModal() {
  document.querySelector("#modal-root").replaceChildren();
}

export function modal({ title, content, actions = "", wide = false, onOpen }) {
  const root = document.querySelector("#modal-root");
  root.innerHTML = `<div class="modal-backdrop" data-close><section class="sheet ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <header><h2 id="dialog-title">${escapeHTML(title)}</h2><button class="icon-btn" data-close aria-label="Schließen">×</button></header>
    <div class="sheet-content">${content}</div>${actions ? `<footer>${actions}</footer>` : ""}
  </section></div>`;
  root.querySelectorAll("[data-close]").forEach(node => node.addEventListener("click", event => {
    if (event.target === node || node.matches("button")) closeModal();
  }));
  document.addEventListener("keydown", function escape(event) {
    if (event.key === "Escape") { closeModal(); document.removeEventListener("keydown", escape); }
  });
  const sheet = root.querySelector(".sheet");
  sheet.querySelector("input,select,textarea,button")?.focus();
  onOpen?.(sheet);
  return sheet;
}

export function confirmDialog(message, confirmLabel = "Löschen") {
  return new Promise(resolve => {
    modal({
      title: "Bist du sicher?",
      content: `<p>${escapeHTML(message)}</p>`,
      actions: `<button class="button ghost" data-no>Abbrechen</button><button class="button danger" data-yes>${escapeHTML(confirmLabel)}</button>`,
      onOpen: sheet => {
        sheet.querySelector("[data-no]").onclick = () => { closeModal(); resolve(false); };
        sheet.querySelector("[data-yes]").onclick = () => { closeModal(); resolve(true); };
      }
    });
  });
}

export function field({ label, name, type = "text", value = "", options, required = false, min, max, step, placeholder = "" }) {
  const attrs = `name="${name}" ${required ? "required" : ""} ${min != null ? `min="${min}"` : ""} ${max != null ? `max="${max}"` : ""} ${step ? `step="${step}"` : ""}`;
  let control;
  if (type === "textarea") control = `<textarea ${attrs} placeholder="${escapeHTML(placeholder)}">${escapeHTML(value)}</textarea>`;
  else if (type === "select") control = `<select ${attrs}>${options.map(([key, text]) => `<option value="${escapeHTML(key)}" ${String(key) === String(value) ? "selected" : ""}>${escapeHTML(text)}</option>`).join("")}</select>`;
  else if (type === "checkbox") control = `<input type="checkbox" ${attrs} ${value ? "checked" : ""}>`;
  else control = `<input type="${type}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" ${attrs}>`;
  return `<label class="field ${type === "checkbox" ? "check-field" : ""}"><span>${escapeHTML(label)}</span>${control}</label>`;
}

export const empty = (title, text, action = "") => `<div class="empty"><span>○</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(text)}</p>${action}</div>`;
export const pageHeader = (title, subtitle, action = "") => `<header class="page-header"><div><h1>${escapeHTML(title)}</h1><p>${escapeHTML(subtitle)}</p></div>${action}</header>`;
export const progress = value => `<div class="progress" role="progressbar" aria-valuenow="${Math.round(value)}"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div>`;

export function formValues(form) {
  const values = Object.fromEntries(new FormData(form));
  form.querySelectorAll('input[type="checkbox"]').forEach(input => values[input.name] = input.checked);
  return values;
}

export function bindSwipeDelete(container, callback) {
  container.querySelectorAll("[data-swipe]").forEach(node => {
    let start = 0;
    node.addEventListener("touchstart", e => { start = e.touches[0].clientX; }, { passive: true });
    node.addEventListener("touchend", e => {
      if (start - e.changedTouches[0].clientX > 80) callback(node.dataset.swipe);
    });
  });
}
