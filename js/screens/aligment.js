(function () {
  "use strict";

  ScreenRegistry.register("alignment", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Alignment" }, []);

      var card = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Journal + Vault (kommt in Batch 3)" }, []),
        UI.el("div", { className: "tile__value", text: "Platzhalter" }, [])
      ]);

      var hint = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Aktion" }, []),
        UI.el("div", { className: "tile__value", text: (ctx && ctx.params && ctx.params.action) ? ctx.params.action : "—" }, [])
      ]);

      container.appendChild(title);
      container.appendChild(card);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));
      container.appendChild(hint);
    }
  });
})();
