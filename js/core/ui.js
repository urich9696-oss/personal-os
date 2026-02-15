(function () {
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v, { passive: false });
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    });
    const list = Array.isArray(children) ? children : (children != null ? [children] : []);
    list.forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function isoDate(d) {
    d = d || new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  }

  function isoMonth(d) {
    d = d || new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    return `${yr}-${mo}`;
  }

  function fmtDateHuman(d) {
    d = d || new Date();
    try {
      return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" });
    } catch (_) {
      return isoDate(d);
    }
  }

  function money(n) {
    const v = Number(n || 0);
    try {
      return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (_) {
      return String(Math.round(v * 100) / 100);
    }
  }

  function hoursUntil(ts) {
    const diff = ts - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
  }

  function minutesUntil(ts) {
    const diff = ts - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60)));
  }

  function uid() {
    // crypto.randomUUID fallback
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) {}
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();
  }

  function toast(message) {
    try {
      const root = document.getElementById("toastRoot");
      if (!root) return;
      const t = el("div", { class: "toast" }, String(message || ""));
      root.appendChild(t);
      setTimeout(() => { try { t.remove(); } catch (_) {} }, 2600);
    } catch (_) {}
  }

  function openModal(title, contentNode, onClose) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    root.innerHTML = "";
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");

    const close = () => {
      try { root.classList.remove("open"); } catch (_) {}
      try { root.setAttribute("aria-hidden", "true"); } catch (_) {}
      try { root.innerHTML = ""; } catch (_) {}
      if (typeof onClose === "function") {
        try { onClose(); } catch (_) {}
      }
    };

    const backdrop = el("div", { class: "modal-backdrop", onclick: (e) => { e.preventDefault(); close(); } });
    const modal = el("div", { class: "modal" }, [
      el("div", { class: "modal-head" }, [
        el("div", { class: "modal-title" }, title || "Modal"),
        el("button", { class: "btn small", onclick: (e) => { e.preventDefault(); close(); } }, "Close")
      ]),
      el("div", { class: "modal-body" }, contentNode)
    ]);

    root.appendChild(backdrop);
    root.appendChild(modal);

    return { close };
  }

  async function fileToDataUrl(file) {
    if (!file) return null;
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  window.POS = window.POS || {};
  window.POS.ui = {
    el, isoDate, isoMonth, fmtDateHuman, money, hoursUntil, minutesUntil, uid,
    toast, openModal, fileToDataUrl
  };
})();
