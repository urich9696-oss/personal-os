import { db } from "../db.js";
import { el, isoDate } from "../ui.js";

function ensureJournalShape(entry, date) {
  if (entry) return entry;
  return {
    date,
    morning: { lookingForward: "", planning: "", todos: [] },
    evening: { reflection: "", rating: "", gratitude: "" },
    closedAt: null
  };
}

function renderTodoList(entry, onChange) {
  const list = el("div", { class: "list" });

  entry.morning.todos.forEach((t) => {
    const row = el("div", { class: "card row" }, [
      el("input", {
        type: "checkbox",
        checked: t.done ? "checked" : null,
        onchange: (e) => {
          t.done = e.target.checked;
          onChange();
        }
      }),
      el("div", { class: "col", style: "flex:1" }, [
        el("div", {}, t.text),
        el("div", { class: "meta small" }, t.done ? "Done" : "Open")
      ])
    ]);
    list.appendChild(row);
  });

  return list;
}

export async function mountMindset() {
  const journalHost = document.getElementById("mindset-journal");
  const calendarHost = document.getElementById("mindset-calendar");
  const vaultHost = document.getElementById("mindset-vault");

  const date = isoDate();
  let entry = ensureJournalShape(await db.getJournal(date), date);

  async function saveEntry() {
    await db.putJournal(entry);
    await render();
  }

  async function closeDay() {
    if (!entry.closedAt) {
      entry.closedAt = Date.now();
      await db.putJournal(entry);

      const blocks = await db.listBlocks(date);
      await db.addVault({
        date,
        createdAt: Date.now(),
        snapshot: {
          journal: entry,
          blocks
        }
      });
      await render();
    }
  }

  async function render() {
    // Journal
    journalHost.innerHTML = "";
    journalHost.appendChild(
      el("div", { class: "col" }, [
        el("div", { class: "badge" }, "Morning"),
        el("div", { class: "meta" }, "Planning creates To-Do’s. Today’s Path reads them."),
        el("textarea", {
          class: "textarea",
          placeholder: "Looking forward to…",
          value: entry.morning.lookingForward,
          oninput: (e) => (entry.morning.lookingForward = e.target.value)
        }),
        el("textarea", {
          class: "textarea",
          placeholder: "Plan / Intention…",
          value: entry.morning.planning,
          oninput: (e) => (entry.morning.planning = e.target.value)
        }),
        el("div", { class: "divider" }),
        el("div", { class: "badge" }, "To-Do’s"),
        renderTodoList(entry, saveEntry),
        el("div", { class: "row" }, [
          el("input", { class: "input", id: "todoText", placeholder: "New To-Do…" }),
          el("button", {
            class: "btn primary",
            onclick: async () => {
              const inp = document.getElementById("todoText");
              const txt = (inp.value || "").trim();
              if (!txt) return;
              entry.morning.todos.push({ id: crypto.randomUUID(), text: txt, done: false, createdAt: Date.now() });
              inp.value = "";
              await saveEntry();
            }
          }, "Add")
        ]),
        el("div", { class: "divider" }),
        el("div", { class: "badge" }, "Evening"),
        el("textarea", {
          class: "textarea",
          placeholder: "Reflection…",
          value: entry.evening.reflection,
          oninput: (e) => (entry.evening.reflection = e.target.value)
        }),
        el("input", {
          class: "input",
          placeholder: "Day rating (e.g. 8/10)",
          value: entry.evening.rating,
          oninput: (e) => (entry.evening.rating = e.target.value)
        }),
        el("textarea", {
          class: "textarea",
          placeholder: "Grateful for…",
          value: entry.evening.gratitude,
          oninput: (e) => (entry.evening.gratitude = e.target.value)
        }),
        el("div", { class: "row" }, [
          el("button", { class: "btn", onclick: saveEntry }, "Save"),
          el("button", {
            class: entry.closedAt ? "btn" : "btn primary",
            onclick: closeDay
          }, entry.closedAt ? "Day closed" : "Close Day (creates Vault)")
        ]),
        entry.closedAt ? el("div", { class: "meta" }, "Vault entry created for today.") : null
      ])
    );

    // Calendar (simple editor)
    calendarHost.innerHTML = "";
    const blocks = await db.listBlocks(date);

    calendarHost.appendChild(
      el("div", { class: "col" }, [
        el("div", { class: "meta" }, `Date: ${date}`),
        el("div", { class: "list" }, blocks.map((b) =>
          el("div", { class: "card row" }, [
            el("div", { style: "flex:1" }, [
              el("div", {}, `${b.start}–${b.end}  ·  ${b.title}`),
              el("div", { class: "meta small" }, "Calendar block")
            ]),
            el("button", {
              class: "btn danger small",
              onclick: async () => {
                await db.deleteBlock(b.id);
                await render();
              }
            }, "Delete")
          ])
        )),
        el("div", { class: "divider" }),
        el("div", { class: "row" }, [
          el("input", { class: "input", id: "blkStart", placeholder: "Start (HH:MM)" }),
          el("input", { class: "input", id: "blkEnd", placeholder: "End (HH:MM)" })
        ]),
        el("input", { class: "input", id: "blkTitle", placeholder: "Title" }),
        el("button", {
          class: "btn primary",
          onclick: async () => {
            const start = (document.getElementById("blkStart").value || "").trim();
            const end = (document.getElementById("blkEnd").value || "").trim();
            const title = (document.getElementById("blkTitle").value || "").trim();
            if (!start || !end || !title) return;
            await db.addBlock({ date, start, end, title });
            document.getElementById("blkStart").value = "";
            document.getElementById("blkEnd").value = "";
            document.getElementById("blkTitle").value = "";
            await render();
          }
        }, "Add Block")
      ])
    );

    // Vault
    vaultHost.innerHTML = "";
    const vault = await db.listVault();
    if (vault.length === 0) {
      vaultHost.appendChild(el("div", { class: "meta" }, "No vault entries yet. Close a day in Journal."));
    } else {
      vaultHost.appendChild(
        el("div", { class: "list" }, vault.map((v) => {
          const todos = v.snapshot?.journal?.morning?.todos || [];
          const done = todos.filter((t) => t.done).length;
          return el("div", { class: "card col" }, [
            el("div", {}, v.date),
            el("div", { class: "meta small" }, `To-Do’s: ${done}/${todos.length} · Rating: ${v.snapshot?.journal?.evening?.rating || "—"}`),
            el("div", { class: "meta small" }, `Blocks: ${(v.snapshot?.blocks || []).length}`)
          ]);
        }))
      );
    }
  }

  await render();
}
