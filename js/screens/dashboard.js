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

  async function computeSnapshot(date) {
    let journal = null;
    let blocks = [];
    let txns = [];
    let cats = [];

    try { journal = await S().getJournal(date); } catch (_) {}
    try { blocks = await S().listBlocks(date); } catch (_) {}

    const month = U().isoMonth(new Date());
    try { txns = await S().listTransactions(month); } catch (_) {}
    try { cats = await S().listFinanceCategories(); } catch (_) {}

    journal = ensureJournal(journal, date);
    const todos = (journal.morning && journal.morning.todos) ? journal.morning.todos : [];
    const done = todos.filter((t) => t.done).length;
    const total = todos.length;
    const perf = total === 0 ? 0 : Math.round((done / total) * 100);

    // Next calendar block
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    let nextBlock = null;

    function toMins(hhmm) {
      const p = String(hhmm || "").split(":");
      const h = Number(p[0] || 0);
      const m = Number(p[1] || 0);
      return h * 60 + m;
    }

    const todayBlocks = blocks.slice().sort((a, b) => (a.start < b.start ? -1 : 1));
    for (let i = 0; i < todayBlocks.length; i++) {
      const b = todayBlocks[i];
      const startM = toMins(b.start);
      if (startM >= nowMins) { nextBlock = b; break; }
    }

    // Finance summary (income-expense)
    const income = txns.filter(t => t.type === "income").reduce((s,t)=>s + Number(t.amount||0), 0);
    const expense = txns.filter(t => t.type === "expense").reduce((s,t)=>s + Number(t.amount||0), 0);
    const remaining = income - expense;
    const remainingPct = income > 0 ? Math.max(0, Math.round((remaining / income) * 100)) : 0;

    // Gatekeeper counts
    let gk = [];
    try { gk = await S().listGatekeeper(); } catch (_) {}
    const locked = gk.filter((it) => (it.status || "locked") !== "purchased" && Date.now() < (it.unlockAt || 0)).length;
    const eligible = gk.filter((it) => (it.status || "locked") !== "purchased" && Date.now() >= (it.unlockAt || 0)).length;

    return {
      date: date,
      perf: perf,
      todosDone: done,
      todosTotal: total,
      nextBlock: nextBlock,
      remaining: remaining,
      remainingPct: remainingPct,
      locked: locked,
      eligible: eligible
    };
  }

  function mountDashboardFactory() {
    return async function mountDashboard(ctx) {
      const root = ctx.root;
      const ui = U();

      const date = ui.isoDate(new Date());
      const snap = await computeSnapshot(date);

      const nextBlockText = (function () {
        if (!snap.nextBlock) return "No upcoming blocks";
        // rough minutes until start using HH:MM today
        const p = String(snap.nextBlock.start || "00:00").split(":");
        const h = Number(p[0] || 0);
        const m = Number(p[1] || 0);
        const startTs = new Date();
        startTs.setHours(h, m, 0, 0);
        const mins = ui.minutesUntil(startTs.getTime());
        return `${snap.nextBlock.title} · in ${mins} min`;
      })();

      const snapshotWidget = ui.el("section", { class: "widget" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Today Snapshot"),
          ui.el("div", { class: "widget-meta" }, ui.fmtDateHuman(new Date()))
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "col" }, [
            ui.el("div", { class: "kpi-row" }, [
              ui.el("div", { class: "kpi-label" }, "Performance"),
              ui.el("div", { class: "kpi-value" }, snap.perf + "%")
            ]),
            ui.el("div", { class: "meta" }, `To-Dos: ${snap.todosDone}/${snap.todosTotal}`),
            ui.el("div", { class: "meta" }, `Next block: ${nextBlockText}`)
          ])
        ])
      ]);

      function openAddBlockModal() {
        const startInp = ui.el("input", { class: "input", placeholder: "Start (HH:MM)", id: "dashStart" });
        const endInp = ui.el("input", { class: "input", placeholder: "End (HH:MM)", id: "dashEnd" });
        const titleInp = ui.el("input", { class: "input", placeholder: "Title", id: "dashTitle" });

        const content = ui.el("div", { class: "col" }, [
          ui.el("div", { class: "meta" }, `Date: ${date}`),
          ui.el("div", { class: "row" }, [startInp, endInp]),
          titleInp,
          ui.el("button", {
            class: "btn primary",
            onclick: async (e) => {
              e.preventDefault();
              const start = (startInp.value || "").trim();
              const end = (endInp.value || "").trim();
              const title = (titleInp.value || "").trim();
              if (!start || !end || !title) { ui.toast("Fill all fields"); return; }
              try {
                await S().addBlock({ date: date, start: start, end: end, title: title });
                ui.toast("Block saved");
              } catch (err) {
                console.error(err);
                ui.toast("Save failed");
              }
              try { modal.close(); } catch (_) {}
              try { await ctx.router.go("dashboard", {}); } catch (_) {}
            }
          }, "Save Block")
        ]);

        const modal = ui.openModal("Add Calendar Block", content);
      }

      const quickActionsWidget = ui.el("section", { class: "widget" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Quick Actions"),
          ui.el("div", { class: "widget-meta" }, "Fast capture")
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "col" }, [
            ui.el("button", {
              class: "btn primary",
              onclick: async (e) => {
                e.preventDefault();
                // Navigate and focus journal anchor
                ctx.router.go("mindset", { focus: "journal" });
              }
            }, "Open Journal"),
            ui.el("button", {
              class: "btn",
              onclick: function (e) {
                e.preventDefault();
                openAddBlockModal();
              }
            }, "Add Calendar Block"),
            ui.el("button", {
              class: "btn",
              onclick: function (e) {
                e.preventDefault();
                ctx.router.go("finance", { open: "addTransaction" });
              }
            }, "Add Transaction"),
            ui.el("button", {
              class: "btn",
              onclick: function (e) {
                e.preventDefault();
                ctx.router.go("finance", { open: "addGatekeeper" });
              }
            }, "Add Gatekeeper Item")
          ])
        ])
      ]);

      const quickCards = ui.el("section", { class: "widget" }, [
        ui.el("div", { class: "widget-head" }, [
          ui.el("div", { class: "widget-title" }, "Quick Cards"),
          ui.el("div", { class: "widget-meta" }, "At a glance")
        ]),
        ui.el("div", { class: "widget-body" }, [
          ui.el("div", { class: "col" }, [
            ui.el("div", { class: "card" }, [
              ui.el("div", { class: "kpi-row" }, [
                ui.el("div", { class: "kpi-label" }, "To-Do Summary"),
                ui.el("div", { class: "kpi-value" }, `${snap.todosDone}/${snap.todosTotal}`)
              ]),
              ui.el("div", { class: "meta" }, "From today’s journal")
            ]),
            ui.el("div", { class: "card" }, [
              ui.el("div", { class: "kpi-row" }, [
                ui.el("div", { class: "kpi-label" }, "Finance Remaining"),
                ui.el("div", { class: "kpi-value" }, `${ui.money(snap.remaining)}`)
              ]),
              ui.el("div", { class: "meta" }, `${snap.remainingPct}% remaining (month)`)
            ]),
            ui.el("div", { class: "card" }, [
              ui.el("div", { class: "kpi-row" }, [
                ui.el("div", { class: "kpi-label" }, "Gatekeeper"),
                ui.el("div", { class: "kpi-value" }, `${snap.locked}/${snap.eligible}`)
              ]),
              ui.el("div", { class: "meta" }, "locked / eligible")
            ])
          ])
        ])
      ]);

      root.appendChild(ui.el("div", { class: "screen-title" }, "Dashboard"));
      root.appendChild(snapshotWidget);
      root.appendChild(quickActionsWidget);
      root.appendChild(quickCards);
    };
  }

  R().register("dashboard", mountDashboardFactory);
})();
