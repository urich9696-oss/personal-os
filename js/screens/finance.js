(function () {
  "use strict";

  ScreenRegistry.register("finance", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Finance" }, []);

      var month = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Monatslogik + Remaining + Reports + Gatekeeper (Batch 3)" }, []),
        UI.el("div", { className: "tile__value", text: "Platzhalter" }, [])
      ]);

      var action = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Aktion" }, []),
        UI.el("div", { className: "tile__value", text: (ctx && ctx.params && ctx.params.action) ? ctx.params.action : "—" }, [])
      ]);

      container.appendChild(title);
      container.appendChild(month);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));
      container.appendChild(action);
    }
  });
})();
