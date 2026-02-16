(function () {
  "use strict";

  ScreenRegistry.register("vault", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Vault (Archiv)" }, []);

      var box = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Read-only Archiv (Batch 3)" }, []),
        UI.el("div", { className: "tile__value", text: "Platzhalter" }, [])
      ]);

      container.appendChild(title);
      container.appendChild(box);
    }
  });
})();
