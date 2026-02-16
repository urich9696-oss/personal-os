// js/screens/dashboard.js
// PERSONAL OS — Dashboard (Command Engine)
// FIX: No dependency on missing State.getTodaySnapshot()
// Builds snapshot from existing State APIs (iOS/Safari-safe, no new State changes).

(function () {
  "use strict";

  if (!window.ScreenRegistry || typeof window.ScreenRegistry.register !== "function") {
    return;
  }

  window.ScreenRegistry.register("dashboard", {
    async mount(container, ctx) {
      try {
        container.innerHTML = "";

        var today = (window.State && typeof window.State.getTodayKey === "function")
          ? window.State.getTodayKey()
          : new Date().toISOString().split("T")[0];

        var status = "morning";
        try {
          if (window.State && typeof window.State.getDayStatus === "function") {
            status = await window.State.getDayStatus();
          }
        } catch (_) {}

        var blocks = [];
        try {
          if (window.State && typeof window.State.listBlocks === "function") {
            blocks = await window.State.listBlocks(today);
          }
        } catch (_) { blocks = []; }

        var nextBlock = getNextBlock(blocks);

        var perf = { pct: 0, done: 0, total: 0 };
        try {
          if (window.State && typeof window.State.getJournal === "function") {
            var j = await window.State.getJournal(today);
            if (window.State && typeof window.State.ensureJournalShape === "function") {
              j = window.State.ensureJournalShape(j, today);
            }
            var todos = (j && j.morning && Array.isArray(j.morning.todos)) ? j.morning.todos : [];
            var total = todos.length;
            var done = 0;
            for (var i = 0; i < todos.length; i++) if (todos[i] && todos[i].done) done++;
            var pct = total === 0 ? 0 : Math.round((done / total) * 100);
            perf = { pct: pct, done: done, total: total };
          }
        } catch (_) {}

        var budget = { income: 0, expense: 0, remaining: 0, remainingPct: 0, spentPct: 0, month: String(today).slice(0, 7) };
        try {
          if (window.State && typeof window.State.getMonthKey === "function" && typeof window.State.getMonthlySummary === "function") {
            var monthKey = window.State.getMonthKey(today);
            budget = await window.State.getMonthlySummary(monthKey);
          }
        } catch (_) {}

        var gk = { locked: 0, eligible: 0, purchased: 0, total: 0 };
        try {
          if (window.State && typeof window.State.getGatekeeperCounts === "function") {
            gk = await window.State.getGatekeeperCounts();
          }
        } catch (_) {}

        var root = document.createElement("div");
        root.className = "dashboard";

        var header = document.createElement("div");
        header.className = "dash-header";
        header.innerHTML =
          "<div class='dash-title'>Personal OS</div>" +
          "<div class='dash-sub'>The Architecture of Excellence.</div>";
        root.appendChild(header);

        var snapCard = document.createElement("div");
        snapCard.className = "dash-card";

        snapCard.innerHTML =
          "<div class='dash-meta'>Today</div>" +
          "<div class='dash-date'>" + escapeHtml(today) + "</div>" +
          "<div class='dash-status'>" + escapeHtml(String(status || "").toUpperCase()) + "</div>" +

          "<div style='margin-top:12px; display:flex; gap:12px; flex-wrap:wrap;'>" +
            "<div style='flex:1; min-width:140px;'>" +
              "<div class='dash-meta'>Performance</div>" +
              "<div style='font-size:22px; font-weight:800; margin-top:6px;'>" + Number(perf.pct || 0) + "%</div>" +
              "<div style='font-size:12px; opacity:0.75; margin-top:4px;'>" + Number(perf.done || 0) + "/" + Number(perf.total || 0) + " ToDos</div>" +
            "</div>" +

            "<div style='flex:1; min-width:140px;'>" +
              "<div class='dash-meta'>Next Block</div>" +
              "<div style='font-size:14px; font-weight:800; margin-top:6px;'>" +
                (nextBlock ? escapeHtml(nextBlock.start + "–" + nextBlock.end) : "—") +
              "</div>" +
              "<div style='font-size:12px; opacity:0.75; margin-top:4px;'>" +
                (nextBlock ? escapeHtml(nextBlock.title || "") : "Kein weiterer Block heute") +
              "</div>" +
            "</div>" +
          "</div>" +

          "<div style='margin-top:12px; display:flex; gap:12px; flex-wrap:wrap;'>" +
            "<div style='flex:1; min-width:140px;'>" +
              "<div class='dash-meta'>Budget Remaining (" + escapeHtml(budget.month || "") + ")</div>" +
              "<div style='font-size:18px; font-weight:900; margin-top:6px;'>" +
                formatMoney(budget.remaining) +
              "</div>" +
              "<div style='font-size:12px; opacity:0.75; margin-top:4px;'>" +
                "Income " + formatMoney(budget.income) + " · Expense " + formatMoney(budget.expense) +
              "</div>" +
              "<div style='height:10px; background: rgba(18,18,18,0.08); border-radius: 999px; overflow:hidden; margin-top:10px;'>" +
                "<div style='height:10px; width:" + clampPct(budget.spentPct) + "%; background: rgba(18,18,18,0.35);'></div>" +
              "</div>" +
              "<div style='font-size:12px; opacity:0.75; margin-top:6px;'>" +
                "Spent " + clampPct(budget.spentPct) + "% · Remaining " + clampPct(budget.remainingPct) + "%" +
              "</div>" +
            "</div>" +

            "<div style='flex:1; min-width:140px;'>" +
              "<div class='dash-meta'>Gatekeeper</div>" +
              "<div style='font-size:14px; font-weight:900; margin-top:6px;'>" +
                "Eligible: " + Number(gk.eligible || 0) +
              "</div>" +
              "<div style='font-size:12px; opacity:0.75; margin-top:4px;'>" +
                "Locked: " + Number(gk.locked || 0) + " · Purchased: " + Number(gk.purchased || 0) +
              "</div>" +
            "</div>" +
          "</div>";

        root.appendChild(snapCard);

        var primary = document.createElement("button");
        primary.className = "primary-action";
        primary.id = "primary-action";

        if (status === "morning") {
          primary.textContent = "Start Morning Setup";
          primary.onclick = function () {
            safeSetParams({ focus: "morning" });
            safeGo("mindset");
          };
        } else if (status === "execution") {
          primary.textContent = "Go to Execution";
          primary.onclick = function () { safeGo("path"); };
        } else if (status === "evening") {
          primary.textContent = "Start Evening Review";
          primary.onclick = function () {
            safeSetParams({ focus: "evening" });
            safeGo("mindset");
          };
        } else if (status === "closed") {
          primary.textContent = "View Day Summary";
          primary.onclick = function () { safeGo("vault"); };
        } else {
          primary.textContent = "Open Mindset";
          primary.onclick = function () { safeGo("mindset"); };
        }

        root.appendChild(primary);

        var quickRow = document.createElement("div");
        quickRow.className = "dash-quick";

        var btnJournal = document.createElement("button");
        btnJournal.type = "button";
        btnJournal.textContent = "Open Journal";
        btnJournal.onclick = function () {
          safeSetParams({ focus: "morning" });
          safeGo("mindset");
        };

        var btnTxn = document.createElement("button");
        btnTxn.type = "button";
        btnTxn.textContent = "Add Transaction";
        btnTxn.onclick = function () {
          safeSetParams({ focus: "addTransaction" });
          safeGo("finance");
        };

        var btnGK = document.createElement("button");
        btnGK.type = "button";
        btnGK.textContent = "Add Gatekeeper";
        btnGK.onclick = function () {
          safeSetParams({ focus: "addGatekeeper" });
          safeGo("finance");
        };

        quickRow.appendChild(btnJournal);
        quickRow.appendChild(btnTxn);
        quickRow.appendChild(btnGK);
        root.appendChild(quickRow);

        var blockCard = document.createElement("div");
        blockCard.className = "dash-card";
        blockCard.innerHTML = "<div style='font-weight:900; margin-bottom:8px;'>Quick Add Block</div>";

        var startInput = document.createElement("input");
        startInput.placeholder = "Start (HH:MM)";
        startInput.inputMode = "numeric";

        var endInput = document.createElement("input");
        endInput.placeholder = "End (HH:MM)";
        endInput.inputMode = "numeric";

        var titleInput = document.createElement("input");
        titleInput.placeholder = "Title";

        var addBlockBtn = document.createElement("button");
        addBlockBtn.type = "button";
        addBlockBtn.textContent = "Add Block";

        var msg = document.createElement("div");
        msg.style.fontSize = "13px";
        msg.style.opacity = "0.75";
        msg.style.marginTop = "8px";

        addBlockBtn.onclick = async function () {
          msg.textContent = "";

          var s = String(startInput.value || "").trim();
          var e = String(endInput.value || "").trim();
          var t = String(titleInput.value || "").trim();

          if (!s || !e || !t) {
            msg.textContent = "Bitte Start/Ende/Titel ausfüllen.";
            return;
          }

          var id = null;
          try {
            if (window.State && typeof window.State.addBlock === "function") {
              id = await window.State.addBlock({ date: today, start: s, end: e, title: t });
            }
          } catch (_) { id = null; }

          if (!id) {
            msg.textContent = "Konnte Block nicht speichern.";
            return;
          }

          startInput.value = "";
          endInput.value = "";
          titleInput.value = "";
          msg.textContent = "Block gespeichert.";

          safeGo("dashboard");
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

      function safeGo(screen) {
        try {
          if (window.Router && typeof window.Router.go === "function") window.Router.go(screen);
        } catch (_) {}
      }

      function safeSetParams(obj) {
        try {
          if (!window.Router) return;
          if (typeof window.Router.setParams === "function") { window.Router.setParams(obj); return; }
          if (typeof window.Router.setParam === "function" && obj && typeof obj === "object") {
            for (var k in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, k)) window.Router.setParam(k, obj[k]);
            }
          }
        } catch (_) {}
      }

      function getNextBlock(blocks) {
        try {
          if (!Array.isArray(blocks) || blocks.length === 0) return null;

          var now = new Date();
          var nowMin = now.getHours() * 60 + now.getMinutes();

          // 1) active block (start <= now < end)
          for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b || !b.start || !b.end) continue;
            var sMin = timeToMinutesSafe(b.start);
            var eMin = timeToMinutesSafe(b.end);
            if (sMin <= nowMin && nowMin < eMin) return b;
          }

          // 2) next upcoming
          for (var j = 0; j < blocks.length; j++) {
            var bb = blocks[j];
            if (!bb || !bb.start) continue;
            var st = timeToMinutesSafe(bb.start);
            if (st > nowMin) return bb;
          }

          return null;
        } catch (_) {
          return null;
        }
      }

      function timeToMinutesSafe(str) {
        try {
          if (window.State && typeof window.State.timeToMinutes === "function") return window.State.timeToMinutes(str);
        } catch (_) {}
        var parts = String(str || "").split(":");
        var h = parseInt(parts[0] || "0", 10);
        var m = parseInt(parts[1] || "0", 10);
        return h * 60 + m;
      }

      function clampPct(n) {
        var x = Number(n || 0);
        if (x < 0) return 0;
        if (x > 100) return 100;
        return Math.round(x);
      }

      function formatMoney(n) {
        var v = Number(n || 0);
        var sign = v < 0 ? "-" : "";
        var abs = Math.abs(v);
        var s = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
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
})();
