(function () {
  "use strict";

  ScreenRegistry.register("settings", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Settings (Technisch)" }, []);

      var box = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Version / Debug / Export / Import / Reset / Cache / SW (kommt in Batch 4)" }, []),
        UI.el("div", { className: "tile__value", text: "Platzhalter" }, [])
      ]);

      container.appendChild(title);
      container.appendChild(box);
    }
  });
})();
