(function () {
  "use strict";

  ScreenRegistry.register("maintenance", {
    mount: async function (container) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Maintenance" }, []);
      container.appendChild(title);

      // Essentials Card
      var essentialsCard = UI.el("div", { className: "card tile" }, []);
      essentialsCard.appendChild(UI.el("div", { className: "tile__label", text: "Essentials" }, []));
      essentialsCard.appendChild(UI.el("div", { className: "ui-text", text: "Kategorien → Produkte/Items. Optional mit Bild." }, []));
      essentialsCard.appendChild(UI.el("div", { style: "height:10px" }, []));

      var eRow = UI.el("div", { className: "row" }, []);
      var eAddCat = UI.el("button", { className: "btn", type: "button", text: "Add Category" }, []);
      eAddCat.addEventListener("click", function () { essentialsAddCategoryFlow(); });

      var eManage = UI.el("button", { className: "btn", type: "button", text: "Open" }, []);
      eManage.addEventListener("click", function () { openEssentialsManager(); });

      eRow.appendChild(eAddCat);
      eRow.appendChild(eManage);
      essentialsCard.appendChild(eRow);

      container.appendChild(essentialsCard);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));

      // Routines Card
      var routinesCard = UI.el("div", { className: "card tile" }, []);
      routinesCard.appendChild(UI.el("div", { className: "tile__label", text: "Routinen" }, []));
      routinesCard.appendChild(UI.el("div", { className: "ui-text", text: "Kategorien → Checklisten → Abhaken." }, []));
      routinesCard.appendChild(UI.el("div", { style: "height:10px" }, []));

      var rRow = UI.el("div", { className: "row" }, []);
      var rAddCat = UI.el("button", { className: "btn", type: "button", text: "Add Category" }, []);
      rAddCat.addEventListener("click", function () { routinesAddCategoryFlow(); });

      var rManage = UI.el("button", { className: "btn", type: "button", text: "Open" }, []);
      rManage.addEventListener("click", function () { openRoutinesManager(); });

      rRow.appendChild(rAddCat);
      rRow.appendChild(rManage);
      routinesCard.appendChild(rRow);

      container.appendChild(routinesCard);
    }
  });

  // ---------------- Essentials ----------------
  async function essentialsAddCategoryFlow() {
    var name = await UI.prompt("Essentials", "Category name", "", "e.g. Hygiene");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    await State.essentialsAddCategory(name);
    UI.toast("Category added");
    Router.go("maintenance", {});
  }

  async function openEssentialsManager() {
    var cats = await State.essentialsListCategories();
    if (!cats.length) { UI.toast("No categories"); return; }

    var pick = await UI.prompt("Essentials", "Open category (exact name)", cats[0].name, "");
    if (pick === null) return;
    pick = pick.trim();

    var cat = null;
    for (var i = 0; i < cats.length; i++) if (cats[i].name === pick) { cat = cats[i]; break; }
    if (!cat) { UI.toast("Not found"); return; }

    await essentialsCategoryMenu(cat);
  }

  async function essentialsCategoryMenu(cat) {
    UI.modal({
      title: "Essentials: " + cat.name,
      bodyHtml:
        "<div class='ui-text'>Choose:</div>" +
        "<div style='height:10px'></div>" +
        "<div class='ui-text'>• Add Item</div>" +
        "<div class='ui-text'>• List Items</div>" +
        "<div class='ui-text'>• Rename Category</div>" +
        "<div class='ui-text'>• Delete Category</div>",
      buttons: [
        { text: "Add Item", value: "add", primary: true },
        { text: "List Items", value: "list" },
        { text: "Rename", value: "rename" },
        { text: "Delete", value: "delete" },
        { text: "Close", value: "close" }
      ],
      onClose: function (v) {
        if (v === "add") essentialsAddItemFlow(cat.id);
        if (v === "list") essentialsListItemsFlow(cat.id, cat.name);
        if (v === "rename") essentialsRenameCategoryFlow(cat.id, cat.name);
        if (v === "delete") essentialsDeleteCategoryFlow(cat.id, cat.name);
      }
    });
  }

  async function essentialsRenameCategoryFlow(categoryId, oldName) {
    var name = await UI.prompt("Rename Category", "New name", oldName, "");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    await State.essentialsRenameCategory(categoryId, name);
    UI.toast("Renamed");
    Router.go("maintenance", {});
  }

  async function essentialsDeleteCategoryFlow(categoryId, name) {
    var ok = await UI.confirm("Delete Category", "Delete '" + name + "' and all its items?");
    if (!ok) return;

    await State.essentialsDeleteCategory(categoryId);
    UI.toast("Deleted");
    Router.go("maintenance", {});
  }

  async function essentialsAddItemFlow(categoryId) {
    var name = await UI.prompt("Add Item", "Name", "", "e.g. Shampoo");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    var priceStr = await UI.prompt("Add Item", "Price (CHF)", "0", "12.90");
    if (priceStr === null) return;
    var price = Number(String(priceStr).replace(",", "."));
    if (isNaN(price)) { UI.toast("Invalid price"); return; }

    var freq = await UI.prompt("Add Item", "Frequenz", "", "e.g. monthly / weekly");
    if (freq === null) return;

    var usage = await UI.prompt("Add Item", "Nutzung (optional)", "", "optional");
    if (usage === null) return;

    var addImage = await UI.confirm("Image", "Add an optional image from Photos?");
    var imageDataUrl = null;
    if (addImage) {
      imageDataUrl = await pickImageDataUrl();
      if (imageDataUrl === "__CANCEL__") return;
      if (imageDataUrl === "__NOFILE__") imageDataUrl = null;
    }

    await State.essentialsAddItem(categoryId, {
      name: name,
      price: price,
      frequency: String(freq || "").trim(),
      usage: String(usage || "").trim(),
      imageDataUrl: imageDataUrl
    });

    UI.toast("Item added");
    Router.go("maintenance", {});
  }

  async function essentialsListItemsFlow(categoryId, categoryName) {
    // We don't have a direct API to fetch items list only; simplest: list categories and find it again
    var cats = await State.essentialsListCategories();
    var cat = null;
    for (var i = 0; i < cats.length; i++) if (cats[i].id === categoryId) { cat = cats[i]; break; }
    if (!cat) { UI.toast("Category missing"); return; }
    var items = Array.isArray(cat.items) ? cat.items : [];

    if (!items.length) {
      UI.toast("No items");
      return;
    }

    var html = "<div class='ui-text'><b>" + UI.escapeHtml(categoryName) + "</b></div><div style='height:10px'></div>";
    for (var j = 0; j < items.length; j++) {
      html += "<div class='ui-text'>• " + UI.escapeHtml(items[j].name || "—") + " · CHF " + formatMoney(items[j].price) + "</div>";
    }
    html += "<div style='height:10px'></div><div class='ui-text'>Enter exact item name to edit:</div>";

    var pick = await UI.prompt("Essentials Items", "Item name", items[0].name || "", "");
    if (pick === null) return;
    pick = pick.trim();

    var it = null;
    for (var k = 0; k < items.length; k++) if (items[k].name === pick) { it = items[k]; break; }
    if (!it) { UI.toast("Not found"); return; }

    await essentialsItemMenu(categoryId, it);
  }

  async function essentialsItemMenu(categoryId, it) {
    var hasImg = !!it.imageDataUrl;
    var imgHtml = hasImg
      ? "<div style='height:10px'></div><img alt='item' src='" + it.imageDataUrl + "' style='width:100%;max-height:180px;object-fit:cover;border-radius:12px' />"
      : "";

    UI.modal({
      title: "Item",
      bodyHtml:
        "<div class='ui-text'><b>" + UI.escapeHtml(it.name || "—") + "</b></div>" +
        "<div class='ui-text'>CHF " + formatMoney(it.price) + "</div>" +
        "<div class='ui-text'>Freq: " + UI.escapeHtml(it.frequency || "—") + "</div>" +
        "<div class='ui-text'>Use: " + UI.escapeHtml(it.usage || "—") + "</div>" +
        imgHtml,
      buttons: [
        { text: "Edit", value: "edit", primary: true },
        { text: "Delete", value: "delete" },
        { text: "Close", value: "close" }
      ],
      onClose: function (v) {
        if (v === "edit") essentialsEditItemFlow(categoryId, it);
        if (v === "delete") essentialsDeleteItemFlow(categoryId, it);
      }
    });
  }

  async function essentialsEditItemFlow(categoryId, it) {
    var name = await UI.prompt("Edit Item", "Name", it.name || "", "");
    if (name === null) return;

    var priceStr = await UI.prompt("Edit Item", "Price (CHF)", String(it.price || 0), "");
    if (priceStr === null) return;
    var price = Number(String(priceStr).replace(",", "."));
    if (isNaN(price)) { UI.toast("Invalid price"); return; }

    var freq = await UI.prompt("Edit Item", "Frequenz", it.frequency || "", "");
    if (freq === null) return;

    var usage = await UI.prompt("Edit Item", "Nutzung (optional)", it.usage || "", "");
    if (usage === null) return;

    var changeImg = await UI.confirm("Image", "Change / set image?");
    var imageDataUrl = undefined; // keep if not changed
    if (changeImg) {
      var picked = await pickImageDataUrl();
      if (picked === "__CANCEL__") return;
      if (picked === "__NOFILE__") imageDataUrl = null;
      else imageDataUrl = picked;
    }

    await State.essentialsUpdateItem(categoryId, {
      id: it.id,
      name: (name || "").trim(),
      price: price,
      frequency: String(freq || "").trim(),
      usage: String(usage || "").trim(),
      imageDataUrl: imageDataUrl
    });

    UI.toast("Saved");
    Router.go("maintenance", {});
  }

  async function essentialsDeleteItemFlow(categoryId, it) {
    var ok = await UI.confirm("Delete Item", "Delete '" + (it.name || "item") + "'?");
    if (!ok) return;
    await State.essentialsDeleteItem(categoryId, it.id);
    UI.toast("Deleted");
    Router.go("maintenance", {});
  }

  // Reads one image file and converts to DataURL (stored in IndexedDB)
  async function pickImageDataUrl() {
    return new Promise(function (resolve) {
      // Build a temporary modal-like UI using UI.modal and then inject file input
      var body = document.createElement("div");
      body.className = "ui-text";
      body.innerHTML = "Select an image file (stored locally).";

      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.width = "100%";
      input.style.marginTop = "10px";

      body.appendChild(input);

      UI.modal({
        title: "Pick Image",
        bodyHtml: body.outerHTML,
        buttons: [
          { text: "Cancel", value: "cancel" },
          { text: "Use Image", value: "use", primary: true }
        ],
        onClose: function (v) {
          // We need the real input node; easiest reliable method: re-query in DOM
          var modal = document.querySelector(".modal");
          var realInput = modal ? modal.querySelector("input[type='file']") : null;

          if (v !== "use") { resolve("__CANCEL__"); return; }
          if (!realInput || !realInput.files || !realInput.files[0]) { resolve("__NOFILE__"); return; }

          var file = realInput.files[0];
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result || "")); };
          reader.onerror = function () { resolve("__NOFILE__"); };
          reader.readAsDataURL(file);
        }
      });
    });
  }

  // ---------------- Routinen ----------------
  async function routinesAddCategoryFlow() {
    var name = await UI.prompt("Routinen", "Category name", "", "e.g. Morning");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    await State.routinesAddCategory(name);
    UI.toast("Category added");
    Router.go("maintenance", {});
  }

  async function openRoutinesManager() {
    var cats = await State.routinesListCategories();
    if (!cats.length) { UI.toast("No categories"); return; }

    var pick = await UI.prompt("Routinen", "Open category (exact name)", cats[0].name, "");
    if (pick === null) return;
    pick = pick.trim();

    var cat = null;
    for (var i = 0; i < cats.length; i++) if (cats[i].name === pick) { cat = cats[i]; break; }
    if (!cat) { UI.toast("Not found"); return; }

    routinesCategoryMenu(cat);
  }

  function routinesCategoryMenu(cat) {
    UI.modal({
      title: "Routinen: " + cat.name,
      bodyHtml:
        "<div class='ui-text'>Choose:</div>" +
        "<div style='height:10px'></div>" +
        "<div class='ui-text'>• Add Checklist</div>" +
        "<div class='ui-text'>• Open Checklist</div>" +
        "<div class='ui-text'>• Rename Category</div>" +
        "<div class='ui-text'>• Delete Category</div>",
      buttons: [
        { text: "Add Checklist", value: "add", primary: true },
        { text: "Open Checklist", value: "open" },
        { text: "Rename", value: "rename" },
        { text: "Delete", value: "delete" },
        { text: "Close", value: "close" }
      ],
      onClose: function (v) {
        if (v === "add") routinesAddChecklistFlow(cat.id);
        if (v === "open") routinesOpenChecklistFlow(cat.id, cat.name);
        if (v === "rename") routinesRenameCategoryFlow(cat.id, cat.name);
        if (v === "delete") routinesDeleteCategoryFlow(cat.id, cat.name);
      }
    });
  }

  async function routinesRenameCategoryFlow(categoryId, oldName) {
    var name = await UI.prompt("Rename Category", "New name", oldName, "");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    await State.routinesRenameCategory(categoryId, name);
    UI.toast("Renamed");
    Router.go("maintenance", {});
  }

  async function routinesDeleteCategoryFlow(categoryId, name) {
    var ok = await UI.confirm("Delete Category", "Delete '" + name + "' and all checklists?");
    if (!ok) return;

    await State.routinesDeleteCategory(categoryId);
    UI.toast("Deleted");
    Router.go("maintenance", {});
  }

  async function routinesAddChecklistFlow(categoryId) {
    var name = await UI.prompt("Add Checklist", "Name", "", "e.g. Morning Core");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    await State.routinesAddChecklist(categoryId, name);
    UI.toast("Checklist added");
    Router.go("maintenance", {});
  }

  async function routinesOpenChecklistFlow(categoryId, categoryName) {
    var cats = await State.routinesListCategories();
    var cat = null;
    for (var i = 0; i < cats.length; i++) if (cats[i].id === categoryId) { cat = cats[i]; break; }
    if (!cat) { UI.toast("Category missing"); return; }

    var cls = Array.isArray(cat.checklists) ? cat.checklists : [];
    if (!cls.length) { UI.toast("No checklists"); return; }

    var pick = await UI.prompt("Open Checklist", "Exact name", cls[0].name, "");
    if (pick === null) return;
    pick = pick.trim();

    var cl = null;
    for (var j = 0; j < cls.length; j++) if (cls[j].name === pick) { cl = cls[j]; break; }
    if (!cl) { UI.toast("Not found"); return; }

    await checklistScreen(categoryId, categoryName, cl.id, cl.name);
  }

  async function checklistScreen(categoryId, categoryName, checklistId, checklistName) {
    // Render a simple "sub-screen" in a modal for speed (no router changes)
    var cats = await State.routinesListCategories();
    var cat = null;
    for (var i = 0; i < cats.length; i++) if (cats[i].id === categoryId) { cat = cats[i]; break; }
    if (!cat) { UI.toast("Missing"); return; }
    var cl = null;
    for (var j = 0; j < (cat.checklists || []).length; j++) if (cat.checklists[j].id === checklistId) { cl = cat.checklists[j]; break; }
    if (!cl) { UI.toast("Missing checklist"); return; }

    var items = Array.isArray(cl.items) ? cl.items : [];
    var body = "<div class='ui-text'><b>" + UI.escapeHtml(categoryName) + " / " + UI.escapeHtml(checklistName) + "</b></div>";
    body += "<div style='height:10px'></div>";

    if (!items.length) {
      body += "<div class='ui-text'>No items yet.</div>";
    } else {
      for (var k = 0; k < items.length; k++) {
        body += "<div class='ui-text'>[" + (items[k].done ? "x" : " ") + "] " + UI.escapeHtml(items[k].text) + "</div>";
      }
      body += "<div style='height:10px'></div><div class='ui-text'>Enter exact item text to toggle/delete:</div>";
    }

    UI.modal({
      title: "Checklist",
      bodyHtml: body,
      buttons: [
        { text: "Add Item", value: "add", primary: true },
        { text: "Toggle Item", value: "toggle" },
        { text: "Delete Item", value: "delItem" },
        { text: "Reset", value: "reset" },
        { text: "Rename", value: "rename" },
        { text: "Delete Checklist", value: "delChecklist" },
        { text: "Close", value: "close" }
      ],
      onClose: function (v) {
        if (v === "add") routinesAddChecklistItemFlow(categoryId, checklistId, checklistName);
        if (v === "toggle") routinesToggleItemFlow(categoryId, checklistId, items);
        if (v === "delItem") routinesDeleteItemFlow(categoryId, checklistId, items);
        if (v === "reset") routinesResetChecklistFlow(categoryId, checklistId);
        if (v === "rename") routinesRenameChecklistFlow(categoryId, checklistId, checklistName);
        if (v === "delChecklist") routinesDeleteChecklistFlow(categoryId, checklistId, checklistName);
      }
    });
  }

  async function routinesAddChecklistItemFlow(categoryId, checklistId, checklistName) {
    var text = await UI.prompt("Add Item", "Text", "", "e.g. Water 500ml");
    if (text === null) return;
    text = text.trim();
    if (!text) return;

    await State.routinesAddChecklistItem(categoryId, checklistId, text);
    UI.toast("Item added");
    Router.go("maintenance", {});
  }

  async function routinesToggleItemFlow(categoryId, checklistId, items) {
    if (!items || !items.length) { UI.toast("No items"); return; }
    var pick = await UI.prompt("Toggle Item", "Exact text", items[0].text, "");
    if (pick === null) return;
    pick = pick.trim();

    var it = null;
    for (var i = 0; i < items.length; i++) if (items[i].text === pick) { it = items[i]; break; }
    if (!it) { UI.toast("Not found"); return; }

    await State.routinesToggleChecklistItem(categoryId, checklistId, it.id);
    UI.toast("Toggled");
    Router.go("maintenance", {});
  }

  async function routinesDeleteItemFlow(categoryId, checklistId, items) {
    if (!items || !items.length) { UI.toast("No items"); return; }
    var pick = await UI.prompt("Delete Item", "Exact text", items[0].text, "");
    if (pick === null) return;
    pick = pick.trim();

    var it = null;
    for (var i = 0; i < items.length; i++) if (items[i].text === pick) { it = items[i]; break; }
    if (!it) { UI.toast("Not found"); return; }

    var ok = await UI.confirm("Delete", "Delete '" + it.text + "'?");
    if (!ok) return;

    await State.routinesDeleteChecklistItem(categoryId, checklistId, it.id);
    UI.toast("Deleted");
    Router.go("maintenance", {});
  }

  async function routinesResetChecklistFlow(categoryId, checklistId) {
    var ok = await UI.confirm("Reset", "Set all items to unchecked?");
    if (!ok) return;
    await State.routinesResetChecklist(categoryId, checklistId);
    UI.toast("Reset");
    Router.go("maintenance", {});
  }

  async function routinesRenameChecklistFlow(categoryId, checklistId, oldName) {
    var name = await UI.prompt("Rename Checklist", "New name", oldName, "");
    if (name === null) return;
    name = name.trim();
    if (!name) return;

    await State.routinesRenameChecklist(categoryId, checklistId, name);
    UI.toast("Renamed");
    Router.go("maintenance", {});
  }

  async function routinesDeleteChecklistFlow(categoryId, checklistId, name) {
    var ok = await UI.confirm("Delete Checklist", "Delete '" + name + "'?");
    if (!ok) return;
    await State.routinesDeleteChecklist(categoryId, checklistId);
    UI.toast("Deleted");
    Router.go("maintenance", {});
  }

  function formatMoney(n) {
    var x = Number(n || 0);
    return x.toFixed(2);
  }
})();
