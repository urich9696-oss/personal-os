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

  window.UI = {
    el: el,
    toast: toast,
    formatDateISO: formatDateISO,
    formatDateHuman: formatDateHuman
  };
})();
