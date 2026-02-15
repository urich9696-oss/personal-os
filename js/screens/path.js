(function () {
  const R = () => window.POS && window.POS.registry;
  const S = () => window.POS && window.POS.state;
  const U = () => window.POS && window.POS.ui;

  function ensureJournal(entry, date) {
    if (entry) return entry;
    return {
      date: date,
      morning: { lookingForward: "", planning: "", todos: [] },
      evening: { reflection: "", rating: "", gratitude: "" },
      closedAt: null
    };
  }

  function factory() {
    return async function mountPath(ctx) {
      const ui = U();
      const date = ui.isoDate(new Date());

      async function render() {
        let entry = null;
        try { entry = await S().getJournal(date); } catch (_) {}
        entry = ensureJournal(entry, date);

        const todos = (entry.morning && entry.morning.todos) ? entry.morning.todos : [];
        const done = todos.filter((t) => t.done).length;
        const total = todos.length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);

        ctx.root.innerHTML = "";
        ctx.root.appendChild(ui.el("div", { class: "screen-title" }, "Today’s Path"));

        ctx.root.appendChild(ui.el("section", { class: "widget" }, [
          ui.el("div", { class: "widget-head" }, [
            ui.el("div", { class: "widget-title" }, "To-Dos"),
            ui.el("div", { class: "widget-meta" }, "Performance")
          ]),
          ui.el("div", { class: "widget-body" }, [
            ui.el("div", { class: "col" }, [
              ui.el("div", { class: "kpi-row" }, [
                ui.el("div", { class: "kpi-label" }, "Performance"),
                ui.el("div", { class: "kpi-value" }, pct + "%")
              ]),
              ui.el("div", { class: "meta" }, "Create To-Dos in Mindset → Journal."),
              ui.el("div", { class: "divider" }),
              total === 0
                ? ui.el("div", { class: "meta" }, "No To-Dos yet.")
                : ui.el("div", { class: "list" }, todos.map((t) => {
                    return ui.el("div", { class: "card row" }, [
                      ui.el("input", {
                        type: "checkbox",
                        checked: t.done ? "checked" : null,
                        onchange: async (e) => {
                          t.done = e.target.checked;
                          try { await S().putJournal(entry); } catch (err) { console.error(err); ui.toast("Save failed"); }
                          await render();
                        }
                      }),
                      ui.el("div", { style: "flex:1" }, [
                        ui.el("div", {}, t.text),
                        ui.el("div", { class: "meta small" }, t.done ? "Done" : "Open")
                      ])
                    ]);
                  }))
            ])
          ])
        ]));

        ctx.root.appendChild(ui.el("section", { class: "widget" }, [
          ui.el("div", { class: "widget-head" }, [
            ui.el("div", { class: "widget-title" }, "Calendar Quick View"),
            ui.el("div", { class: "widget-meta" }, "Today")
          ]),
          ui.el("div", { class: "widget-body" }, [
            ui.el("div", { class: "meta" }, "Add blocks from Dashboard. (Full editor later)")
          ])
        ]));

        ctx.root.appendChild(ui.el("section", { class: "widget" }, [
          ui.el("div", { class: "widget-head" }, [
            ui.el("div", { class: "widget-title" }, "Templates"),
            ui.el("div", { class: "widget-meta" }, "Later")
          ]),
          ui.el("div", { class: "widget-body" }, [
            ui.el("div", { class: "meta" }, "Template management will come after the navigation base is rock-solid.")
          ])
        ]));
      }

      await render();
    };
  }

  R().register("path", factory);
})();
