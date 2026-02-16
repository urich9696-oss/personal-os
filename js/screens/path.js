(function () {
  "use strict";

  ScreenRegistry.register("path", {
    mount: async function (container, ctx) {
      container.innerHTML = "";

      var title = UI.el("div", { className: "section-title", text: "Today’s Path" }, []);

      var calendar = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "Kalender (Tag/Woche) + Blocks + Templates (Batch 3)" }, []),
        UI.el("div", { className: "tile__value", text: "Platzhalter" }, [])
      ]);

      var todos = UI.el("div", { className: "card tile" }, [
        UI.el("div", { className: "tile__label", text: "ToDos aus Morning Journal (Batch 3)" }, []),
        UI.el("div", { className: "tile__value", text: "Platzhalter" }, [])
      ]);

      container.appendChild(title);
      container.appendChild(calendar);
      container.appendChild(UI.el("div", { style: "height:12px" }, []));
      container.appendChild(todos);
    }
  });
})();
