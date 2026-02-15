(function () {
  const { db, ui } = window.PersonalOS;
  const { el, isoDate } = ui;

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

  window.PersonalOS = window.PersonalOS || {};
  window.PersonalOS.screens = window.PersonalOS.screens || {};

  window.PersonalOS.screens.mindset = async function mountMindset() {
    const journalHost = document.getElementById("mindset-journal");
    const date = isoDate();

    let entry = ensureJournalShape(await db.getJournal(date), date);

    async function saveEntry() {
      await db.putJournal(entry);
      render();
    }

    function render() {
      journalHost.innerHTML = "";
      journalHost.appendChild(
        el("div", { class: "col" }, [
          el("div", { class: "badge" }, "Morning"),
          renderTodoList(entry, saveEntry),
          el("div", { class: "row" }, [
            el("input", { class: "input", id: "todoText", placeholder: "New To-Do…" }),
            el("button", {
              class: "btn primary",
              onclick: async () => {
                const inp = document.getElementById("todoText");
                const txt = (inp.value || "").trim();
                if (!txt) return;
                entry.morning.todos.push({ id: crypto.randomUUID(), text: txt, done: false });
                inp.value = "";
                await saveEntry();
              }
            }, "Add")
          ])
        ])
      );
    }

    render();
  };
})();
