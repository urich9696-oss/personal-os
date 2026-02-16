// js/screens/vault.js
// PERSONAL OS — Vault (Archiv: Liste + Detailansicht, read-only)
// Umsetzung:
// - Liste aller abgeschlossenen Tage (Snapshots) via State.listVault()
// - Detailansicht pro Tag via State.getVaultSnapshot(dayKey)
// - Read-only
// - Navigation: Back to Dashboard
// - Deep-link: Router.setParam("dayKey", "YYYY-MM-DD") + Router.go("vault") öffnet Detail

ScreenRegistry.register("vault", {
  async mount(container, ctx) {
    try {
      container.innerHTML = "";

      const root = document.createElement("div");
      root.className = "vault";

      const title = document.createElement("h2");
      title.textContent = "Vault";
      root.appendChild(title);

      const dayKeyParam = Router.getParam("dayKey");
      const dayKey = dayKeyParam ? String(dayKeyParam) : "";

      // one-shot param
      if (dayKeyParam) Router.clearParams();

      // Header actions
      const actions = document.createElement("div");
      actions.className = "dash-quick";
      actions.style.marginBottom = "10px";

      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.textContent = "Dashboard";
      backBtn.onclick = function () { Router.go("dashboard"); };

      const listBtn = document.createElement("button");
      listBtn.type = "button";
      listBtn.textContent = "List";
      listBtn.onclick = function () { Router.go("vault"); };

      actions.appendChild(backBtn);
      actions.appendChild(listBtn);
      root.appendChild(actions);

      if (dayKey) {
        const snap = await State.getVaultSnapshot(dayKey);

        if (!snap) {
          const err = document.createElement("div");
          err.className = "error";
          err.textContent = "Kein Snapshot gefunden für: " + dayKey;
          root.appendChild(err);

          container.appendChild(root);
          return;
        }

        root.appendChild(renderDetail(snap));
        container.appendChild(root);
        return;
      }

      // List view
      const list = await State.listVault();
      const card = document.createElement("div");
      card.className = "dash-card";
      card.innerHTML = `<div style="font-weight:900; margin-bottom:6px;">Abgeschlossene Tage</div>`;
      root.appendChild(card);

      if (!list || list.length === 0) {
        const empty = document.createElement("div");
        empty.className = "dash-card";
        empty.innerHTML = `
          <div style="font-weight:900; margin-bottom:6px;">Noch leer</div>
          <div style="font-size:13px; opacity:0.75;">Schließe einen Tag im Evening Review, dann erscheint er hier.</div>
        `;
        root.appendChild(empty);
        container.appendChild(root);
        return;
      }

      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (!s || !s.dayKey) continue;

        const row = document.createElement("div");
        row.className = "vault-card";
        row.style.cursor = "pointer";

        const perf = Number(s.performanceScore || 0);
        const done = s.todos ? Number(s.todos.done || 0) : 0;
        const total = s.todos ? Number(s.todos.total || 0) : 0;

        row.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:10px;">
            <div><strong>${escapeHtml(s.dayKey)}</strong></div>
            <div style="font-weight:900;">${perf}%</div>
          </div>
          <div style="font-size:12px; opacity:0.75; margin-top:6px;">
            Todos: ${done}/${total} · Remaining: ${formatMoney(s.finance && s.finance.remaining)}
          </div>
        `;

        row.onclick = function () {
          Router.setParam("dayKey", s.dayKey);
          Router.go("vault");
        };

        root.appendChild(row);
      }

      container.appendChild(root);

    } catch (e) {
      console.error("Vault mount error", e);
      container.innerHTML = "<div class='error'>Vault failed to load</div>";
    }

    function renderDetail(snap) {
      const wrap = document.createElement("div");
      wrap.className = "dash-card";

      const dayKey = String(snap.dayKey || "");
      const perf = Number(snap.performanceScore || 0);

      const done = snap.todos ? Number(snap.todos.done || 0) : 0;
      const total = snap.todos ? Number(snap.todos.total || 0) : 0;

      wrap.innerHTML = `
        <div style="font-weight:900; margin-bottom:10px;">${escapeHtml(dayKey)}</div>

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:140px;">
            <div class="dash-meta">Performance</div>
            <div style="font-size:22px; font-weight:900; margin-top:6px;">${perf}%</div>
            <div style="font-size:12px; opacity:0.75; margin-top:4px;">Todos ${done}/${total}</div>
          </div>

          <div style="flex:1; min-width:140px;">
            <div class="dash-meta">Finance</div>
            <div style="font-size:14px; font-weight:900; margin-top:6px;">Remaining ${formatMoney(snap.finance && snap.finance.remaining)}</div>
            <div style="font-size:12px; opacity:0.75; margin-top:4px;">
              Income ${formatMoney(snap.finance && snap.finance.income)} · Expense ${formatMoney(snap.finance && snap.finance.expense)}
            </div>
          </div>
        </div>

        <div style="margin-top:14px; font-weight:900;">Morning Summary</div>
        <div style="margin-top:6px; font-size:13px; opacity:0.85;">
          <div><strong>Ich freue mich auf:</strong> ${escapeHtml(snap.morningSummary && snap.morningSummary.lookingForward)}</div>
          <div style="margin-top:6px;"><strong>Das mache ich gut:</strong> ${escapeHtml(snap.morningSummary && snap.morningSummary.planning)}</div>
        </div>

        <div style="margin-top:14px; font-weight:900;">Evening Summary</div>
        <div style="margin-top:6px; font-size:13px; opacity:0.85;">
          <div><strong>Reflexion:</strong> ${escapeHtml(snap.eveningSummary && snap.eveningSummary.reflection)}</div>
          <div style="margin-top:6px;"><strong>Rating:</strong> ${escapeHtml(snap.eveningSummary && snap.eveningSummary.rating)}</div>
          <div style="margin-top:6px;"><strong>Dankbarkeit:</strong> ${escapeHtml(snap.eveningSummary && snap.eveningSummary.gratitude)}</div>
        </div>

        <div style="margin-top:14px; font-weight:900;">Blocks Summary</div>
        <div id="vault-blocks" style="margin-top:6px;"></div>
      `;

      const blocksHost = wrap.querySelector("#vault-blocks");
      const blocks = Array.isArray(snap.blocksSummary) ? snap.blocksSummary : [];
      if (!blocksHost) return wrap;

      if (blocks.length === 0) {
        const empty = document.createElement("div");
        empty.style.fontSize = "13px";
        empty.style.opacity = "0.75";
        empty.textContent = "Keine Blöcke gespeichert.";
        blocksHost.appendChild(empty);
        return wrap;
      }

      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i] || {};
        const line = document.createElement("div");
        line.style.fontSize = "13px";
        line.style.opacity = "0.85";
        line.style.marginTop = "6px";
        line.textContent = (b.start || "") + "–" + (b.end || "") + " | " + (b.title || "");
        blocksHost.appendChild(line);
      }

      return wrap;
    }

    function formatMoney(n) {
      const v = Number(n || 0);
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
