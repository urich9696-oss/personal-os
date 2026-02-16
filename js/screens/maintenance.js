(function () {
  "use strict";

  ScreenRegistry.register("maintenance", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Maintenance (Human)" }, []);

      var essentials = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Essentials" }, []),
        UI.el("div", { className: "tile__value", text: "Platzhalter" }, [])
      ]);

      var routines = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Routinen" }, []),
        UI.el("div", { className: "tile__value", text: "Platzhalter" }, [])
      ]);

      container.appendChild(title);
      container.appendChild(essentials);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));
      container.appendChild(routines);
    }
  });
})();
