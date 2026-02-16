(function () {
  "use strict";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);

    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "onClick") node.addEventListener("click", attrs[k]);
        else if (k === "onChange") node.addEventListener("change", attrs[k]);
        else node.setAttribute(k, attrs[k]);
      });
    }

    if (children && children.length) {
      children.forEach(function (c) {
        if (c === null || c === undefined) return;
        if (typeof c === "string") node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
    }

    return node;
  }

  function toast(message, ms) {
    ms = typeof ms === "number" ? ms : 2000;
    var host = document.getElementById("toast-host");
    if (!host) return;

    var t = el("div", { className: "toast", text: message }, []);
    host.appendChild(t);

    window.setTimeout(function () {
      try { host.removeChild(t); } catch (e) {}
    }, ms);
  }

  function formatDateISO(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatDateHuman(d) {
    try {
      return new Intl.DateTimeFormat("de-CH", {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(d);
    } catch (e) {
      return d.toDateString();
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ---------- Modal / Confirm / Prompt ----------
  function modal(opts) {
    opts = opts || {};
    var title = opts.title || "";
    var bodyHtml = opts.bodyHtml || "";
    var buttons = Array.isArray(opts.buttons) ? opts.buttons : [{ text: "OK", value: "ok", primary: true }];
    var onClose = typeof opts.onClose === "function" ? opts.onClose : function () {};

    var overlay = el("div", { className: "ui-overlay" }, []);
    var card = el("div", { className: "ui-modal card" }, []);
    var header = el("div", { className: "ui-modal__header" }, [
      el("div", { className: "ui-modal__title", text: title }, [])
    ]);
    var body = el("div", { className: "ui-modal__body", html: bodyHtml }, []);
    var footer = el("div", { className: "ui-modal__footer" }, []);

    buttons.forEach(function (b) {
      var btn = el("button", {
        className: "btn ui-modal__btn" + (b.primary ? " is-primary" : ""),
        type: "button",
        text: b.text || "OK"
      }, []);
      btn.addEventListener("click", function () {
        close(b.value);
      });
      footer.appendChild(btn);
    });

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    overlay.appendChild(card);

    function close(value) {
      try { document.body.removeChild(overlay); } catch (e) {}
      onClose(value);
    }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close("dismiss");
    });

    document.body.appendChild(overlay);

    return { close: close, overlay: overlay, card: card, body: body };
  }

  function confirmDialog(title, message) {
    return new Promise(function (resolve) {
      modal({
        title: title,
        bodyHtml: "<div class='ui-text'>" + escapeHtml(message) + "</div>",
        buttons: [
          { text: "Cancel", value: false },
          { text: "OK", value: true, primary: true }
        ],
        onClose: function (v) { resolve(!!v); }
      });
    });
  }

  function promptDialog(title, label, defaultValue, placeholder) {
    return new Promise(function (resolve) {
      var inputId = "ui-input-" + String(Math.random()).slice(2);
      var m = modal({
        title: title,
        bodyHtml:
          "<div class='ui-text'>" + escapeHtml(label || "") + "</div>" +
          "<input id='" + inputId + "' class='ui-input' type='text' placeholder='" + escapeHtml(placeholder || "") + "' value='" + escapeHtml(defaultValue || "") + "' />",
        buttons: [
          { text: "Cancel", value: null },
          { text: "Save", value: "save", primary: true }
        ],
        onClose: function (v) {
          if (v === "save") {
            var inp = document.getElementById(inputId);
            resolve(inp ? inp.value : (defaultValue || ""));
          } else resolve(null);
        }
      });

      window.setTimeout(function () {
        try {
          var inp = document.getElementById(inputId);
          if (inp) inp.focus();
        } catch (e) {}
      }, 50);
    });
  }

  function downloadJson(filename, obj) {
    var data = JSON.stringify(obj, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename || "backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function timeToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== "string") return null;
    var m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    var h = Number(m[1]);
    var mi = Number(m[2]);
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return h * 60 + mi;
  }

  function minutesToTime(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  window.UI = {
    el: el,
    toast: toast,
    formatDateISO: formatDateISO,
    formatDateHuman: formatDateHuman,
    escapeHtml: escapeHtml,
    modal: modal,
    confirm: confirmDialog,
    prompt: promptDialog,
    downloadJson: downloadJson,
    timeToMinutes: timeToMinutes,
    minutesToTime: minutesToTime
  };
})();
