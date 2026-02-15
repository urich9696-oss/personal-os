import { db } from "../db.js";
import { el, isoMonth, isoDate, money, hoursUntil, confirmBox, fileToDataUrl } from "../ui.js";

export async function mountFinance() {
  const overviewHost = document.getElementById("finance-overview");
  const txHost = document.getElementById("finance-transactions");
  const gkHost = document.getElementById("finance-gatekeeper");

  const month = isoMonth();
  const date = isoDate();

  async function render() {
    const settings = await db.getSettings();
    const cats = await db.listFinanceCategories();
    const txns = await db.listTransactions(month);

    const income = txns.filter(t => t.type === "income").reduce((s,t)=>s + Number(t.amount||0), 0);
    const expense = txns.filter(t => t.type === "expense").reduce((s,t)=>s + Number(t.amount||0), 0);
    const remaining = income - expense;
    const remainingPct = income > 0 ? Math.max(0, Math.round((remaining / income) * 100)) : 0;
    const spentPct = income > 0 ? Math.min(100, Math.max(0, Math.round((expense / income) * 100))) : 0;

    // Overview
    overviewHost.innerHTML = "";
    overviewHost.appendChild(
      el("div", { class: "col" }, [
        el("div", { class: "meta" }, `Month: ${month}`),
        el("div", { class: "kpi-row" }, [
          el("div", { class: "kpi-label" }, "Remaining"),
          el("div", { class: "kpi-value" }, `${money(remaining)}`)
        ]),
        el("div", { class: "progress-shell" }, [
          el("div", { class: "progress-fill", style: `width:${spentPct}%` })
        ]),
        el("div", { class: "meta-row" }, [
          el("span", { class: "meta" }, `Income: ${money(income)}`),
          el("span", { class: "meta" }, `Expenses: ${money(expense)}`)
        ]),
        el("div", { class: "meta" }, `${remainingPct}% remaining`)
      ])
    );

    // Transactions
    txHost.innerHTML = "";

    const incomeCats = cats.filter(c => c.type === "income");
    const expenseCats = cats.filter(c => c.type === "expense");

    txHost.appendChild(
      el("div", { class: "col" }, [
        el("div", { class: "row" }, [
          el("select", { class: "select", id: "txType" }, [
            el("option", { value: "expense" }, "Expense"),
            el("option", { value: "income" }, "Income")
          ]),
          el("input", { class: "input", id: "txAmount", placeholder: "Amount (e.g. 49.90)", inputmode: "decimal" })
        ]),
        el("select", { class: "select", id: "txCat" }, []),
        el("input", { class: "input", id: "txNote", placeholder: "Note (optional)" }),
        el("button", {
          class: "btn primary",
          onclick: async () => {
            const type = document.getElementById("txType").value;
            const amount = Number((document.getElementById("txAmount").value || "").replace(",", "."));
            const catId = Number(document.getElementById("txCat").value);
            const note = (document.getElementById("txNote").value || "").trim();
            if (!amount || !catId) return;

            await db.addTransaction({
              date,
              month,
              type,
              categoryId: catId,
              amount,
              note,
              source: "manual"
            });

            document.getElementById("txAmount").value = "";
            document.getElementById("txNote").value = "";
            await render();
          }
        }, "Add transaction"),
        el("div", { class: "divider" }),
        el("div", { class: "badge" }, "This month"),
        txns.length === 0
          ? el("div", { class: "meta" }, "No transactions yet.")
          : el("div", { class: "list" }, txns.map((t) => {
              const cat = cats.find(c => c.id === t.categoryId);
              return el("div", { class: "card row" }, [
                el("div", { style: "flex:1" }, [
                  el("div", {}, `${t.type === "expense" ? "−" : "+"}${money(t.amount)} · ${cat ? cat.name : "Category"}`),
                  el("div", { class: "meta small" }, `${t.date} · ${t.source || "manual"}${t.note ? " · " + t.note : ""}`)
                ]),
                el("div", { class: "badge" }, t.type)
              ]);
            }))
      ])
    );

    // fill categories based on type
    function refreshCatSelect() {
      const type = document.getElementById("txType").value;
      const sel = document.getElementById("txCat");
      sel.innerHTML = "";
      const list = type === "income" ? incomeCats : expenseCats;
      list.forEach((c) => sel.appendChild(el("option", { value: String(c.id) }, c.name)));
    }
    document.getElementById("txType").onchange = refreshCatSelect;
    refreshCatSelect();

    // Gatekeeper
    gkHost.innerHTML = "";
    const items = await db.listGatekeeper();

    gkHost.appendChild(
      el("div", { class: "col" }, [
        el("div", { class: "meta" }, "Add item (image + text + price). Locked 72h before purchase."),
        el("input", { class: "input", id: "gkName", placeholder: "Item name" }),
        el("input", { class: "input", id: "gkPrice", placeholder: "Price (e.g. 199.00)", inputmode: "decimal" }),
        el("select", { class: "select", id: "gkCat" }, expenseCats.map((c)=>el("option", { value: String(c.id) }, c.name))),
        el("input", { type: "file", accept: "image/*", class: "input", id: "gkImg" }),
        el("button", {
          class: "btn primary",
          onclick: async () => {
            const name = (document.getElementById("gkName").value || "").trim();
            const price = Number((document.getElementById("gkPrice").value || "").replace(",", "."));
            const categoryId = Number(document.getElementById("gkCat").value);
            const file = document.getElementById("gkImg").files?.[0] || null;
            if (!name || !price || !categoryId) return;

            const imageDataUrl = await fileToDataUrl(file);
            const createdAt = Date.now();
            const unlockAt = createdAt + 72 * 60 * 60 * 1000;

            await db.addGatekeeperItem({
              name,
              price,
              categoryId,
              imageDataUrl: imageDataUrl || null,
              createdAt,
              unlockAt,
              status: "locked",
              purchasedAt: null
            });

            document.getElementById("gkName").value = "";
            document.getElementById("gkPrice").value = "";
            document.getElementById("gkImg").value = "";

            await render();
          }
        }, "Add Gatekeeper item"),
        el("div", { class: "divider" }),
        items.length === 0 ? el("div", { class: "meta" }, "No items yet.") :
          el("div", { class: "list" }, items.map((it) => {
            const eligible = Date.now() >= it.unlockAt;
            const lockedHours = hoursUntil(it.unlockAt);
            const pctOfRemaining = remaining !== 0 ? Math.round((it.price / Math.max(1, remaining)) * 100) : 0;

            const left = el("div", { style: "flex:1" }, [
              el("div", {}, `${it.name} · ${money(it.price)}`),
              el("div", { class: "meta small" }, eligible ? `Eligible · ~${pctOfRemaining}% of remaining` : `Locked · unlocks in ${lockedHours}h`)
            ]);

            const img = it.imageDataUrl ? el("img", { class: "thumb", src: it.imageDataUrl }) : el("div", { class: "thumb" });

            const buyBtn = el("button", {
              class: eligible ? "btn primary small" : "btn small",
              disabled: eligible ? null : "disabled",
              onclick: async () => {
                if (!confirmBox("Sicher, dass du das gekauft hast?")) return;

                it.status = "purchased";
                it.purchasedAt = Date.now();
                await db.updateGatekeeperItem(it);

                await db.addTransaction({
                  date,
                  month,
                  type: "expense",
                  categoryId: it.categoryId,
                  amount: it.price,
                  note: `Gatekeeper: ${it.name}`,
                  source: "gatekeeper"
                });

                await render();
              }
            }, it.status === "purchased" ? "Purchased" : "Bought");

            return el("div", { class: "card row" }, [
              img,
              left,
              buyBtn
            ]);
          }))
      ])
    );
  }

  await render();
}
