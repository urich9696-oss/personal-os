// js/screens/dashboard.js
// PERSONAL OS — Dashboard (Command Engine)
// Anforderungen umgesetzt:
// A) Today Snapshot: Datum, Status, Performance, Next Block, Budget Remaining, Gatekeeper Counts
// B) Dynamischer Primary Button (Status-Flow)
// C) Quick Actions (funktional): Inline Add Block, Add Transaction (Finance), Add Gatekeeper Item (Finance GK), Open Journal (Morning)
// D) Dashboard erreichbar (Back): Link/Button "Dashboard" wird in Router-Hash unterstützt; zusätzlich Quick Button "Dashboard" ist optional über bottom nav nicht nötig.

ScreenRegistry.register("dashboard", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const snap = await State.getTodaySnapshot();
      const today = snap.date;
      const status = snap.status;

      const root = document.createElement("div");
      root.className = "dashboard";

      // ===== HEADER =====
      const header = document.createElement("div");
      header.className = "dash-header";
      header.innerHTML = `
        <div class="dash-title">Personal OS</div>
        <div class="dash-sub">The Architecture of Excellence.</div>
      `;
      root.appendChild(header);

      // ===== TODAY SNAPSHOT =====
      const snapCard = document.createElement("div");
      snapCard.className = "dash-card";

      const perf = snap.performance || { pct: 0, done: 0, total: 0 };
      const next = snap.nextBlock;
      const budget = snap.budget || { income: 0, expense: 0, remaining: 0, remainingPct: 0, spentPct: 0, month: today.slice(0, 7) };
      const gk = snap.gatekeeper || { locked: 0, eligible: 0, purchased: 0, total: 0 };

      snapCard.innerHTML = `
        <div class="dash-meta">Today</div>
        <div class="dash-date">${escapeHtml(today)}</div>
        <div class="dash-status">${escapeHtml(String(status || "").toUpperCase())}</div>

        <div style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:140px;">
            <div class="dash-meta">Performance</div>
            <div style="font-size:22px; font-weight:800; margin-top:6px;">${perf.pct}%</div>
            <div style="font-size:12px; opacity:0.75; margin-top:4px;">${perf.done}/${perf.total} ToDos</div>
          </div>

          <div style="flex:1; min-width:140px;">
            <div class="dash-meta">Next Block</div>
            <div style="font-size:14px; font-weight:800; margin-top:6px;">
              ${next ? escapeHtml(next.start + "–" + next.end) : "—"}
            </div>
            <div style="font-size:12px; opacity:0.75; margin-top:4px;">
              ${next ? escapeHtml(next.title || "") : "Kein weiterer Block heute"}
            </div>
          </div>
        </div>

        <div style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:140px;">
            <div class="dash-meta">Budget Remaining (${escapeHtml(budget.month || "")})</div>
            <div style="font-size:18px; font-weight:900; margin-top:6px;">
              ${formatMoney(budget.remaining)}
            </div>
            <div style="font-size:12px; opacity:0.75; margin-top:4px;">
              Income ${formatMoney(budget.income)} · Expense ${formatMoney(budget.expense)}
            </div>
            <div style="height:10px; background: rgba(18,18,18,0.08); border-radius: 999px; overflow:hidden; margin-top:10px;">
              <div style="height:10px; width:${clampPct(budget.spentPct)}%; background: rgba(18,18,18,0.35);"></div>
            </div>
            <div style="font-size:12px; opacity:0.75; margin-top:6px;">
              Spent ${clampPct(budget.spentPct)}% · Remaining ${clampPct(budget.remainingPct)}%
            </div>
          </div>

          <div style="flex:1; min-width:140px;">
            <div class="dash-meta">Gatekeeper</div>
            <div style="font-size:14px; font-weight:900; margin-top:6px;">
              Eligible: ${Number(gk.eligible || 0)}
            </div>
            <div style="font-size:12px; opacity:0.75; margin-top:4px;">
              Locked: ${Number(gk.locked || 0)} · Purchased: ${Number(gk.purchased || 0)}
            </div>
          </div>
        </div>
      `;
      root.appendChild(snapCard);

      // ===== PRIMARY ACTION =====
      const primary = document.createElement("button");
      primary.className = "primary-action";
      primary.id = "primary-action";

      if (status === "morning") {
        primary.textContent = "Start Morning Setup";
        primary.onclick = function () {
          Router.setParams({ focus: "morning" });
          Router.go("mindset");
        };
      } else if (status === "execution") {
        primary.textContent = "Go to Execution";
        primary.onclick = function () { Router.go("path"); };
      } else if (status === "evening") {
        primary.textContent = "Start Evening Review";
        primary.onclick = function () {
          Router.setParams({ focus: "evening" });
          Router.go("mindset");
        };
      } else if (status === "closed") {
        primary.textContent = "View Day Summary";
        primary.onclick = function () { Router.go("vault"); };
      } else {
        primary.textContent = "Open Mindset";
        primary.onclick = function () { Router.go("mindset"); };
      }

      root.appendChild(primary);

      // ===== QUICK ACTIONS =====
      const quickRow = document.createElement("div");
      quickRow.className = "dash-quick";

      // Open Journal (Morning focus)
      const btnJournal = document.createElement("button");
      btnJournal.type = "button";
      btnJournal.textContent = "Open Journal";
      btnJournal.onclick = function () {
        Router.setParams({ focus: "morning" });
        Router.go("mindset");
      };

      // Add Transaction (Finance)
      const btnTxn = document.createElement("button");
      btnTxn.type = "button";
      btnTxn.textContent = "Add Transaction";
      btnTxn.onclick = function () {
        Router.setParams({ focus: "addTransaction" });
        Router.go("finance");
      };

      // Add Gatekeeper Item (Finance GK)
      const btnGK = document.createElement("button");
      btnGK.type = "button";
      btnGK.textContent = "Add Gatekeeper";
      btnGK.onclick = function () {
        Router.setParams({ focus: "addGatekeeper" });
        Router.go("finance");
      };

      quickRow.appendChild(btnJournal);
      quickRow.appendChild(btnTxn);
      quickRow.appendChild(btnGK);

      root.appendChild(quickRow);

      // ===== INLINE: QUICK ADD BLOCK (Dashboard) =====
      const blockCard = document.createElement("div");
      blockCard.className = "dash-card";
      blockCard.innerHTML = `<div style="font-weight:900; margin-bottom:8px;">Quick Add Block</div>`;

      const startInput = document.createElement("input");
      startInput.placeholder = "Start (HH:MM)";
      startInput.inputMode = "numeric";

      const endInput = document.createElement("input");
      endInput.placeholder = "End (HH:MM)";
      endInput.inputMode = "numeric";

      const titleInput = document.createElement("input");
      titleInput.placeholder = "Title";

      const addBlockBtn = document.createElement("button");
      addBlockBtn.type = "button";
      addBlockBtn.textContent = "Add Block";

      const msg = document.createElement("div");
      msg.style.fontSize = "13px";
      msg.style.opacity = "0.75";
      msg.style.marginTop = "8px";

      addBlockBtn.onclick = async function () {
        msg.textContent = "";

        const s = String(startInput.value || "").trim();
        const e = String(endInput.value || "").trim();
        const t = String(titleInput.value || "").trim();

        if (!s || !e || !t) {
          msg.textContent = "Bitte Start/Ende/Titel ausfüllen.";
          return;
        }

        const id = await State.addBlock({ date: today, start: s, end: e, title: t }).catch(() => null);
        if (!id) {
          msg.textContent = "Konnte Block nicht speichern.";
          return;
        }

        startInput.value = "";
        endInput.value = "";
        titleInput.value = "";
        msg.textContent = "Block gespeichert.";

        // re-render dashboard to refresh next block snapshot (simple + consistent)
        Router.go("dashboard");
      };

      blockCard.appendChild(startInput);
      blockCard.appendChild(endInput);
      blockCard.appendChild(titleInput);
      blockCard.appendChild(addBlockBtn);
      blockCard.appendChild(msg);

      root.appendChild(blockCard);

      container.appendChild(root);

    } catch (e) {
      console.error("Dashboard mount error", e);
      container.innerHTML = "<div class='error'>Dashboard failed to load</div>";
    }

    function clampPct(n) {
      const x = Number(n || 0);
      if (x < 0) return 0;
      if (x > 100) return 100;
      return Math.round(x);
    }

    function formatMoney(n) {
      const v = Number(n || 0);
      // simple format without Intl to avoid locale surprises; can be replaced later
      const sign = v < 0 ? "-" : "";
      const abs = Math.abs(v);
      const s = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
      return sign + s;
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }
});
