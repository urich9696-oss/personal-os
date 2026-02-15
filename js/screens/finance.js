(function () {
  const R = () => window.POS && window.POS.registry;
  const S = () => window.POS && window.POS.state;
  const U = () => window.POS && window.POS.ui;

  function factory() {
    return async function mountFinance(ctx) {
      const ui = U();
      const month = ui.isoMonth(new Date());
      const date = ui.isoDate(new Date());

      async function render(openSection) {
        const cats = await S().listFinanceCategories().catch(() => []);
        const txns = await S().listTransactions(month).catch(() => []);
        const gk = await S().listGatekeeper().catch(() => []);

        const income = txns.filter(t => t.type === "income").reduce((s,t)=>s + Number(t.amount||0), 0);
        const expense = txns.filter(t => t.type === "expense").reduce((s,t)=>s + Number(t.amount||0), 0);
        const remaining = income - expense;
        const remainingPct = income > 0 ? Math.max(0, Math.round((remaining / income) * 100)) : 0;
        const spentPct = income > 0 ? Math.min(100, Math.max(0, Math.round((expense / income) * 100))) : 0;

        const incomeCats = cats.filter(c => c.type === "income");
        const expenseCats = cats.filter(c => c.type === "expense");

        ctx.root.innerHTML = "";
        ctx.root.appendChild(ui.el("div", { class: "screen-title" }, "Finance"));

        // Overview
        ctx.root.appendChild(ui.el("section", { class: "widget" }, [
          ui.el("div", { class: "widget-head" }, [
            ui.el("div", { class: "widget-title" }, "Monthly Overview"),
            ui.el("div", { class: "widget-meta" }, month)
          ]),
          ui.el("div", { class: "widget-body" }, [
            ui.el("div", { class: "col" }, [
              ui.el("div", { class: "kpi-row" }, [
                ui.el("div", { class: "kpi-label" }, "Remaining"),
                ui.el("div", { class: "kpi-value" }, ui.money(remaining))
              ]),
              ui.el("div", { class: "progress-shell" }, [
                ui.el("div", { class: "progress-fill", style: "width:" + spentPct + "%" })
              ]),
              ui.el("div", { class: "row" }, [
                ui.el("div", { class: "meta" }, "Income: " + ui.money(income)),
                ui.el("div", { class: "meta" }, "Expenses: " + ui.money(expense))
              ]),
              ui.el("div", { class: "meta" }, remainingPct + "% remaining")
            ])
          ])
        ]));

        // Transactions
        const txWidgetBody = ui.el("div", { class: "widget-body" }, []);
        const txWidget = ui.el("section", { class: "widget", id: "financeAddTransaction" }, [
          ui.el("div", { class: "widget-head" }, [
            ui.el("div", { class: "widget-title" }, "Transactions"),
            ui.el("div", { class: "widget-meta" }, "Add + list")
          ]),
          txWidgetBody
        ]);

        const txType = ui.el("select", { class: "select", id: "txType" }, [
          ui.el("option", { value: "expense" }, "Expense"),
          ui.el("option", { value: "income" }, "Income")
        ]);
        const txAmount = ui.el("input", { class: "input", id: "txAmount", placeholder: "Amount (e.g. 49.90)", inputmode: "decimal" });
        const txCat = ui.el("select", { class: "select", id: "txCat" }, []);
        const txNote = ui.el("input", { class: "input", id: "txNote", placeholder: "Note (optional)" });

        function refreshCatSelect() {
          const type = txType.value;
          txCat.innerHTML = "";
          const list = type === "income" ? incomeCats : expenseCats;
          for (let i = 0; i < list.length; i++) {
            const c = list[i];
            txCat.appendChild(ui.el("option", { value: String(c.id) }, c.name));
          }
        }
        txType.onchange = refreshCatSelect;

        txWidgetBody.appendChild(ui.el("div", { class: "col" }, [
          ui.el("div", { class: "meta" }, "Date: " + date),
          ui.el("div", { class: "row" }, [txType, txAmount]),
          txCat,
          txNote,
          ui.el("button", {
            class: "btn primary",
            onclick: async (e) => {
              e.preventDefault();
              const type = txType.value;
              const amount = Number((txAmount.value || "").replace(",", "."));
              const categoryId = Number(txCat.value);
              const note = (txNote.value || "").trim();
              if (!amount || !categoryId) { ui.toast("Missing amount/category"); return; }

              await S().addTransaction({ date: date, month: month, type: type, categoryId: categoryId, amount: amount, note: note, source: "manual" })
                .catch((err) => { console.error(err); ui.toast("Save failed"); });

              txAmount.value = "";
              txNote.value = "";
              ui.toast("Transaction saved");
              await render(openSection);
            }
          }, "Add transaction"),
          ui.el("div", { class: "divider" }),
          ui.el("div", { class: "badge" }, "This month"),
          txns.length === 0
            ? ui.el("div", { class: "meta" }, "No transactions yet.")
            : ui.el("div", { class: "list" }, txns.map((t) => {
                const cat = cats.find(c => c.id === t.categoryId);
                return ui.el("div", { class: "card row" }, [
                  ui.el("div", { style: "flex:1" }, [
                    ui.el("div", {}, (t.type === "expense" ? "−" : "+") + ui.money(t.amount) + " · " + (cat ? cat.name : "Category")),
                    ui.el("div", { class: "meta small" }, t.date + " · " + (t.source || "manual") + (t.note ? " · " + t.note : ""))
                  ]),
                  ui.el("div", { class: "badge" }, t.type)
                ]);
              }))
        ]));

        ctx.root.appendChild(txWidget);
        refreshCatSelect();

        // Gatekeeper
        const gkBody = ui.el("div", { class: "widget-body" }, []);
        const gkWidget = ui.el("section", { class: "widget", id: "financeAddGatekeeper" }, [
          ui.el("div", { class: "widget-head" }, [
            ui.el("div", { class: "widget-title" }, "Gatekeeper"),
            ui.el("div", { class: "widget-meta" }, "72h brake")
          ]),
          gkBody
        ]);

        const gkName = ui.el("input", { class: "input", id: "gkName", placeholder: "Item name" });
        const gkPrice = ui.el("input", { class: "input", id: "gkPrice", placeholder: "Price (e.g. 199.00)", inputmode: "decimal" });
        const gkCat = ui.el("select", { class: "select", id: "gkCat" }, expenseCats.map((c) => ui.el("option", { value: String(c.id) }, c.name)));
        const gkImg = ui.el("input", { class: "input", id: "gkImg", type: "file", accept: "image/*" });

        gkBody.appendChild(ui.el("div", { class: "col" }, [
          ui.el("div", { class: "meta" }, "Add item: image + name + price. Locked 72h before purchase."),
          gkName,
          gkPrice,
          gkCat,
          gkImg,
          ui.el("button", {
            class: "btn primary",
            onclick: async (e) => {
              e.preventDefault();
              const name = (gkName.value || "").trim();
              const price = Number((gkPrice.value || "").replace(",", "."));
              const categoryId = Number(gkCat.value);
              const file = gkImg.files && gkImg.files[0] ? gkImg.files[0] : null;
              if (!name || !price || !categoryId) { ui.toast("Missing fields"); return; }

              let imageDataUrl = null;
              try { imageDataUrl = await ui.fileToDataUrl(file); } catch (_) {}

              const createdAt = Date.now();
              const unlockAt = createdAt + 72 * 60 * 60 * 1000;

              await S().addGatekeeperItem({
                name: name,
                price: price,
                categoryId: categoryId,
                imageDataUrl: imageDataUrl || null,
                createdAt: createdAt,
                unlockAt: unlockAt,
                status: "locked",
                purchasedAt: null
              }).catch((err) => { console.error(err); ui.toast("Save failed"); });

              gkName.value = "";
              gkPrice.value = "";
              gkImg.value = "";
              ui.toast("Gatekeeper saved");
              await render(openSection);
            }
          }, "Add Gatekeeper item"),
          ui.el("div", { class: "divider" }),
          gk.length === 0 ? ui.el("div", { class: "meta" }, "No items yet.") :
            ui.el("div", { class: "list" }, gk.map((it) => {
              const eligible = Date.now() >= (it.unlockAt || 0);
              const lockedHours = ui.hoursUntil(it.unlockAt || 0);
              const pctOfRemaining = remaining > 0 ? Math.round((Number(it.price || 0) / Math.max(1, remaining)) * 100) : 0;
              const warn = remaining > 0 && Number(it.price || 0) > remaining;

              const img = it.imageDataUrl ? ui.el("img", { class: "thumb", src: it.imageDataUrl }) : ui.el("div", { class: "thumb" });

              const left = ui.el("div", { style: "flex:1" }, [
                ui.el("div", {}, it.name + " · " + ui.money(it.price)),
                ui.el("div", { class: "meta small" },
                  (it.status === "purchased")
                    ? "Purchased"
                    : (eligible
                        ? ("Eligible · ~" + pctOfRemaining + "% of remaining" + (warn ? " · WARNING: > remaining" : ""))
                        : ("Locked · unlocks in " + lockedHours + "h"))
                )
              ]);

              const btn = ui.el("button", {
                class: (eligible && it.status !== "purchased") ? "btn primary small" : "btn small",
                disabled: (eligible && it.status !== "purchased") ? null : "disabled",
                onclick: async (e) => {
                  e.preventDefault();
                  if (it.status === "purchased") return;
                  if (!window.confirm("Sicher? Das erzeugt eine Expense-Transaktion.")) return;

                  it.status = "purchased";
                  it.purchasedAt = Date.now();
                  await S().updateGatekeeperItem(it).catch(() => {});
                  await S().addTransaction({
                    date: date,
                    month: month,
                    type: "expense",
                    categoryId: it.categoryId,
                    amount: it.price,
                    note: "Gatekeeper: " + it.name,
                    source: "gatekeeper"
                  }).catch(() => {});
                  ui.toast("Purchased recorded");
                  await render(openSection);
                }
              }, (it.status === "purchased") ? "Purchased" : "Bought");

              return ui.el("div", { class: "card row" }, [img, left, btn]);
            }))
        ]));

        ctx.root.appendChild(gkWidget);

        // Deep-link support from Dashboard quick actions
        if (openSection === "addTransaction") {
          setTimeout(() => {
            try {
              const n = document.getElementById("financeAddTransaction");
              if (n && n.scrollIntoView) n.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch (_) {}
          }, 80);
        }
        if (openSection === "addGatekeeper") {
          setTimeout(() => {
            try {
              const n = document.getElementById("financeAddGatekeeper");
              if (n && n.scrollIntoView) n.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch (_) {}
          }, 80);
        }
      }

      const open = (ctx.params && ctx.params.open) ? ctx.params.open : null;
      await render(open);
    };
  }

  R().register("finance", factory);
})();
