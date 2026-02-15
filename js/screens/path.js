(function () {
  const { db, ui } = window.PersonalOS;
  const { el, isoDate } = ui;

  window.PersonalOS.screens = window.PersonalOS.screens || {};
  window.PersonalOS.screens.path = async function mountPath() {
    const todosHost = document.getElementById("path-todos");
    const calHost = document.getElementById("path-calendar");
    const tplHost = document.getElementById("path-templates");
    const date = isoDate();

    async function loadEntry() {
      const entry = await db.getJournal(date);
      if (!entry) {
        return { date, morning: { lookingForward: "", planning: "", todos: [] }, evening: { reflection: "", rating: "", gratitude: "" }, closedAt: null };
      }
      return entry;
    }

    async function render() {
      const entry = await loadEntry();
      const todos = entry.morning.todos || [];
      const done = todos.filter((t) => t.done).length;
      const pct = todos.length === 0 ? 0 : Math.round((done / todos.length) * 100);

      todosHost.innerHTML = "";
      todosHost.appendChild(
        el("div", { class: "col" }, [
          el("div", { class: "kpi-row" }, [
            el("div", { class: "kpi-label" }, "Performance"),
            el("div", { class: "kpi-value" }, `${pct}%`)
          ]),
          el("div", { class: "meta" }, "To-Do’s are created in Journal. Complete them here."),
          el("div", { class: "divider" }),
          todos.length === 0
            ? el("div", { class: "meta" }, "No To-Do’s yet. Add some in Mindset → Journal.")
            : el("div", { class: "list" }, todos.map((t) =>
                el("div", { class: "card row" }, [
                  el("input", {
                    type: "checkbox",
                    checked: t.done ? "checked" : null,
                    onchange: async (e) => {
                      t.done = e.target.checked;
                      await db.putJournal(entry);
                      await render();
                    }
                  }),
                  el("div", { style: "flex:1" }, [
                    el("div", {}, t.text),
                    el("div", { class: "meta small" }, t.done ? "Done" : "Open")
                  ])
                ])
              ))
        ])
      );

      calHost.innerHTML = "";
      const blocks = await db.listBlocks(date);
      calHost.appendChild(
        el("div", { class: "col" }, [
          el("div", { class: "meta" }, `Date: ${date}`),
          blocks.length === 0 ? el("div", { class: "meta" }, "No blocks yet. Add in Mindset → Calendar or below.") :
            el("div", { class: "list" }, blocks.map((b) => el("div", { class: "card" }, `${b.start}–${b.end} · ${b.title}`))),
          el("div", { class: "divider" }),
          el("div", { class: "row" }, [
            el("input", { class: "input", id: "qStart", placeholder: "Start (HH:MM)" }),
            el("input", { class: "input", id: "qEnd", placeholder: "End (HH:MM)" })
          ]),
          el("input", { class: "input", id: "qTitle", placeholder: "Title" }),
          el("button", {
            class: "btn primary",
            onclick: async () => {
              const start = (document.getElementById("qStart").value || "").trim();
              const end = (document.getElementById("qEnd").value || "").trim();
              const title = (document.getElementById("qTitle").value || "").trim();
              if (!start || !end || !title) return;
              await db.addBlock({ date, start, end, title });
              document.getElementById("qStart").value = "";
              document.getElementById("qEnd").value = "";
              document.getElementById("qTitle").value = "";
              await render();
            }
          }, "Add Block")
        ])
      );

      tplHost.innerHTML = "";
      const templates = await db.listTemplates();

      tplHost.appendChild(
        el("div", { class: "col" }, [
          el("div", { class: "meta" }, "Apply template adds its blocks to today (does not delete existing)."),
          templates.length === 0
            ? el("div", { class: "meta" }, "No templates yet. Create one below.")
            : el("div", { class: "list" }, templates.map((t) =>
                el("div", { class: "card col" }, [
                  el("div", {}, t.name),
                  el("div", { class: "meta small" }, `${t.blocks.length} blocks`),
                  el("div", { class: "row" }, [
                    el("button", { class: "btn primary", onclick: async () => { await db.applyTemplateToDate(t, date); await render(); } }, "Apply to Today"),
                    el("button", { class: "btn danger", onclick: async () => { await db.deleteTemplate(t.id); await render(); } }, "Delete")
                  ])
                ])
              )),
          el("div", { class: "divider" }),
          el("div", { class: "badge" }, "Create Template"),
          el("input", { class: "input", id: "tplName", placeholder: "Template name (e.g. Weekday + Sport)" }),
          el("div", { class: "row" }, [
            el("input", { class: "input", id: "tplStart", placeholder: "Start (HH:MM)" }),
            el("input", { class: "input", id: "tplEnd", placeholder: "End (HH:MM)" })
          ]),
          el("input", { class: "input", id: "tplTitle", placeholder: "Block title" }),
          el("button", {
            class: "btn",
            onclick: () => {
              const name = (document.getElementById("tplName").value || "").trim();
              if (!name) return;
              window.__tplDraft = window.__tplDraft || { name, blocks: [] };
              window.__tplDraft.name = name;

              const start = (document.getElementById("tplStart").value || "").trim();
              const end = (document.getElementById("tplEnd").value || "").trim();
              const title = (document.getElementById("tplTitle").value || "").trim();
              if (!start || !end || !title) return;

              window.__tplDraft.blocks.push({ start, end, title });
              document.getElementById("tplStart").value = "";
              document.getElementById("tplEnd").value = "";
              document.getElementById("tplTitle").value = "";
              alert(`Block added to draft: ${window.__tplDraft.blocks.length}`);
            }
          }, "Add block to draft"),
          el("button", {
            class: "btn primary",
            onclick: async () => {
              const draft = window.__tplDraft;
              if (!draft || !draft.name || !draft.blocks || draft.blocks.length === 0) return;
              await db.addTemplate({ name: draft.name, blocks: draft.blocks });
              window.__tplDraft = null;
              document.getElementById("tplName").value = "";
              await render();
            }
          }, "Save Template")
        ])
      );
    }

    await render();
  };
})();
