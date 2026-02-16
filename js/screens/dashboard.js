// js/screens/dashboard.js
// PERSONAL OS — Dashboard (Command Engine)
// Requirements implemented:
// - Today Snapshot (date, status, performance, next block, budget remaining, gatekeeper counts)
// - Dynamic Primary Button (status-driven)
// - Quick Actions (functional):
//   * Add Calendar Block (inline, no navigation required)
//   * Add Transaction (opens Finance with add mode)
//   * Add Gatekeeper Item (inline UI)
//   * Open Journal (focus Morning)
// - Dashboard must be reachable anytime via Router "Home" button (handled by Router.js)

ScreenRegistry.register("dashboard", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      // ------- Data Snapshot (single source of truth) -------
      const snap = await State.getTodaySnapshot();
      const dateKey = snap.date;
      const status = snap.status;
      const perf = snap.performance || { pct: 0, done: 0, total: 0 };
      const nextBlock = snap.nextBlock;
      const budget = snap.budget || { income: 0, expense: 0, remaining: 0, remainingPct: 0, spentPct: 0, month: State.getMonthKey(dateKey) };
      const gk = snap.gatekeeper || { locked: 0, eligible: 0, purchased: 0, total: 0 };

      // ------- Root -------
      const root = document.createElement("div");
      root.className = "dashboard";

      // ===== HEADER =====
      const header = document.createElement("div");
      header.className = "dash-header";
      header.innerHTML = `
        <div class="dash-title">Personal OS</div>
        <div class="dash-sub">The Architecture of Excellence.</div>
      `;

      // ===== TODAY SNAPSHOT CARD =====
      const snapCard = document.createElement("div");
      snapCard.className = "dash-card";

      const nextBlockText = nextBlock
        ? `${nextBlock.start}–${nextBlock.end} · ${nextBlock.title}`
        : "Kein weiterer Block heute";

      snapCard.innerHTML = `
        <div class="dash-meta">Today</div>
        <div class="dash-date">${dateKey}</div>
        <div class="dash-status">${String(status).toUpperCase()}</div>
        <div style="margin-top:12px; font-size:13px; color: rgba(18,18,18,0.78);">
          <div><strong>Next:</strong> ${escapeHtml(nextBlockText)}</div>
          <div style="margin-top:6px;"><strong>Budget:</strong> ${formatMoney(budget.remaining)} Remaining (${budget.remainingPct}%)</div>
          <div style="margin-top:6px;"><strong>Gatekeeper:</strong> Locked ${gk.locked} · Eligible ${gk.eligible}</div>
        </div>
      `;

      // ===== PERFORMANCE CARD =====
      const perfCard = document.createElement("div");
      perfCard.className = "dash-card";
      perfCard.innerHTML = `
        <div class="dash-meta">Performance</div>
        <div class="dash-value">${Number(perf.pct || 0)}%</div>
        <div style="font-size:13px; color: rgba(18,18,18,0.70); margin-top:6px;">
          Done: ${Number(perf.done || 0)} / ${Number(perf.total || 0)}
        </div>
      `;

      // ===== PRIMARY ACTION =====
      const primary = document.createElement("button");
      primary.className = "primary-action";
      primary.id = "primary-action";

      if (status === "morning") {
        primary.innerText = "Start Morning Setup";
        primary.onclick = () => {
          Router.setParams({ focus: "morning" });
          Router.go("mindset");
        };
      } else if (status === "execution") {
        primary.innerText = "Go to Execution";
        primary.onclick = () => Router.go("path");
      } else if (status === "evening") {
        primary.innerText = "Start Evening Review";
        primary.onclick = () => {
          Router.setParams({ focus: "evening" });
          Router.go("mindset");
        };
      } else if (status === "closed") {
        primary.innerText = "View Day Summary";
        primary.onclick = () => {
          Router.setParams({ viewVault: true });
          Router.go("vault");
        };
      } else {
        primary.innerText = "Open";
        primary.onclick = () => Router.go("mindset");
      }

      // ===== QUICK ACTIONS =====
      const quick = document.createElement("div");
      quick.className = "dash-quick";

      const btnJournal = document.createElement("button");
      btnJournal.innerText = "Open Journal";
      btnJournal.onclick = () => {
        Router.setParams({ focus: "morning" });
        Router.go("mindset");
      };

      const btnAddTxn = document.createElement("button");
      btnAddTxn.innerText = "Add Transaction";
      btnAddTxn.onclick = () => {
        Router.setParams({ mode: "addTxn" });
        Router.go("finance");
      };

      const btnAddBlock = document.createElement("button");
      btnAddBlock.innerText = "Add Block";
      btnAddBlock.onclick = () => toggleInline("block");

      const btnGatekeeper = document.createElement("button");
      btnGatekeeper.innerText = "Gatekeeper Item";
      btnGatekeeper.onclick = () => toggleInline("gk");

      quick.appendChild(btnJournal);
      quick.appendChild(btnAddBlock);
      quick.appendChild(btnAddTxn);
      quick.appendChild(btnGatekeeper);

      // ===== INLINE PANELS =====
      const inlineWrap = document.createElement("div");
      inlineWrap.style.display = "flex";
      inlineWrap.style.flexDirection = "column";
      inlineWrap.style.gap = "12px";

      const inlineBlock = buildInlineAddBlock(dateKey);
      const inlineGK = await buildInlineGatekeeper(dateKey);

      inlineWrap.appendChild(inlineBlock);
      inlineWrap.appendChild(inlineGK);

      // initial hidden
      inlineBlock.style.display = "none";
      inlineGK.style.display = "none";

      function toggleInline(which) {
        if (which === "block") {
          inlineBlock.style.display = inlineBlock.style.display === "none" ? "block" : "none";
          inlineGK.style.display = "none";
        }
        if (which === "gk") {
          inlineGK.style.display = inlineGK.style.display === "none" ? "block" : "none";
          inlineBlock.style.display = "none";
        }
      }

      // ===== RENDER =====
      root.appendChild(header);
      root.appendChild(snapCard);
      root.appendChild(perfCard);
      root.appendChild(primary);
      root.appendChild(quick);
      root.appendChild(inlineWrap);

      container.appendChild(root);
    } catch (e) {
      console.error("Dashboard mount error", e);
      container.innerHTML = "<div class='error'>Dashboard failed to load</div>";
    }

    // -----------------------------
    // Helpers (local to this file)
    // -----------------------------
    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function formatMoney(n) {
      const x = Number(n || 0);
      // Keep it simple: no locale dependencies
      return (Math.round(x * 100) / 100).toString();
    }

    function buildInlineAddBlock(dateKey) {
      const card = document.createElement("div");
      card.className = "dash-card";

      const h = document.createElement("div");
      h.style.fontWeight = "800";
      h.style.marginBottom = "8px";
      h.textContent = "Quick Add Block";
      card.appendChild(h);

      const start = document.createElement("input");
      start.placeholder = "Start (HH:MM)";
      start.inputMode = "numeric";

      const end = document.createElement("input");
      end.placeholder = "End (HH:MM)";
      end.inputMode = "numeric";

      const title = document.createElement("input");
      title.placeholder = "Title";

      const addBtn = document.createElement("button");
      addBtn.textContent = "Add Block";

      const msg = document.createElement("div");
      msg.style.fontSize = "13px";
      msg.style.opacity = "0.75";
      msg.style.marginTop = "8px";

      addBtn.onclick = async function () {
        msg.textContent = "";
        const s = String(start.value || "").trim();
        const e = String(end.value || "").trim();
        const t = String(title.value || "").trim();

        if (!s || !e || !t) {
          msg.textContent = "Bitte Start/Ende/Titel ausfüllen.";
          return;
        }

        const ok = await State.addBlock({ date: dateKey, start: s, end: e, title: t }).then((id) => !!id).catch(() => false);
        if (!ok) {
          msg.textContent = "Konnte Block nicht speichern.";
          return;
        }

        start.value = "";
        end.value = "";
        title.value = "";
        msg.textContent = "Block gespeichert.";

        // refresh snapshot: simplest -> re-render dashboard
        try { Router.go("dashboard"); } catch (_) {}
      };

      card.appendChild(start);
      card.appendChild(end);
      card.appendChild(title);
      card.appendChild(addBtn);
      card.appendChild(msg);

      return card;
    }

    async function buildInlineGatekeeper(dateKey) {
      const card = document.createElement("div");
      card.className = "dash-card";

      const h = document.createElement("div");
      h.style.fontWeight = "800";
      h.style.marginBottom = "8px";
      h.textContent = "Quick Add Gatekeeper";
      card.appendChild(h);

      const name = document.createElement("input");
      name.placeholder = "Item name";

      const price = document.createElement("input");
      price.placeholder = "Price";
      price.inputMode = "decimal";

      const catSelect = document.createElement("select");
      const cats = await State.listFinanceCategories().catch(() => []);
      const exp = (cats || []).filter((c) => c && c.type === "expense");

      if (exp.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Keine Expense Kategorien";
        catSelect.appendChild(opt);
      } else {
        exp.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name;
          catSelect.appendChild(opt);
        });
      }

      const addBtn = document.createElement("button");
      addBtn.textContent = "Add Gatekeeper Item";

      const msg = document.createElement("div");
      msg.style.fontSize = "13px";
      msg.style.opacity = "0.75";
      msg.style.marginTop = "8px";

      addBtn.onclick = async function () {
        msg.textContent = "";
        const n = String(name.value || "").trim();
        const p = Number(price.value || 0);
        const catId = Number(catSelect.value || 0);

        if (!n || !p || !catId) {
          msg.textContent = "Bitte Name/Preis/Kategorie ausfüllen.";
          return;
        }

        const id = await State.addGatekeeperItem({
          name: n,
          price: p,
          categoryId: catId
        }).catch(() => null);

        if (!id) {
          msg.textContent = "Konnte Gatekeeper Item nicht speichern.";
          return;
        }

        name.value = "";
        price.value = "";
        msg.textContent = "Gatekeeper Item gespeichert (72h Lock).";
        try { Router.go("dashboard"); } catch (_) {}
      };

      card.appendChild(name);
      card.appendChild(price);
      card.appendChild(catSelect);
      card.appendChild(addBtn);
      card.appendChild(msg);

      return card;
    }
  }
});
