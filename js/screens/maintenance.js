(function () {
  const R = () => window.POS && window.POS.registry;
  const U = () => window.POS && window.POS.ui;

  function factory() {
    return async function mountMaintenance(ctx) {
      const ui = U();
      ctx.root.innerHTML = "";
      ctx.root.appendChild(ui.el("div", { class: "screen-title" }, "Maintenance"));

      ctx.root.appendChild(ui.el("section", { class: "widget" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Essentials"),
          ui.el("div", { class: "widget-meta" }, "MVP later")
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "meta" }, "Recurring products + categories will be implemented after core stability.")
        ])
      ]));

      ctx.root.appendChild(ui.el("section", { class: "widget" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Self Care"),
          ui.el("div", { class: "widget-meta" }, "MVP later")
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "meta" }, "Habits + reminders will be implemented after core stability.")
        ])
      ]));

      ctx.root.appendChild(ui.el("section", { class: "widget" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Health"),
          ui.el("div", { class: "widget-meta" }, "Post-MVP")
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "meta" }, "Training / nutrition / supplements — after MVP core is stable.")
        ])
      ]));
    };
  }

  R().register("maintenance", factory);
})();
