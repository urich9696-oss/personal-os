(function () {
  "use strict";

  ScreenRegistry.register("dashboard", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var top = UI.el("div", { className: "grid-2" }, [
        tile("Performance (ToDos)", "0 offen"),
        tile("Next Block", "—"),
        tile("Budget Remaining", "CHF —"),
        tile("Gatekeeper", "0 aktiv")
      ]);

      var quickTitle = UI.el("div", { className: "section-title", text: "Quick Add" }, []);
      var select = UI.el("select", { className: "select", "aria-label": "Quick Add" }, [
        UI.el("option", { value: "", text: "Choose…" }, []),
        UI.el("option", { value: "newBlock", text: "Create new Block" }, []),
        UI.el("option", { value: "addTx", text: "Add Transaction" }, []),
        UI.el("option", { value: "addGatekeeper", text: "Add Gatekeeper" }, [])
      ]);

      select.addEventListener("change", function () {
        var v = select.value;
        select.value = "";
        if (!v) return;

        if (v === "newBlock") Router.go("path", { action: "newBlock" });
        if (v === "addTx") Router.go("finance", { action: "addTx" });
        if (v === "addGatekeeper") Router.go("finance", { action: "addGatekeeper" });
      });

      var journalBtn = UI.el("button", { className: "btn", type: "button", text: "Start Journal" }, []);
      journalBtn.addEventListener("click", function () {
        Router.go("alignment", { action: "startJournal" });
      });

      var wrap = UI.el("div", {}, [
        top,
        quickTitle,
        UI.el("div", { className: "card tile" }, [select]),
        UI.el("div", { style: "height:12px" }, []),
        journalBtn
      ]);

      container.appendChild(wrap);
    }
  });

  function tile(label, value) {
    return UI.el("div", { className: "card tile" }, [
      UI.el("div", { className: "tile__label", text: label }, []),
      UI.el("div", { className: "tile__value", text: value }, [])
    ]);
  }
})();
