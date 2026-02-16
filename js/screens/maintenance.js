(function () {
  "use strict";

  ScreenRegistry.register("maintenance", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Maintenance (Human)" }, []);
      container.appendChild(title);

      var top = UI.el("div", { className: "grid-2" }, [
        tileButton("Essentials", "Products & Frequencies", function () { openEssentials(container); }),
        tileButton("Routinen", "Checklists", function () { openRoutines(container); })
      ]);
      container.appendChild(top);

      // Default view: essentials list
      container.appendChild(UI.el("div", { style: "height:12px" }, []));
      await openEssentials(container);
    }
  });

  function tileButton(label, value, onClick) {
    var t = UI.el("div", { className: "card tile tile-click" }, [
      UI.el("div", { className: "tile__label", text: label }, []),
      UI.el("div", { className: "tile__value", text: value }, [])
    ]);
    t.addEventListener("click", onClick);
    return t;
  }

  async function openEssentials(container) {
    removeSection(container, "maintenance-section");
    var section = UI.el("div", { id: "maintenance-section" }, []);
    container.appendChild(section);

    var doc = await State.getEssentials();
    doc.categories = Array.isArray(doc.categories) ? doc.categories : [];

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Essentials — Categories" }, []));

    var addCat = UI.el("button", { className: "btn", type: "button", text: "Add Category" }, []);
    addCat.addEventListener("click", function () {
      UI.prompt("New Category", "Name", "", "e.g. Supplements").then(function (name) {
        if (name === null) return;
        var n = name.trim();
        if (!n) return;
        doc.categories.push({ id: "c" + String(Date.now()), name: n, items: [] });
        State.saveEssentials(doc).then(function () { UI.toast("Saved"); openEssentials(container); });
      });
    });

    card.appendChild(UI.el("div", { style: "height:10px" }, []));
    card.appendChild(addCat);
    card.appendChild(UI.el("div", { style: "height:12px" }, []));

    if (!doc.categories.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No categories yet." }, []));
      section.appendChild(card);
      return;
    }

    doc.categories.forEach(function (cat) {
      var row = UI.el("div", { className: "mini-row" }, []);
      var btn = UI.el("button", { className: "btn", type: "button", text: cat.name }, []);
      btn.addEventListener("click", function () { openEssentialsCategory(container, doc, cat.id); });

      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function () {
        UI.confirm("Delete Category", "Delete " + cat.name + "?").then(function (ok) {
          if (!ok) return;
          doc.categories = doc.categories.filter(function (c) { return c.id !== cat.id; });
          State.saveEssentials(doc).then(function () { UI.toast("Deleted"); openEssentials(container); });
        });
      });

      row.appendChild(btn);
      row.appendChild(del);
      card.appendChild(row);
      card.appendChild(UI.el("div", { style: "height:8px" }, []));
    });

    section.appendChild(card);
  }

  async function openEssentialsCategory(container, doc, catId) {
    removeSection(container, "maintenance-section");
    var section = UI.el("div", { id: "maintenance-section" }, []);
    container.appendChild(section);

    var cat = doc.categories.filter(function (c) { return c.id === catId; })[0];
    if (!cat) { UI.toast("Category missing"); return; }
    cat.items = Array.isArray(cat.items) ? cat.items : [];

    var back = UI.el("button", { className: "btn", type: "button", text: "Back" }, []);
    back.addEventListener("click", function () { openEssentials(container); });
    section.appendChild(back);
    section.appendChild(UI.el("div", { style: "height:12px" }, []));

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Category: " + cat.name }, []));

    var addItem = UI.el("button", { className: "btn", type: "button", text: "Add Product" }, []);
    addItem.addEventListener("click", function () {
      UI.prompt("New Product", "Name", "", "e.g. Creatine").then(function (name) {
        if (name === null) return;
        var n = name.trim();
        if (!n) return;

        UI.prompt("Price", "CHF", "", "e.g. 29.90").then(function (priceStr) {
          if (priceStr === null) return;
          var p = Number(String(priceStr).replace(",", "."));
          if (isNaN(p)) p = 0;

          UI.prompt("Frequency", "e.g. every 30 days", "", "every 30 days").then(function (freq) {
            if (freq === null) return;
            cat.items.push({
              id: "i" + String(Date.now()),
              name: n,
              price: p,
              frequency: (freq || "").trim(),
              usage: ""
            });
            State.saveEssentials(doc).then(function () { UI.toast("Saved"); openEssentialsCategory(container, doc, catId); });
          });
        });
      });
    });

    card.appendChild(UI.el("div", { style: "height:10px" }, []));
    card.appendChild(addItem);
    card.appendChild(UI.el("div", { style: "height:12px" }, []));

    if (!cat.items.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No products yet." }, []));
      section.appendChild(card);
      return;
    }

    cat.items.forEach(function (it) {
      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, [
        UI.el("div", { className: "todo-text", text: it.name + " — CHF " + formatMoney(it.price) }, [])
      ]);

      left.addEventListener("click", function () {
        UI.prompt("Edit Name", "Name", it.name || "", "").then(function (v) {
          if (v === null) return;
          it.name = v.trim() || it.name;

          UI.prompt("Edit Price", "CHF", String(it.price || ""), "").then(function (p) {
            if (p === null) return;
            var np = Number(String(p).replace(",", "."));
            if (!isNaN(np)) it.price = np;

            UI.prompt("Edit Frequency", "Frequency", it.frequency || "", "").then(function (f) {
              if (f === null) return;
              it.frequency = (f || "").trim();
              State.saveEssentials(doc).then(function () { UI.toast("Saved"); openEssentialsCategory(container, doc, catId); });
            });
          });
        });
      });

      var right = UI.el("div", { className: "todo-right" }, []);
      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function () {
        UI.confirm("Delete Product", "Delete " + it.name + "?").then(function (ok) {
          if (!ok) return;
          cat.items = cat.items.filter(function (x) { return x.id !== it.id; });
          State.saveEssentials(doc).then(function () { UI.toast("Deleted"); openEssentialsCategory(container, doc, catId); });
        });
      });

      right.appendChild(del);
      row.appendChild(left);
      row.appendChild(right);
      card.appendChild(row);
      card.appendChild(UI.el("div", { style: "height:8px" }, []));
    });

    section.appendChild(card);
  }

  async function openRoutines(container) {
    removeSection(container, "maintenance-section");
    var section = UI.el("div", { id: "maintenance-section" }, []);
    container.appendChild(section);

    var doc = await State.getRoutines();
    doc.categories = Array.isArray(doc.categories) ? doc.categories : [];

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Routinen — Categories" }, []));

    var addCat = UI.el("button", { className: "btn", type: "button", text: "Add Category" }, []);
    addCat.addEventListener("click", function () {
      UI.prompt("New Category", "Name", "", "e.g. Morning Routine").then(function (name) {
        if (name === null) return;
        var n = name.trim();
        if (!n) return;
        doc.categories.push({ id: "c" + String(Date.now()), name: n, checklists: [] });
        State.saveRoutines(doc).then(function () { UI.toast("Saved"); openRoutines(container); });
      });
    });

    card.appendChild(UI.el("div", { style: "height:10px" }, []));
    card.appendChild(addCat);
    card.appendChild(UI.el("div", { style: "height:12px" }, []));

    if (!doc.categories.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No categories yet." }, []));
      section.appendChild(card);
      return;
    }

    doc.categories.forEach(function (cat) {
      var row = UI.el("div", { className: "mini-row" }, []);
      var btn = UI.el("button", { className: "btn", type: "button", text: cat.name }, []);
      btn.addEventListener("click", function () { openRoutineCategory(container, doc, cat.id); });

      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function () {
        UI.confirm("Delete Category", "Delete " + cat.name + "?").then(function (ok) {
          if (!ok) return;
          doc.categories = doc.categories.filter(function (c) { return c.id !== cat.id; });
          State.saveRoutines(doc).then(function () { UI.toast("Deleted"); openRoutines(container); });
        });
      });

      row.appendChild(btn);
      row.appendChild(del);
      card.appendChild(row);
      card.appendChild(UI.el("div", { style: "height:8px" }, []));
    });

    section.appendChild(card);
  }

  async function openRoutineCategory(container, doc, catId) {
    removeSection(container, "maintenance-section");
    var section = UI.el("div", { id: "maintenance-section" }, []);
    container.appendChild(section);

    var cat = doc.categories.filter(function (c) { return c.id === catId; })[0];
    if (!cat) { UI.toast("Category missing"); return; }
    cat.checklists = Array.isArray(cat.checklists) ? cat.checklists : [];

    var back = UI.el("button", { className: "btn", type: "button", text: "Back" }, []);
    back.addEventListener("click", function () { openRoutines(container); });
    section.appendChild(back);
    section.appendChild(UI.el("div", { style: "height:12px" }, []));

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Category: " + cat.name }, []));

    var addList = UI.el("button", { className: "btn", type: "button", text: "Add Checklist" }, []);
    addList.addEventListener("click", function () {
      UI.prompt("New Checklist", "Name", "", "e.g. Evening Reset").then(function (name) {
        if (name === null) return;
        var n = name.trim();
        if (!n) return;
        cat.checklists.push({ id: "l" + String(Date.now()), name: n, items: [] });
        State.saveRoutines(doc).then(function () { UI.toast("Saved"); openRoutineCategory(container, doc, catId); });
      });
    });

    card.appendChild(UI.el("div", { style: "height:10px" }, []));
    card.appendChild(addList);
    card.appendChild(UI.el("div", { style: "height:12px" }, []));

    if (!cat.checklists.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No checklists yet." }, []));
      section.appendChild(card);
      return;
    }

    cat.checklists.forEach(function (cl) {
      var btn = UI.el("button", { className: "btn", type: "button", text: cl.name }, []);
      btn.addEventListener("click", function () { openChecklist(container, doc, catId, cl.id); });

      card.appendChild(btn);
      card.appendChild(UI.el("div", { style: "height:8px" }, []));
    });

    section.appendChild(card);
  }

  async function openChecklist(container, doc, catId, listId) {
    removeSection(container, "maintenance-section");
    var section = UI.el("div", { id: "maintenance-section" }, []);
    container.appendChild(section);

    var cat = doc.categories.filter(function (c) { return c.id === catId; })[0];
    if (!cat) return;
    var cl = (cat.checklists || []).filter(function (x) { return x.id === listId; })[0];
    if (!cl) return;
    cl.items = Array.isArray(cl.items) ? cl.items : [];

    var back = UI.el("button", { className: "btn", type: "button", text: "Back" }, []);
    back.addEventListener("click", function () { openRoutineCategory(container, doc, catId); });
    section.appendChild(back);
    section.appendChild(UI.el("div", { style: "height:12px" }, []));

    var card = UI.el("div", { className: "card tile" }, []);
    card.appendChild(UI.el("div", { className: "tile__label", text: "Checklist: " + cl.name }, []));

    var addItem = UI.el("button", { className: "btn", type: "button", text: "Add Item" }, []);
    addItem.addEventListener("click", function () {
      UI.prompt("New Item", "Text", "", "e.g. Stretch 10min").then(function (txt) {
        if (txt === null) return;
        var t = txt.trim();
        if (!t) return;
        cl.items.push({ id: "i" + String(Date.now()), text: t, done: false });
        State.saveRoutines(doc).then(function () { UI.toast("Saved"); openChecklist(container, doc, catId, listId); });
      });
    });

    card.appendChild(UI.el("div", { style: "height:10px" }, []));
    card.appendChild(addItem);
    card.appendChild(UI.el("div", { style: "height:12px" }, []));

    if (!cl.items.length) {
      card.appendChild(UI.el("div", { className: "ui-text", text: "No items yet." }, []));
      section.appendChild(card);
      return;
    }

    cl.items.forEach(function (it) {
      var row = UI.el("div", { className: "todo-row" }, []);
      var left = UI.el("div", { className: "todo-left" }, []);
      var cb = UI.el("input", { type: "checkbox" }, []);
      cb.checked = !!it.done;
      cb.addEventListener("change", function () {
        it.done = cb.checked;
        State.saveRoutines(doc).then(function () { UI.toast("Saved"); });
      });
      left.appendChild(cb);

      var txt = UI.el("div", { className: "todo-text", text: it.text }, []);
      txt.addEventListener("click", function () {
        UI.prompt("Edit Item", "Text", it.text || "", "").then(function (v) {
          if (v === null) return;
          it.text = v.trim() || it.text;
          State.saveRoutines(doc).then(function () { UI.toast("Saved"); openChecklist(container, doc, catId, listId); });
        });
      });
      left.appendChild(txt);

      var right = UI.el("div", { className: "todo-right" }, []);
      var del = UI.el("button", { className: "btn btn-mini", type: "button", text: "Delete" }, []);
      del.addEventListener("click", function () {
        UI.confirm("Delete", "Delete item?").then(function (ok) {
          if (!ok) return;
          cl.items = cl.items.filter(function (x) { return x.id !== it.id; });
          State.saveRoutines(doc).then(function () { UI.toast("Deleted"); openChecklist(container, doc, catId, listId); });
        });
      });
      right.appendChild(del);

      row.appendChild(left);
      row.appendChild(right);
      card.appendChild(row);
      card.appendChild(UI.el("div", { style: "height:8px" }, []));
    });

    section.appendChild(card);
  }

  function removeSection(container, id) {
    var old = document.getElementById(id);
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function formatMoney(n) {
    var x = Number(n || 0);
    return x.toFixed(2);
  }
})();
