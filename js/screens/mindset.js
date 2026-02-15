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
    return async function mountMindset(ctx) {
      const ui = U();
      const date = ui.isoDate(new Date());

      let entry = null;
      try { entry = await S().getJournal(date); } catch (_) {}
      entry = ensureJournal(entry, date);

      async function save() {
        try { await S().putJournal(entry); } catch (e) { console.error(e); ui.toast("Save failed"); }
      }

      const journalAnchor = ui.el("div", { id: "journalAnchor" });
      const journalWidget = ui.el("section", { class: "widget", id: "mindsetJournal" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Journal"),
          ui.el("div", { class: "widget-meta" }, "6-Minute Style (MVP)")
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "col" }, [
            ui.el("div", { class: "meta" }, "Minimal in this iteration. Add To-Dos here, complete them in Today’s Path."),
            ui.el("div", { class: "divider" }),
            ui.el("div", { class: "badge" }, "To-Dos"),
            ui.el("div", { class: "row" }, [
              ui.el("input", { class: "input", id: "msTodoText", placeholder: "New To-Do…" }),
              ui.el("button", {
                class: "btn primary",
                onclick: async (e) => {
                  e.preventDefault();
                  const inp = document.getElementById("msTodoText");
                  const txt = (inp.value || "").trim();
                  if (!txt) return;
                  entry.morning.todos.push({ id: ui.uid(), text: txt, done: false });
                  inp.value = "";
                  await save();
                  ui.toast("To-Do saved");
                }
              }, "Add")
            ])
          ])
        ])
      ]);

      const calendarWidget = ui.el("section", { class: "widget" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Calendar"),
          ui.el("div", { class: "widget-meta" }, "Blocks (MVP later)")
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "meta" }, "Use Dashboard → Add Calendar Block (already working).")
        ])
      ]);

      const vaultWidget = ui.el("section", { class: "widget" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Vault"),
          ui.el("div", { class: "widget-meta" }, "Archive (later)")
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "meta" }, "Close Day will create snapshots later. Stub for now.")
        ])
      ]);

      ctx.root.appendChild(ui.el("div", { class: "screen-title" }, "Mindset"));
      ctx.root.appendChild(journalAnchor);
      ctx.root.appendChild(journalWidget);
      ctx.root.appendChild(calendarWidget);
      ctx.root.appendChild(vaultWidget);

      // Focus from Dashboard quick action
      if (ctx.params && ctx.params.focus === "journal") {
        try {
          setTimeout(() => {
            const a = document.getElementById("mindsetJournal");
            if (a && a.scrollIntoView) a.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 80);
        } catch (_) {}
      }
    };
  }

  R().register("mindset", factory);
})();
