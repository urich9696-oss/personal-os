/* app.js — Batch 3
   Adds:
   - Maintenance tab: manage Habits + Daily Tasks and check them off for today
   - Performance score on Dashboard:
     score = completed_today / total_active_today  (0..100)
   - Journal/Vault from Batch 2 retained
*/

(function () {
  "use strict";

  var APP_VERSION = "1.1.0";

  function $(id) { return document.getElementById(id); }

  // ---------- Preferences (currency / language / measurement) ----------
  var Prefs = { currency: "EUR", language: "system", measure: "metric" };

  var CURRENCIES = [
    { code: "EUR", label: "Euro (€)" },
    { code: "USD", label: "US Dollar ($)" },
    { code: "GBP", label: "British Pound (£)" },
    { code: "CHF", label: "Swiss Franc (CHF)" },
    { code: "JPY", label: "Japanese Yen (¥)" },
    { code: "CAD", label: "Canadian Dollar (C$)" },
    { code: "AUD", label: "Australian Dollar (A$)" },
    { code: "SEK", label: "Swedish Krona (kr)" },
    { code: "NOK", label: "Norwegian Krone (kr)" },
    { code: "DKK", label: "Danish Krone (kr)" },
    { code: "PLN", label: "Polish Złoty (zł)" }
  ];

  var LANGUAGES = [
    { code: "system", label: "System default" },
    { code: "en", label: "English" },
    { code: "de", label: "Deutsch" }
  ];

  var MEASURES = [
    { code: "metric", label: "Metric (km, kg)" },
    { code: "imperial", label: "Imperial (mi, lb)" }
  ];

  var PREF_KEYS = { currency: "pref_currency", language: "pref_language", measure: "pref_measure" };

  function effectiveLang() {
    if (Prefs.language === "de" || Prefs.language === "en") return Prefs.language;
    var n = ((navigator && navigator.language) || "en").toLowerCase();
    return n.indexOf("de") === 0 ? "de" : "en";
  }
  function localeTag() { return effectiveLang() === "de" ? "de-DE" : "en-US"; }

  // Module/tile/page NAMES are intentionally NOT translated — only inputs,
  // instructions, labels, placeholders, buttons and messages are localized.
  var I18N = {
    de: {
      // Dashboard chrome
      "Modules": "Module",
      "Current Focus": "Aktueller Fokus",
      "Relevant Insights": "Relevante Hinweise",
      "Priority": "Priorität",
      "Next": "Nächstes",
      "Budget": "Budget",
      "Upcoming": "Demnächst",
      "Open calendar": "Kalender öffnen",
      "Today’s agenda": "Heutige Agenda",
      "Add an entry": "Eintrag hinzufügen",
      "More entries": "Weitere Einträge",
      "Week": "Woche",
      "Edit": "Bearbeiten",
      "Edit Entry": "Eintrag bearbeiten",
      "Save Changes": "Änderungen speichern",
      "Day Structures": "Tagesstrukturen",
      "Reusable day plans": "Wiederverwendbare Tagespläne",
      "Apply to date": "Auf Datum anwenden",
      "Use": "Verwenden",
      "Tap an hour to add an entry.": "Tippe auf eine Stunde, um einen Eintrag hinzuzufügen.",
      "Save today as structure": "Heute als Struktur speichern",
      "Routines": "Routinen",
      "Journal": "Journal",
      "Today overview": "Heute im Überblick",
      "Reminder": "Erinnerung",
      "Time Block": "Zeitblock",
      "Advanced reflection": "Vertiefende Reflexion",
      "One thing for tomorrow": "Eine Sache für morgen",
      "Journal Archive": "Journal-Archiv",

      // Module subtitles / instructions
      "Plan your day in time blocks. Load a template to start fast.": "Plane deinen Tag in Zeitblöcken. Lade eine Vorlage für einen schnellen Start.",
      "See blocks and reminders by day.": "Sieh Blöcke und Erinnerungen nach Tag.",
      "Reflect and realign — Morning and Evening flows.": "Reflektieren und neu ausrichten — Morgen- und Abend-Flow.",
      "Habits and Daily Tasks. Check them off — this feeds your Performance score.": "Gewohnheiten und Tagesaufgaben. Hake sie ab — das speist deinen Leistungs-Score.",
      "Monthly budget, recurring costs, spending breakdown, and the 72h Gatekeeper.": "Monatsbudget, wiederkehrende Kosten, Ausgabenübersicht und der 72h-Türsteher.",
      "Your immutable archive of closed days.": "Dein unveränderliches Archiv abgeschlossener Tage.",
      "Back up, restore, and reset your PERSONAL OS.": "Sichern, Wiederherstellen und Zurücksetzen deines PERSONAL OS.",

      // Section labels (card headers) + metas
      "Performance": "Leistung",
      "Today": "Heute",
      "Add Items": "Einträge hinzufügen",
      "Create your system": "Baue dein System",
      "Today Checklist": "Heutige Checkliste",
      "Tap to toggle": "Zum Umschalten tippen",
      "Manage Items": "Einträge verwalten",
      "Deactivate without deleting": "Deaktivieren ohne Löschen",
      "Today’s Blocks": "Heutige Blöcke",
      "Add Block": "Block hinzufügen",
      "Time-boxed focus": "Fokus in Zeitblöcken",
      "Templates": "Vorlagen",
      "One-tap day plans": "Tagespläne mit einem Tipp",
      "Agenda": "Agenda",
      "Add Reminder": "Erinnerung hinzufügen",
      "Selected day": "Ausgewählter Tag",
      "Block": "Block",
      "Reminder": "Erinnerung",
      "All day": "Ganztägig",
      "Nothing scheduled for this day.": "Für diesen Tag ist nichts geplant.",
      "No upcoming events.": "Keine anstehenden Einträge.",
      "Spending Breakdown": "Ausgabenübersicht",
      "Set Monthly Budget": "Monatsbudget festlegen",
      "Add Expense": "Ausgabe hinzufügen",
      "Track your spending": "Behalte deine Ausgaben im Blick",
      "Recurring Expenses": "Wiederkehrende Ausgaben",
      "Charged every month": "Wird jeden Monat berechnet",
      "72h Gatekeeper": "72h-Türsteher",
      "Beat impulse purchases": "Impulskäufe verhindern",
      "Morning Flow": "Morgen-Flow",
      "Evening Flow": "Abend-Flow",
      "Closed Days": "Abgeschlossene Tage",
      "Read-only": "Nur Lesen",
      "Preferences": "Präferenzen",
      "Regional & display": "Region & Anzeige",
      "Export Data": "Daten exportieren",
      "Download a JSON backup": "JSON-Sicherung herunterladen",
      "Import Data": "Daten importieren",
      "Restore from a backup file": "Aus einer Sicherungsdatei wiederherstellen",
      "Danger Zone": "Gefahrenzone",
      "Erase all data": "Alle Daten löschen",
      "About": "Über",

      // Field labels
      "New Habit": "Neue Gewohnheit",
      "New Daily Task": "Neue Tagesaufgabe",
      "Category": "Kategorie",
      "Primary Focus": "Hauptfokus",
      "Gratitude": "Dankbarkeit",
      "Intention": "Absicht",
      "Wins": "Erfolge",
      "Lessons": "Lektionen",
      "Master Question 1": "Meisterfrage 1",
      "Master Question 2": "Meisterfrage 2",
      "Master Question 3": "Meisterfrage 3",
      "Master Question 4": "Meisterfrage 4",
      "Title": "Titel",
      "Date": "Datum",
      "Time": "Zeit",
      "Start": "Start",
      "End": "Ende",
      "Save today as template": "Heute als Vorlage speichern",
      "Amount": "Betrag",
      "Amount / month": "Betrag / Monat",
      "Note": "Notiz",
      "Item": "Artikel",
      "Name": "Name",
      "Backup file": "Sicherungsdatei",
      "Confirmation": "Bestätigung",
      "Currency": "Währung",
      "Language": "Sprache",
      "Measurement system": "Maßsystem",
      "Applies to unit-based values as they are added.": "Gilt für einheitenbasierte Werte, sobald sie hinzukommen.",

      // Placeholders
      "e.g., Deep Work": "z. B. Konzentriertes Arbeiten",
      "e.g., Call the dentist": "z. B. Zahnarzt anrufen",
      "Optional details": "Optionale Details",
      "Template name (e.g., Workday)": "Vorlagenname (z. B. Arbeitstag)",
      "e.g., Groceries": "z. B. Lebensmittel",
      "e.g., Rent": "z. B. Miete",
      "e.g., New headphones": "z. B. Neue Kopfhörer",
      "Type RESET to confirm": "Zum Bestätigen RESET eingeben",
      "What matters most today?": "Was ist heute am wichtigsten?",
      "Write 3 things you’re grateful for.": "Schreibe 3 Dinge auf, für die du dankbar bist.",
      "Who do you choose to be today?": "Wer möchtest du heute sein?",
      "What went well today?": "Was lief heute gut?",
      "What did you learn today?": "Was hast du heute gelernt?",

      // Buttons
      "Add Habit": "Gewohnheit hinzufügen",
      "Add Task": "Aufgabe hinzufügen",
      "Save Morning": "Morgen speichern",
      "Save Evening": "Abend speichern",
      "Close Day to Vault": "Tag im Tresor abschließen",
      "Start Morning Flow": "Morgen-Flow starten",
      "Start Evening Flow": "Abend-Flow starten",
      "Back to Vault List": "Zurück zur Tresor-Liste",
      "Remove": "Entfernen",
      "Delete": "Löschen",
      "Load": "Laden",
      "Save Template": "Vorlage speichern",
      "Create ‘Workday’ template": "Vorlage „Arbeitstag“ erstellen",
      "Save Budget": "Budget speichern",
      "Lock for 72h": "Für 72h sperren",
      "Approve": "Genehmigen",
      "Let it go": "Loslassen",
      "Cancel": "Abbrechen",
      "Add Recurring": "Wiederkehrend hinzufügen",
      "Go to today": "Zu heute",
      "Export Backup": "Sicherung exportieren",
      "Import & Merge": "Importieren & zusammenführen",
      "Reset PERSONAL OS": "PERSONAL OS zurücksetzen",
      "Reload": "Neu laden",

      // Toasts / messages
      "Preferences saved.": "Einstellungen gespeichert.",
      "Habit added.": "Gewohnheit hinzugefügt.",
      "Task added.": "Aufgabe hinzugefügt.",
      "Block added.": "Block hinzugefügt.",
      "Block removed.": "Block entfernt.",
      "Reminder added.": "Erinnerung hinzugefügt.",
      "Reminder removed.": "Erinnerung entfernt.",
      "Reminder updated.": "Erinnerung aktualisiert.",
      "Entry updated.": "Eintrag aktualisiert.",
      "Day structure applied.": "Tagesstruktur angewendet.",
      "Expense added.": "Ausgabe hinzugefügt.",
      "Expense removed.": "Ausgabe entfernt.",
      "Recurring expense added.": "Wiederkehrende Ausgabe hinzugefügt.",
      "Recurring expense removed.": "Wiederkehrende Ausgabe entfernt.",
      "Budget saved.": "Budget gespeichert.",
      "Locked for 72 hours.": "Für 72 Stunden gesperrt.",
      "Approved & logged as expense.": "Genehmigt & als Ausgabe verbucht.",
      "Released. Money saved.": "Losgelassen. Geld gespart.",
      "Cancelled.": "Abgebrochen.",
      "Template saved.": "Vorlage gespeichert.",
      "Template deleted.": "Vorlage gelöscht.",
      "Workday template created.": "Vorlage „Arbeitstag“ erstellt.",
      "Morning saved.": "Morgen gespeichert.",
      "Evening saved.": "Abend gespeichert.",
      "Day closed to Vault.": "Tag im Tresor abgeschlossen.",
      "Checked.": "Abgehakt.",
      "Unchecked.": "Abwahl aufgehoben.",
      "Updated.": "Aktualisiert.",
      "Update failed.": "Aktualisierung fehlgeschlagen.",
      "Add failed.": "Hinzufügen fehlgeschlagen.",
      "Save failed.": "Speichern fehlgeschlagen.",
      "Habit name required.": "Name der Gewohnheit erforderlich.",
      "Task name required.": "Aufgabenname erforderlich.",
      "Title required.": "Titel erforderlich.",
      "Backup exported.": "Sicherung exportiert.",
      "Choose a file first.": "Wähle zuerst eine Datei.",
      "Could not read file.": "Datei konnte nicht gelesen werden.",
      "Invalid backup file.": "Ungültige Sicherungsdatei.",
      "All data cleared.": "Alle Daten gelöscht.",
      "Type RESET to confirm.": "Zum Bestätigen RESET eingeben.",
      "Vault is immutable. Today is already closed.": "Der Tresor ist unveränderlich. Heute ist bereits abgeschlossen.",
      "Export failed.": "Export fehlgeschlagen.",
      "Reset failed.": "Zurücksetzen fehlgeschlagen.",
      "Nothing archived yet": "Noch nichts archiviert",
      "No budget set": "Kein Budget festgelegt"
    }
  };

  function tr(s) {
    if (s == null) return s;
    if (effectiveLang() === "de" && I18N.de[s]) return I18N.de[s];
    return s;
  }

  function applyLang() {
    try { document.documentElement.lang = effectiveLang(); } catch (e) {}
  }

  async function loadPrefs() {
    try {
      Prefs.currency = (await DB.metaGet("pref_currency", "EUR")) || "EUR";
      Prefs.language = (await DB.metaGet("pref_language", "system")) || "system";
      Prefs.measure = (await DB.metaGet("pref_measure", "metric")) || "metric";
    } catch (e) {}
    applyLang();
  }

  async function savePref(key, value) {
    Prefs[key] = value;
    try { await DB.metaSet(PREF_KEYS[key], value); } catch (e) {}
    applyLang();
  }

  // ---------- Utilities ----------
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function monthKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }
  function formatNiceDate(d) {
    try { return new Intl.DateTimeFormat(localeTag(), { weekday: "short", month: "short", day: "2-digit" }).format(d); }
    catch (e) { return dayKey(d); }
  }

  function parseDayKey(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return dayKey(d) === value ? d : null;
  }

  function addDays(date, amount) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    d.setDate(d.getDate() + amount);
    return d;
  }

  function monthBounds(date) {
    var first = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
    var last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);
    return { first: first, last: last, start: dayKey(first), end: dayKey(last) };
  }

  function weekBounds(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    var mondayFirst = effectiveLang() === "de";
    var offset = mondayFirst ? ((d.getDay() + 6) % 7) : d.getDay();
    var first = addDays(d, -offset);
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(first, i));
    return { first: first, last: days[6], start: dayKey(first), end: dayKey(days[6]), days: days };
  }

  function hmToMinutes(value) {
    var m = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!m) return null;
    var hours = Number(m[1]);
    var minutes = Number(m[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function minutesToHM(value) {
    var minutes = Math.max(0, Math.min((24 * 60) - 1, Number(value) || 0));
    return pad2(Math.floor(minutes / 60)) + ":" + pad2(minutes % 60);
  }

  function addMinutesToHM(value, amount) {
    var minutes = hmToMinutes(value);
    return minutes === null ? "" : minutesToHM(minutes + amount);
  }

  function eventEnd(event) {
    return event.end || addMinutesToHM(event.time, 60);
  }

  function formatWeekRange(bounds) {
    try {
      var formatter = new Intl.DateTimeFormat(localeTag(), { day: "2-digit", month: "short" });
      return formatter.format(bounds.first) + " – " + formatter.format(bounds.last);
    } catch (e) {
      return bounds.start + " – " + bounds.end;
    }
  }

  function formatMonthTitle(date) {
    try { return new Intl.DateTimeFormat(localeTag(), { month: "long", year: "numeric" }).format(date); }
    catch (e) { return monthKey(date); }
  }

  async function listCalendarEvents(startDayKey, endDayKey) {
    var results = await Promise.all([
      DB.listBlocksByRange(startDayKey, endDayKey),
      DB.listRemindersByRange(startDayKey, endDayKey)
    ]);
    var events = [];
    results[0].forEach(function (b) {
      events.push({
        type: "block", id: b.id, dayKey: b.dayKey, time: b.start || "",
        end: b.end || "", title: b.title, note: "", done: false
      });
    });
    results[1].forEach(function (r) {
      events.push({
        type: "reminder", id: r.id, dayKey: r.dayKey, time: r.time || "",
        end: r.end || "", title: r.title, note: r.note || "", done: !!r.done
      });
    });
    events.sort(function (a, b) {
      var aTime = a.time || "00:00";
      var bTime = b.time || "00:00";
      return (a.dayKey + aTime + a.title).localeCompare(b.dayKey + bTime + b.title);
    });
    return events;
  }

  async function upcomingCalendarEvents(fromDate, days, limit) {
    var start = dayKey(fromDate);
    var end = dayKey(addDays(fromDate, days || 14));
    var nowTime = pad2(fromDate.getHours()) + ":" + pad2(fromDate.getMinutes());
    var events = await listCalendarEvents(start, end);
    return events.filter(function (event) {
      if (event.done) return false;
      if (event.dayKey !== start || !event.time) return true;
      return event.time >= nowTime;
    }).slice(0, limit || 5);
  }

  function formatCalendarEventWhen(event, todayKey) {
    var eventDate = parseDayKey(event.dayKey);
    var dateLabel = event.dayKey === todayKey ? tr("Today") : (eventDate ? formatNiceDate(eventDate) : event.dayKey);
    return dateLabel + " · " + (event.time || tr("All day"));
  }

  function qs() {
    try { return new URLSearchParams(location.search); } catch (e) { return null; }
  }

  function getHashRoute() {
    var h = location.hash || "";
    if (h.indexOf("#/") === 0) return h.slice(2);
    return "";
  }

  function parseHash() {
    var raw = getHashRoute();
    var parts = raw.split("?");
    var route = (parts[0] || "dashboard").trim() || "dashboard";
    var params = new URLSearchParams(parts[1] || "");
    return { route: route, params: params };
  }

  function setHash(route, params) {
    var p = params ? params.toString() : "";
    location.hash = "#/" + route + (p ? ("?" + p) : "");
  }

  // ---------- Toast ----------
  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = tr(msg);
    el.classList.add("is-show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-show"); }, 2200);
  }

  // ---------- View timers (cleared on every route render) ----------
  var Timers = {
    _ids: [],
    add: function (id) { this._ids.push(id); return id; },
    clearAll: function () {
      for (var i = 0; i < this._ids.length; i++) {
        try { clearInterval(this._ids[i]); } catch (e) {}
      }
      this._ids = [];
    }
  };

  // ---------- Kill-Switch ----------
  function hasNoSwFlag() {
    try { var q = qs(); return q && q.get("nosw") === "1"; } catch (e) { return false; }
  }

  async function runKillSwitchIfNeeded() {
    if (!hasNoSwFlag()) return false;

    try {
      if ("serviceWorker" in navigator) {
        var regs = await navigator.serviceWorker.getRegistrations();
        for (var i = 0; i < regs.length; i++) {
          try { await regs[i].unregister(); } catch (e) {}
        }
      }

      if (window.caches && caches.keys) {
        var keys = await caches.keys();
        for (var k = 0; k < keys.length; k++) {
          try { await caches.delete(keys[k]); } catch (e) {}
        }
      }

      var url = new URL(location.href);
      url.searchParams.delete("nosw");
      location.replace(url.toString());
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- Router ----------
  var Router = (function () {
    var current = "dashboard";

    function go(route, paramsObj) {
      var params = new URLSearchParams(paramsObj || {});
      setHash(route || "dashboard", params);
    }

    function getCurrent() { return current; }

    function setNavActive(route) {
      var btns = document.querySelectorAll(".navbtn");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var r = b.getAttribute("data-route");
        var active = (route === r);
        b.classList.toggle("is-active", !!active);
        b.setAttribute("aria-current", active ? "page" : "false");
      }
    }

    async function render() {
      var parsed = parseHash();
      current = parsed.route;

      Timers.clearAll();
      renderHeader(parsed);
      renderTabBar(parsed);

      var view = $("view");
      if (!view) return;

      view.innerHTML = "";
      var inner = document.createElement("div");
      inner.className = "view__inner";
      view.appendChild(inner);
      view.scrollTop = 0;

      try {
        if (current === "dashboard") await Screens.dashboard(inner);
        else if (current === "path") await Screens.path(inner);
        else if (current === "calendar") await Screens.calendar(inner, parsed.params);
        else if (current === "alignment") await Screens.alignment(inner, parsed.params);
        else if (current === "maintenance") await Screens.maintenance(inner);
        else if (current === "finance") await Screens.finance(inner);
        else if (current === "vault") await Screens.vault(inner, parsed.params);
        else if (current === "settings") await Screens.settings(inner);
        else Screens.notFound(inner, current);
      } catch (e) {
        Screens.bootError(inner, "Render Error", String(e && e.message ? e.message : e));
      }
    }

    function onChange(fn) { window.addEventListener("hashchange", fn); }

    return { go: go, render: render, onChange: onChange, getCurrent: getCurrent };
  })();

  // ---------- State ----------
  var State = (function () {
    var s = {
      today: dayKey(new Date()),
      month: monthKey(new Date()),

      // Alignment
      morning: null,
      evening: null,
      vaultList: [],
      vaultDetail: null,

      // Maintenance
      habits: [],
      tasks: [],
      checksToday: [],
      perf: { total: 0, done: 0, score: 0 }
    };

    function defaultMorning() {
      return { focus: "", gratitude: "", intention: "" };
    }
    function defaultEvening() {
      return { wins: "", lessons: "", master1: "", master2: "", master3: "", master4: "" };
    }

    async function loadTodayJournal() {
      var day = s.today;
      var m = await DB.getJournal(day, "morning");
      var e = await DB.getJournal(day, "evening");
      s.morning = m ? (m.payload || defaultMorning()) : defaultMorning();
      s.evening = e ? (e.payload || defaultEvening()) : defaultEvening();
    }

    async function saveMorning(payload) {
      s.morning = payload;
      await DB.upsertJournal(s.today, "morning", payload);
    }

    async function saveEvening(payload) {
      s.evening = payload;
      await DB.upsertJournal(s.today, "evening", payload);
    }

    async function loadVaultList() { s.vaultList = await DB.listVault(); }

    async function loadVaultDetail(dayKey) {
      s.vaultDetail = await DB.getVaultSnapshot(dayKey);
      return s.vaultDetail;
    }

    async function closeDayToVault() {
      var day = s.today;
      var existing = await DB.getVaultSnapshot(day);
      if (existing) return { ok: false, reason: "already_closed" };

      var allJournal = await DB.listJournalByDay(day);
      var morning = null, evening = null;

      for (var i = 0; i < allJournal.length; i++) {
        if (allJournal[i].flow === "morning") morning = allJournal[i].payload || null;
        if (allJournal[i].flow === "evening") evening = allJournal[i].payload || null;
      }

      // Maintenance snapshot (today)
      var maint = await computeMaintenanceSnapshot();

      var snapshot = {
        dayKey: day,
        journal: { morning: morning, evening: evening },
        maintenance: maint,
        path: null,
        finance: null,
        gatekeeper: null
      };

      await DB.putVaultSnapshot(day, snapshot);
      return { ok: true };
    }

    // ---- Maintenance ----
    async function loadMaintenance() {
      s.habits = await DB.listHabits();
      s.tasks = await DB.listTasks();
      s.checksToday = await DB.listChecksForDay(s.today);
      s.perf = computePerformanceLocal();
    }

    function isTargetChecked(kind, id) {
      var tkey = kind + ":" + id;
      for (var i = 0; i < s.checksToday.length; i++) {
        if (s.checksToday[i].targetKey === tkey) return true;
      }
      return false;
    }

    async function toggleCheck(kind, id, checked) {
      await DB.setChecked(s.today, kind, id, checked);
      s.checksToday = await DB.listChecksForDay(s.today);
      s.perf = computePerformanceLocal();
      return s.perf;
    }

    async function addHabit(name) {
      await DB.addHabit(name);
      s.habits = await DB.listHabits();
      s.perf = computePerformanceLocal();
    }

    async function addTask(name, category) {
      await DB.addTask(name, category);
      s.tasks = await DB.listTasks();
      s.perf = computePerformanceLocal();
    }

    async function setHabitActive(id, active) {
      await DB.setHabitActive(id, active);
      s.habits = await DB.listHabits();
      s.perf = computePerformanceLocal();
    }

    async function setTaskActive(id, active) {
      await DB.setTaskActive(id, active);
      s.tasks = await DB.listTasks();
      s.perf = computePerformanceLocal();
    }

    function computePerformanceLocal() {
      var activeHabits = s.habits.filter(function (h) { return !!h.active; });
      var activeTasks = s.tasks.filter(function (t) { return !!t.active; });
      var total = activeHabits.length + activeTasks.length;

      var done = 0;
      for (var i = 0; i < activeHabits.length; i++) {
        if (isTargetChecked("habit", activeHabits[i].id)) done++;
      }
      for (var j = 0; j < activeTasks.length; j++) {
        if (isTargetChecked("task", activeTasks[j].id)) done++;
      }

      var score = total > 0 ? Math.round((done / total) * 100) : 0;
      return { total: total, done: done, score: score };
    }

    async function computeMaintenanceSnapshot() {
      // Snapshot minimal summary
      var activeHabits = (await DB.listHabits()).filter(function (h) { return !!h.active; });
      var activeTasks = (await DB.listTasks()).filter(function (t) { return !!t.active; });
      var checks = await DB.listChecksForDay(s.today);

      var doneKeys = {};
      for (var i = 0; i < checks.length; i++) doneKeys[checks[i].targetKey] = true;

      var items = [];
      for (var a = 0; a < activeHabits.length; a++) {
        items.push({
          kind: "habit",
          id: activeHabits[a].id,
          name: activeHabits[a].name,
          done: !!doneKeys["habit:" + activeHabits[a].id]
        });
      }
      for (var b = 0; b < activeTasks.length; b++) {
        items.push({
          kind: "task",
          id: activeTasks[b].id,
          name: activeTasks[b].name,
          category: activeTasks[b].category || "General",
          done: !!doneKeys["task:" + activeTasks[b].id]
        });
      }

      var total = items.length;
      var done = items.filter(function (x) { return x.done; }).length;
      var score = total > 0 ? Math.round((done / total) * 100) : 0;

      return { total: total, done: done, score: score, items: items };
    }

    return {
      s: s,
      loadTodayJournal: loadTodayJournal,
      saveMorning: saveMorning,
      saveEvening: saveEvening,
      loadVaultList: loadVaultList,
      loadVaultDetail: loadVaultDetail,
      closeDayToVault: closeDayToVault,

      loadMaintenance: loadMaintenance,
      isTargetChecked: isTargetChecked,
      toggleCheck: toggleCheck,
      addHabit: addHabit,
      addTask: addTask,
      setHabitActive: setHabitActive,
      setTaskActive: setTaskActive
    };
  })();

  // ---------- UI helpers ----------
  function spacer(h) { var s = document.createElement("div"); s.style.height = (h || 12) + "px"; return s; }

  function textLine(title, meta) {
    var wrap = document.createElement("div");
    wrap.className = "card-heading";

    var t = document.createElement("div");
    t.className = "card-heading__title";
    t.textContent = tr(title);

    var m = document.createElement("div");
    m.className = "card-heading__meta";
    m.textContent = tr(meta);

    wrap.appendChild(t);
    wrap.appendChild(m);
    return wrap;
  }

  function sectionTitle(title, subtitle) {
    var wrap = document.createElement("div");
    wrap.className = "stack";
    var h = document.createElement("div");
    h.className = "page-title";

    var t = document.createElement("div");
    t.className = "h1";
    t.textContent = title; // module/page name — never translated

    var p = document.createElement("div");
    p.className = "p";
    p.textContent = tr(subtitle);

    h.appendChild(t);
    h.appendChild(p);
    wrap.appendChild(h);
    return wrap;
  }

  function widgetCard(title, meta, value) {
    var c = document.createElement("div");
    c.className = "glass card";
    c.appendChild(textLine(title, meta));
    c.appendChild(spacer(10));
    var v = document.createElement("div");
    v.className = "h1";
    v.style.fontSize = "18px";
    v.style.fontWeight = "820";
    v.style.margin = "0";
    v.textContent = value;
    c.appendChild(v);
    return c;
  }

  function labeledTextarea(label, value, placeholder) {
    var wrap = document.createElement("div");
    var l = document.createElement("div");
    l.className = "label";
    l.textContent = tr(label);

    var t = document.createElement("textarea");
    t.className = "input textarea";
    t.value = value || "";
    t.placeholder = tr(placeholder || "");

    wrap.appendChild(l);
    wrap.appendChild(t);
    return { wrap: wrap, textarea: t };
  }

  function labeledInput(label, value, placeholder) {
    var wrap = document.createElement("div");
    var l = document.createElement("div");
    l.className = "label";
    l.textContent = tr(label);

    var i = document.createElement("input");
    i.className = "input";
    i.type = "text";
    i.value = value || "";
    i.placeholder = tr(placeholder || "");

    wrap.appendChild(l);
    wrap.appendChild(i);
    return { wrap: wrap, input: i };
  }

  function makeInput(type, value, placeholder, attrs) {
    var i = document.createElement("input");
    i.className = "input";
    i.type = type || "text";
    if (value !== null && typeof value !== "undefined") i.value = value;
    if (placeholder) i.placeholder = placeholder;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { i.setAttribute(k, attrs[k]); });
    }
    return i;
  }

  function fieldWrap(labelText, el) {
    var wrap = document.createElement("div");
    var l = document.createElement("div");
    l.className = "label";
    l.textContent = tr(labelText);
    wrap.appendChild(l);
    wrap.appendChild(el);
    return wrap;
  }

  function formatMoney(n) {
    var v = Number(n) || 0;
    try {
      return new Intl.NumberFormat(localeTag(), { style: "currency", currency: Prefs.currency || "EUR" }).format(v);
    } catch (e) {
      return v.toFixed(2);
    }
  }

  function makeSelect(options, value, onChange) {
    var s = document.createElement("select");
    s.className = "input select";
    for (var i = 0; i < options.length; i++) {
      var opt = document.createElement("option");
      opt.value = options[i].code;
      opt.textContent = options[i].label;
      if (options[i].code === value) opt.selected = true;
      s.appendChild(opt);
    }
    s.onchange = function () { onChange(s.value); };
    return s;
  }

  function formatCountdown(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var parts = [];
    if (d) parts.push(d + "d");
    parts.push(h + "h");
    parts.push(m + "m");
    parts.push(s + "s");
    return parts.join(" ");
  }

  // ---------- Outline SVG icons (single consistent set) ----------
  var ICONS = {
    home: '<path d="M3 10.7 12 3l9 7.7"/><path d="M5.5 9.5V21h13V9.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.65 1.65 0 0 0 .33 1.82l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.08a1.65 1.65 0 0 0-2.82-1.17l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.65 1.65 0 0 0 4.6 13.5H4.5a2 2 0 0 1 0-4h.08A1.65 1.65 0 0 0 5.75 6.7l-.05-.05A2 2 0 1 1 8.53 3.8l.05.05A1.65 1.65 0 0 0 11.4 2.7V2.5a2 2 0 0 1 4 0v.08a1.65 1.65 0 0 0 2.82 1.17l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05a1.65 1.65 0 0 0-.38 1.82V6.7a1.65 1.65 0 0 0 1.5 1V9.5a2 2 0 0 1 0 4z"/>',
    path: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    alignment: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6z"/>',
    maintenance: '<path d="M3 12h4l2.5 6 5-12 2.5 6H21"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="4.5" cy="18" r="1.5"/>',
    journal: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22.5z"/><path d="M5 4.5v18M9 7h7M9 11h7"/>',
    finance: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M15 14h3"/>',
    calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3v5M16.5 3v5M3.5 10h17"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
    vault: '<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M5.5 8.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8.5"/><path d="M10 12.5h4"/>',
    profile: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    dashboard: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'
  };

  function svgIcon(name) {
    var span = document.createElement("span");
    span.className = "ic";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'
      + (ICONS[name] || "") + '</svg>';
    return span;
  }

  function headerTitle(route) {
    var map = {
      path: tr("Day Structures"), alignment: tr("Journal"), maintenance: tr("Routines"),
      calendar: "Calendar", finance: "Finance", vault: "Vault", settings: "Settings"
    };
    return map[route] || "PERSONAL OS";
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else Router.go("dashboard");
  }

  function renderHeader(parsed) {
    var host = $("appheader");
    if (!host) return;
    host.innerHTML = "";
    var route = parsed.route;
    var row = document.createElement("div");
    row.className = "appheader__row";

    var primaryRoutes = ["dashboard", "calendar", "maintenance", "alignment", "finance"];
    if (primaryRoutes.indexOf(route) !== -1) {
      var brand = document.createElement("div");
      brand.className = "appheader__brand";
      var name = document.createElement("div");
      name.className = "appheader__name";
      name.textContent = route === "dashboard" ? tr("Today") : headerTitle(route);
      var sub = document.createElement("div");
      sub.className = "appheader__sub";
      sub.textContent = route === "dashboard" ? formatNiceDate(new Date()) : "PERSONAL OS";
      brand.appendChild(name);
      brand.appendChild(sub);

      var setBtn = document.createElement("button");
      setBtn.className = "hbtn hbtn--right";
      setBtn.type = "button";
      setBtn.setAttribute("aria-label", "Settings");
      setBtn.appendChild(svgIcon("settings"));
      setBtn.onclick = function () { Router.go("settings"); };

      row.appendChild(brand);
      row.appendChild(setBtn);
    } else {
      var back = document.createElement("button");
      back.className = "hbtn";
      back.type = "button";
      back.setAttribute("aria-label", "Back");
      back.appendChild(svgIcon("back"));
      back.onclick = function () { goBack(); };

      var title = document.createElement("div");
      title.className = "appheader__title";
      title.textContent = headerTitle(route);

      var home = document.createElement("button");
      home.className = "hbtn hbtn--right";
      home.type = "button";
      home.setAttribute("aria-label", "Dashboard");
      home.appendChild(svgIcon("home"));
      home.onclick = function () { Router.go("dashboard"); };

      row.appendChild(back);
      row.appendChild(title);
      row.appendChild(home);
    }
    host.appendChild(row);
  }

  function renderTabBar(parsed) {
    var host = $("appnav");
    if (!host) return;
    host.innerHTML = "";
    var activeRoute = parsed.route === "path" ? "calendar" : parsed.route;
    var tabs = [
      { route: "dashboard", label: tr("Today"), icon: "dashboard" },
      { route: "calendar", label: "Calendar", icon: "calendar" },
      { route: "maintenance", label: tr("Routines"), icon: "list" },
      { route: "alignment", label: tr("Journal"), icon: "journal" },
      { route: "finance", label: "Finance", icon: "finance" }
    ];
    var inner = document.createElement("div");
    inner.className = "appnav__inner";
    tabs.forEach(function (tab) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "navbtn" + (activeRoute === tab.route ? " is-active" : "");
      button.setAttribute("data-route", tab.route);
      button.setAttribute("aria-label", tab.label);
      button.setAttribute("aria-current", activeRoute === tab.route ? "page" : "false");
      button.appendChild(svgIcon(tab.icon));
      var label = document.createElement("span");
      label.textContent = tab.label;
      button.appendChild(label);
      button.onclick = function () { Router.go(tab.route); };
      inner.appendChild(button);
    });
    host.appendChild(inner);
    host.classList.toggle("is-hidden", ["settings", "vault"].indexOf(parsed.route) !== -1);
  }

  function progressBar(percent, leftLabel, rightLabel) {
    var pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
    var wrap = document.createElement("div");
    wrap.className = "progress";
    var track = document.createElement("div");
    track.className = "progress__track";
    var fill = document.createElement("div");
    fill.className = "progress__fill";
    fill.style.width = pct + "%";
    track.appendChild(fill);
    wrap.appendChild(track);
    if (leftLabel || rightLabel) {
      var meta = document.createElement("div");
      meta.className = "progress__meta";
      var l = document.createElement("span"); l.textContent = leftLabel || "";
      var r = document.createElement("span"); r.textContent = rightLabel || "";
      meta.appendChild(l); meta.appendChild(r);
      wrap.appendChild(meta);
    }
    return wrap;
  }

  // Chart colour palette (calm, muted, distinguishable slices)
  var PALETTE = [
    "#4E6678", "#4F7A5A", "#B88746", "#8A2D2D", "#6B5E8A",
    "#5E8A86", "#7C6F5A", "#3F5468", "#8A6D4F", "#607060", "#797979"
  ];

  var SVG_NS = "http://www.w3.org/2000/svg";

  function polarPoint(cx, cy, r, angleDeg) {
    var a = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    var start = polarPoint(cx, cy, r, endAngle);
    var end = polarPoint(cx, cy, r, startAngle);
    var largeArc = (endAngle - startAngle) <= 180 ? "0" : "1";
    return ["M", cx, cy, "L", start.x, start.y,
      "A", r, r, 0, largeArc, 0, end.x, end.y, "Z"].join(" ");
  }

  // slices: [{ label, value, color }]. Returns a DOM node with an SVG pie + legend.
  function pieChart(slices) {
    var total = 0;
    for (var i = 0; i < slices.length; i++) total += Number(slices[i].value) || 0;

    var wrap = document.createElement("div");
    wrap.className = "chart";

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "chart__svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Expense breakdown pie chart");

    var cx = 50, cy = 50, r = 46;

    if (total <= 0) {
      var empty = document.createElementNS(SVG_NS, "circle");
      empty.setAttribute("cx", cx); empty.setAttribute("cy", cy); empty.setAttribute("r", r);
      empty.setAttribute("fill", "rgba(0,0,0,.06)");
      svg.appendChild(empty);
    } else if (slices.length === 1) {
      var full = document.createElementNS(SVG_NS, "circle");
      full.setAttribute("cx", cx); full.setAttribute("cy", cy); full.setAttribute("r", r);
      full.setAttribute("fill", slices[0].color);
      svg.appendChild(full);
    } else {
      var angle = 0;
      for (var j = 0; j < slices.length; j++) {
        var frac = (Number(slices[j].value) || 0) / total;
        var sweep = frac * 360;
        var path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", arcPath(cx, cy, r, angle, angle + sweep));
        path.setAttribute("fill", slices[j].color);
        path.setAttribute("stroke", "#fff");
        path.setAttribute("stroke-width", "1");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
        angle += sweep;
      }
    }

    wrap.appendChild(svg);

    var legend = document.createElement("div");
    legend.className = "legend";
    for (var k = 0; k < slices.length; k++) {
      var s = slices[k];
      var pct = total > 0 ? Math.round(((Number(s.value) || 0) / total) * 100) : 0;

      var rowEl = document.createElement("div");
      rowEl.className = "legend__row";

      var sw = document.createElement("span");
      sw.className = "legend__swatch";
      sw.style.background = s.color;

      var lab = document.createElement("span");
      lab.className = "legend__label";
      lab.textContent = s.label;

      var val = document.createElement("span");
      val.className = "legend__val";
      val.textContent = formatMoney(s.value) + " · " + pct + "%";

      rowEl.appendChild(sw);
      rowEl.appendChild(lab);
      rowEl.appendChild(val);
      legend.appendChild(rowEl);
    }
    wrap.appendChild(legend);

    return wrap;
  }

  // Build expense slices from one-off transactions (grouped by note) + recurring items.
  function buildExpenseSlices(txns, recurringItems) {
    var map = {};
    var order = [];
    (txns || []).forEach(function (t) {
      var key = (t.note && t.note.trim()) ? t.note.trim() : "Uncategorized";
      if (!(key in map)) { map[key] = 0; order.push(key); }
      map[key] += Number(t.amount) || 0;
    });

    var slices = order.map(function (k) { return { label: k, value: map[k] }; });

    (recurringItems || []).forEach(function (rc) {
      if (rc.active === false) return;
      slices.push({ label: rc.name + " (monatlich)", value: Number(rc.amount) || 0 });
    });

    slices = slices.filter(function (s) { return s.value > 0; });
    slices.sort(function (a, b) { return b.value - a.value; });
    slices.forEach(function (s, i) { s.color = PALETTE[i % PALETTE.length]; });
    return slices;
  }

  function sectionHeader(title, meta) {
    var h = document.createElement("div");
    h.className = "section-header";
    var t = document.createElement("div");
    t.className = "section-header__title";
    t.textContent = title;
    h.appendChild(t);
    if (meta) {
      var m = document.createElement("div");
      m.className = "section-header__meta";
      m.textContent = meta;
      h.appendChild(m);
    }
    return h;
  }

  function moduleTile(opts) {
    var t = document.createElement("button");
    t.type = "button";
    t.className = "tile"
      + (opts.wide ? " tile--wide" : "")
      + (opts.muted ? " tile--muted" : "");
    t.setAttribute("aria-label", opts.name);
    t.onclick = function () { Router.go(opts.route, opts.params || {}); };

    var top = document.createElement("div");
    top.className = "tile__top";
    var ic = document.createElement("span");
    ic.className = "tile__icon";
    ic.appendChild(svgIcon(opts.icon));
    var chev = document.createElement("span");
    chev.className = "tile__chev";
    chev.appendChild(svgIcon("chevron"));
    top.appendChild(ic);
    top.appendChild(chev);
    t.appendChild(top);

    var name = document.createElement("div");
    name.className = "tile__name";
    name.textContent = opts.name;
    t.appendChild(name);

    if (opts.status) {
      var st = document.createElement("div");
      st.className = "tile__status";
      st.textContent = opts.status;
      t.appendChild(st);
    }

    if (typeof opts.progress === "number") {
      var sp = document.createElement("div");
      sp.className = "tile__spacer";
      t.appendChild(sp);
      t.appendChild(progressBar(opts.progress));
    }
    return t;
  }

  function insightRow(kind, title, desc) {
    var row = document.createElement("div");
    row.className = "insight";
    var dot = document.createElement("span");
    dot.className = "insight__dot" + (kind ? (" insight__dot--" + kind) : "");
    var body = document.createElement("div");
    body.className = "insight__body";
    var t = document.createElement("div");
    t.className = "insight__title";
    t.textContent = title;
    body.appendChild(t);
    if (desc) {
      var d = document.createElement("div");
      d.className = "insight__desc";
      d.textContent = desc;
      body.appendChild(d);
    }
    row.appendChild(dot);
    row.appendChild(body);
    return row;
  }

  function dashboardCalendarCard(nowDate, events) {
    var today = dayKey(nowDate);
    var bounds = monthBounds(nowDate);
    var eventsByDay = {};
    (events || []).forEach(function (event) {
      if (!eventsByDay[event.dayKey]) eventsByDay[event.dayKey] = [];
      eventsByDay[event.dayKey].push(event);
    });

    var card = document.createElement("section");
    card.className = "dashboard-calendar";
    card.setAttribute("aria-label", "Calendar");

    var header = document.createElement("div");
    header.className = "dashboard-calendar__header";
    var heading = document.createElement("div");
    var lead = document.createElement("div");
    lead.className = "dashboard-calendar__lead";
    lead.textContent = tr("Today") + " · " + formatNiceDate(nowDate);
    var title = document.createElement("div");
    title.className = "dashboard-calendar__title";
    title.textContent = formatMonthTitle(nowDate);
    heading.appendChild(lead);
    heading.appendChild(title);
    var open = document.createElement("button");
    open.type = "button";
    open.className = "dashboard-calendar__open";
    open.textContent = tr("Open calendar");
    open.onclick = function () { Router.go("calendar", { day: today }); };
    header.appendChild(heading);
    header.appendChild(open);
    card.appendChild(header);

    var weekdays = document.createElement("div");
    weekdays.className = "calendar__weekdays";
    var mondayFirst = effectiveLang() === "de";
    var weekdayBase = new Date(2023, 0, mondayFirst ? 2 : 1, 12, 0, 0, 0);
    for (var wi = 0; wi < 7; wi++) {
      var weekday = document.createElement("div");
      weekday.textContent = new Intl.DateTimeFormat(localeTag(), { weekday: "narrow" })
        .format(addDays(weekdayBase, wi));
      weekdays.appendChild(weekday);
    }
    card.appendChild(weekdays);

    var grid = document.createElement("div");
    grid.className = "calendar__grid dashboard-calendar__grid";
    var firstWeekday = bounds.first.getDay();
    var blankCount = mondayFirst ? ((firstWeekday + 6) % 7) : firstWeekday;
    for (var blank = 0; blank < blankCount; blank++) {
      var spacerCell = document.createElement("span");
      spacerCell.className = "calendar__blank";
      grid.appendChild(spacerCell);
    }

    for (var dayNumber = 1; dayNumber <= bounds.last.getDate(); dayNumber++) {
      (function (number) {
        var date = new Date(nowDate.getFullYear(), nowDate.getMonth(), number, 12, 0, 0, 0);
        var key = dayKey(date);
        var dayEvents = eventsByDay[key] || [];
        var button = document.createElement("button");
        button.type = "button";
        button.className = "calendar__day" + (key === today ? " calendar__day--today dashboard-calendar__day--today" : "");
        button.setAttribute("aria-label", formatNiceDate(date)
          + (key === today ? (", " + tr("Today")) : "")
          + (dayEvents.length ? (", " + dayEvents.length + " events") : ""));
        var numberEl = document.createElement("span");
        numberEl.textContent = String(number);
        button.appendChild(numberEl);
        if (dayEvents.length) {
          var dots = document.createElement("span");
          dots.className = "calendar__dots";
          if (dayEvents.some(function (event) { return event.type === "block"; })) {
            var blockDot = document.createElement("span");
            blockDot.className = "calendar__dot calendar__dot--block";
            dots.appendChild(blockDot);
          }
          if (dayEvents.some(function (event) { return event.type === "reminder" && !event.done; })) {
            var reminderDot = document.createElement("span");
            reminderDot.className = "calendar__dot calendar__dot--reminder";
            dots.appendChild(reminderDot);
          }
          button.appendChild(dots);
        }
        button.onclick = function () { Router.go("calendar", { day: key }); };
        grid.appendChild(button);
      })(dayNumber);
    }
    card.appendChild(grid);

    var todayEvents = eventsByDay[today] || [];
    var agenda = document.createElement("div");
    agenda.className = "dashboard-calendar__agenda";
    var agendaHeader = document.createElement("div");
    agendaHeader.className = "dashboard-calendar__agenda-header";
    agendaHeader.textContent = tr("Today’s agenda");
    agenda.appendChild(agendaHeader);
    if (!todayEvents.length) {
      var empty = document.createElement("button");
      empty.type = "button";
      empty.className = "dashboard-calendar__empty";
      empty.textContent = tr("Add an entry") + " →";
      empty.onclick = function () { Router.go("calendar", { day: today }); };
      agenda.appendChild(empty);
    } else {
      todayEvents.slice(0, 3).forEach(function (event) {
        var row = document.createElement("button");
        row.type = "button";
        row.className = "dashboard-calendar__event" + (event.done ? " is-done" : "");
        row.onclick = function () { Router.go("calendar", { day: today }); };
        var time = document.createElement("span");
        time.className = "dashboard-calendar__time";
        time.textContent = event.time || tr("All day");
        var eventTitle = document.createElement("span");
        eventTitle.className = "dashboard-calendar__event-title";
        eventTitle.textContent = event.title;
        row.appendChild(time);
        row.appendChild(eventTitle);
        agenda.appendChild(row);
      });
      if (todayEvents.length > 3) {
        var more = document.createElement("button");
        more.type = "button";
        more.className = "dashboard-calendar__more";
        more.textContent = "+" + (todayEvents.length - 3) + " " + tr("More entries");
        more.onclick = function () { Router.go("calendar", { day: today }); };
        agenda.appendChild(more);
      }
    }
    card.appendChild(agenda);
    return card;
  }

  function dashboardWeekCalendarCard(nowDate, events) {
    var bounds = weekBounds(nowDate);
    var today = dayKey(nowDate);
    var startHour = 6;
    var endHour = 23;
    var hourHeight = 48;
    var eventsByDay = {};
    (events || []).forEach(function (event) {
      if (!eventsByDay[event.dayKey]) eventsByDay[event.dayKey] = [];
      eventsByDay[event.dayKey].push(event);
    });

    var card = document.createElement("section");
    card.className = "dashboard-calendar week-calendar";
    card.setAttribute("aria-label", tr("Week") + " " + formatWeekRange(bounds));

    var header = document.createElement("div");
    header.className = "dashboard-calendar__header";
    var heading = document.createElement("div");
    var lead = document.createElement("div");
    lead.className = "dashboard-calendar__lead";
    lead.textContent = tr("Today") + " · " + formatNiceDate(nowDate);
    var title = document.createElement("div");
    title.className = "dashboard-calendar__title";
    title.textContent = tr("Week") + " · " + formatWeekRange(bounds);
    heading.appendChild(lead);
    heading.appendChild(title);
    var open = document.createElement("button");
    open.type = "button";
    open.className = "dashboard-calendar__open";
    open.textContent = tr("Open calendar");
    open.onclick = function () { Router.go("calendar", { day: today }); };
    header.appendChild(heading);
    header.appendChild(open);
    card.appendChild(header);

    var hint = document.createElement("div");
    hint.className = "week-calendar__hint";
    hint.textContent = tr("Tap an hour to add an entry.");
    card.appendChild(hint);

    var scroll = document.createElement("div");
    scroll.className = "week-calendar__scroll";
    var canvas = document.createElement("div");
    canvas.className = "week-calendar__canvas";

    var dayHeader = document.createElement("div");
    dayHeader.className = "week-calendar__days";
    var corner = document.createElement("span");
    corner.className = "week-calendar__corner";
    dayHeader.appendChild(corner);
    bounds.days.forEach(function (date) {
      var key = dayKey(date);
      var button = document.createElement("button");
      button.type = "button";
      button.className = "week-calendar__day" + (key === today ? " is-today" : "");
      button.onclick = function () { Router.go("calendar", { day: key }); };
      var weekday = document.createElement("span");
      weekday.textContent = new Intl.DateTimeFormat(localeTag(), { weekday: "short" }).format(date);
      var number = document.createElement("strong");
      number.textContent = String(date.getDate());
      button.appendChild(weekday);
      button.appendChild(number);
      dayHeader.appendChild(button);
    });
    canvas.appendChild(dayHeader);

    var body = document.createElement("div");
    body.className = "week-calendar__body";
    body.style.height = ((endHour - startHour) * hourHeight) + "px";
    var times = document.createElement("div");
    times.className = "week-calendar__times";
    for (var hour = startHour; hour <= endHour; hour++) {
      var label = document.createElement("span");
      label.className = "week-calendar__hour";
      label.style.top = ((hour - startHour) * hourHeight - 7) + "px";
      label.textContent = pad2(hour) + ":00";
      times.appendChild(label);
    }
    body.appendChild(times);

    bounds.days.forEach(function (date) {
      var key = dayKey(date);
      var column = document.createElement("div");
      column.className = "week-calendar__column" + (key === today ? " is-today" : "");
      for (var slotHour = startHour; slotHour < endHour; slotHour++) {
        (function (selectedHour) {
          var slot = document.createElement("button");
          slot.type = "button";
          slot.className = "week-calendar__slot";
          slot.style.top = ((selectedHour - startHour) * hourHeight) + "px";
          slot.setAttribute("aria-label", formatNiceDate(date) + " " + pad2(selectedHour) + ":00");
          slot.onclick = function () {
            Router.go("calendar", { day: key, time: pad2(selectedHour) + ":00" });
          };
          column.appendChild(slot);
        })(slotHour);
      }

      (eventsByDay[key] || []).forEach(function (event) {
        var startMinutes = hmToMinutes(event.time);
        if (startMinutes === null) return;
        var endMinutes = hmToMinutes(eventEnd(event));
        if (endMinutes === null || endMinutes <= startMinutes) endMinutes = startMinutes + 60;
        var visibleStart = Math.max(startMinutes, startHour * 60);
        var visibleEnd = Math.min(endMinutes, endHour * 60);
        if (visibleEnd <= visibleStart) return;
        var eventButton = document.createElement("button");
        eventButton.type = "button";
        eventButton.className = "week-calendar__event week-calendar__event--" + event.type
          + (event.done ? " is-done" : "");
        eventButton.style.top = (((visibleStart - startHour * 60) / 60) * hourHeight + 2) + "px";
        eventButton.style.height = Math.max(22, ((visibleEnd - visibleStart) / 60) * hourHeight - 4) + "px";
        eventButton.setAttribute("aria-label", event.title + ", " + event.time + " – " + eventEnd(event));
        var eventTime = document.createElement("span");
        eventTime.textContent = event.time;
        var eventTitle = document.createElement("strong");
        eventTitle.textContent = event.title;
        eventButton.appendChild(eventTime);
        eventButton.appendChild(eventTitle);
        eventButton.onclick = function (ev) {
          ev.stopPropagation();
          Router.go("calendar", { day: key, editType: event.type, editId: event.id });
        };
        column.appendChild(eventButton);
      });

      if (key === today) {
        var nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
        if (nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60) {
          var nowLine = document.createElement("span");
          nowLine.className = "week-calendar__now";
          nowLine.style.top = (((nowMinutes - startHour * 60) / 60) * hourHeight) + "px";
          column.appendChild(nowLine);
        }
      }
      body.appendChild(column);
    });

    canvas.appendChild(body);
    scroll.appendChild(canvas);
    card.appendChild(scroll);
    setTimeout(function () {
      var focusHour = Math.max(startHour, Math.min(endHour - 3, nowDate.getHours()));
      scroll.scrollTop = Math.max(0, 54 + (focusHour - startHour) * hourHeight);
      var todayIndex = bounds.days.findIndex(function (date) { return dayKey(date) === today; });
      if (todayIndex > 3) scroll.scrollLeft = Math.max(0, (todayIndex - 2) * 96);
    }, 0);
    return card;
  }

  function segmented(initialKey, items, onChange) {
    var host = document.createElement("div");
    host.className = "segment";

    var activeKey = initialKey;

    function setActive(k) {
      activeKey = k;
      var btns = host.querySelectorAll(".segbtn");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        b.classList.toggle("is-active", b.getAttribute("data-key") === activeKey);
      }
      if (typeof onChange === "function") onChange(activeKey);
    }

    for (var i = 0; i < items.length; i++) {
      (function (it) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "segbtn";
        b.textContent = it.label;
        b.setAttribute("data-key", it.key);
        b.onclick = function () { setActive(it.key); };
        host.appendChild(b);
      })(items[i]);
    }

    setTimeout(function () { setActive(activeKey); }, 0);

    return { el: host, set: setActive };
  }

  // ---------- Screens ----------
  var Screens = (function () {

    async function dashboard(container) {
      var nowD = new Date();
      State.s.today = dayKey(nowD);
      State.s.month = monthKey(nowD);
      await State.loadMaintenance();
      var perf = State.s.perf;

      var today = State.s.today;
      var month = State.s.month;

      // Path — next time block
      var dayBlocks = await DB.listBlocksByDay(today);
      var nowHM = pad2(nowD.getHours()) + ":" + pad2(nowD.getMinutes());
      var nextBlock = null;
      for (var bi = 0; bi < dayBlocks.length; bi++) {
        if ((dayBlocks[bi].start || "") >= nowHM) { nextBlock = dayBlocks[bi]; break; }
      }
      var nextText = nextBlock
        ? (nextBlock.start + " · " + nextBlock.title)
        : (dayBlocks.length ? "All blocks done" : "No blocks planned");
      var upcomingEvents = await upcomingCalendarEvents(nowD, 14, 5);
      var currentWeekBounds = weekBounds(nowD);
      var currentWeekEvents = await listCalendarEvents(currentWeekBounds.start, currentWeekBounds.end);
      var nextEvent = upcomingEvents.length ? upcomingEvents[0] : null;

      // Finance
      var budget = await DB.getBudget(month);
      var spent = (await DB.sumTransactionsForMonth(month)) + (await DB.sumRecurring());
      var remaining = budget - spent;
      var spentPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      var budgetText = budget > 0 ? (formatMoney(remaining) + " left") : "No budget set";

      // Gatekeeper
      var gates = await DB.listGates();
      var nowMs = Date.now();
      var lockedCount = 0, readyCount = 0;
      for (var gi = 0; gi < gates.length; gi++) {
        if (nowMs >= gates[gi].unlockAt) readyCount++;
        else lockedCount++;
      }

      // Alignment (journaling today)
      var mJournal = await DB.getJournal(today, "morning");
      var eJournal = await DB.getJournal(today, "evening");
      var alignText = (mJournal ? "Morning done" : "Morning open")
        + " · " + (eJournal ? "Evening done" : "Evening open");

      // Vault
      var vaultList = await DB.listVault();
      var vaultText = vaultList.length
        ? (vaultList.length + " archived day" + (vaultList.length === 1 ? "" : "s"))
        : "Nothing archived yet";

      var remainingItems = perf.total ? (perf.total - perf.done) : 0;

      var root = document.createElement("div");
      root.className = "dash";

      // ---- Calendar overview ----
      root.appendChild(dashboardWeekCalendarCard(nowD, currentWeekEvents));

      container.appendChild(root);
    }

    async function alignment(container, params) {
      var mode = (params && params.get("mode")) ? params.get("mode") : "morning";
      if (mode !== "morning" && mode !== "evening" && mode !== "choose") mode = "morning";

      var root = sectionTitle(tr("Journal"), "A calm six-minute ritual for morning and evening.");

      var seg = segmented(
        mode === "choose" ? "morning" : mode,
        [
          { key: "morning", label: "Morning" },
          { key: "evening", label: "Evening" }
        ],
        function (k) { Router.go("alignment", { mode: k }); }
      );

      root.appendChild(seg.el);

      var content = document.createElement("div");
      content.className = "stack";
      root.appendChild(content);

      if (mode === "choose") renderChoose(content);
      else if (mode === "morning") await renderMorning(content);
      else if (mode === "evening") await renderEvening(content);

      var archiveLink = document.createElement("button");
      archiveLink.className = "btnGhost structures-link";
      archiveLink.type = "button";
      archiveLink.textContent = tr("Journal Archive") + " →";
      archiveLink.onclick = function () { Router.go("vault"); };
      root.appendChild(archiveLink);

      container.appendChild(root);
    }

    async function vault(container, params) {
      var root = sectionTitle("Vault", "Your immutable archive of closed days.");
      await renderVault(root, params);
      container.appendChild(root);
    }

    function renderChoose(container) {
      var card = document.createElement("div");
      card.className = "glass card";
      var p = document.createElement("div");
      p.className = "p";
      p.textContent = tr("Choose your journaling flow for today.");
      card.appendChild(p);
      card.appendChild(spacer(12));

      var b1 = document.createElement("button");
      b1.className = "btnGhost";
      b1.type = "button";
      b1.textContent = tr("Start Morning Flow");
      b1.onclick = function () { Router.go("alignment", { mode: "morning" }); };

      var b2 = document.createElement("button");
      b2.className = "btnGhost";
      b2.type = "button";
      b2.textContent = tr("Start Evening Flow");
      b2.style.marginLeft = "10px";
      b2.onclick = function () { Router.go("alignment", { mode: "evening" }); };

      card.appendChild(b1);
      card.appendChild(b2);
      container.appendChild(card);
    }

    async function renderMorning(container) {
      var card = document.createElement("div");
      card.className = "glass card";
      card.appendChild(textLine("Morning Flow", "Today"));
      card.appendChild(spacer(10));

      await State.loadTodayJournal();
      var m = State.s.morning;

      var focus = labeledTextarea("Primary Focus", m.focus, "What matters most today?");
      var gratitude = labeledTextarea("Gratitude", m.gratitude, "Write 3 things you’re grateful for.");
      var intention = labeledTextarea("Intention", m.intention, "Who do you choose to be today?");

      card.appendChild(gratitude.wrap);
      card.appendChild(focus.wrap);
      card.appendChild(intention.wrap);
      card.appendChild(spacer(12));

      var save = document.createElement("button");
      save.className = "btnPrimary";
      save.type = "button";
      save.textContent = tr("Save Morning");
      save.onclick = async function () {
        try {
          await State.saveMorning({
            focus: focus.textarea.value.trim(),
            gratitude: gratitude.textarea.value.trim(),
            intention: intention.textarea.value.trim()
          });
          toast("Morning saved.");
        } catch (e) {
          toast("Save failed.");
        }
      };

      card.appendChild(save);
      container.appendChild(card);
    }

    async function renderEvening(container) {
      var card = document.createElement("div");
      card.className = "glass card";
      card.appendChild(textLine("Evening Flow", "Today"));
      card.appendChild(spacer(10));

      await State.loadTodayJournal();
      var e = State.s.evening;

      var wins = labeledTextarea("Wins", e.wins, "What went well today?");
      var lessons = labeledTextarea("Lessons", e.lessons, "What did you learn today?");

      var q1 = labeledTextarea("One thing for tomorrow", e.master1,
        "What is the one thing that will make tomorrow better?");
      var q2 = labeledTextarea("Master Question 2", e.master2,
        "Did I invest my time and attention into assets (skills, health, relationships), or did I drift into liabilities (distraction, impulse, comfort)?");
      var q3 = labeledTextarea("Master Question 3", e.master3,
        "What did I do today that increases my freedom and future options — and what must I stop doing?");
      var q4 = labeledTextarea("Master Question 4", e.master4,
        "If today repeated for 100 days, would my life improve or decay — and what is the one change I commit to tomorrow?");

      card.appendChild(wins.wrap);
      card.appendChild(lessons.wrap);
      card.appendChild(q1.wrap);

      var advanced = document.createElement("details");
      advanced.className = "journal-advanced";
      var advancedTitle = document.createElement("summary");
      advancedTitle.textContent = tr("Advanced reflection");
      advanced.appendChild(advancedTitle);
      advanced.appendChild(q2.wrap);
      advanced.appendChild(q3.wrap);
      advanced.appendChild(q4.wrap);
      card.appendChild(advanced);

      card.appendChild(spacer(12));

      var row = document.createElement("div");
      row.className = "row";

      var save = document.createElement("button");
      save.className = "btnPrimary";
      save.type = "button";
      save.textContent = tr("Save Evening");
      save.onclick = async function () {
        try {
          await State.saveEvening({
            wins: wins.textarea.value.trim(),
            lessons: lessons.textarea.value.trim(),
            master1: q1.textarea.value.trim(),
            master2: q2.textarea.value.trim(),
            master3: q3.textarea.value.trim(),
            master4: q4.textarea.value.trim()
          });
          toast("Evening saved.");
        } catch (e) { toast("Save failed."); }
      };

      var close = document.createElement("button");
      close.className = "btnGhost";
      close.type = "button";
      close.textContent = tr("Close Day to Vault");
      close.onclick = async function () {
        try {
          await State.saveEvening({
            wins: wins.textarea.value.trim(),
            lessons: lessons.textarea.value.trim(),
            master1: q1.textarea.value.trim(),
            master2: q2.textarea.value.trim(),
            master3: q3.textarea.value.trim(),
            master4: q4.textarea.value.trim()
          });

          var res = await State.closeDayToVault();
          if (!res.ok && res.reason === "already_closed") {
            toast("Vault is immutable. Today is already closed.");
            return;
          }
          toast("Day closed to Vault.");
          Router.go("vault");
        } catch (e) { toast("Close failed."); }
      };

      row.appendChild(save);
      row.appendChild(close);

      container.appendChild(card);
      container.appendChild(row);
    }

    async function renderVault(container, params) {
      var selectedDay = params ? params.get("day") : null;

      var card = document.createElement("div");
      card.className = "glass card";
      card.appendChild(textLine("Closed Days", "Read-only"));
      card.appendChild(spacer(10));

      await State.loadVaultList();
      var list = State.s.vaultList || [];

      if (selectedDay) {
        var detail = await State.loadVaultDetail(selectedDay);
        if (!detail) {
          var p = document.createElement("div");
          p.className = "p";
          p.textContent = tr("Snapshot not found.");
          card.appendChild(p);
        } else {
          var meta = document.createElement("div");
          meta.className = "p";
          meta.textContent = "Snapshot: " + detail.dayKey;
          card.appendChild(meta);
          card.appendChild(spacer(10));

          var snap = detail.snapshot || {};
          var jm = (snap.journal && snap.journal.morning) ? snap.journal.morning : null;
          var je = (snap.journal && snap.journal.evening) ? snap.journal.evening : null;
          var mt = snap.maintenance || null;

          card.appendChild(renderReadOnlyBlock("Morning", jm));
          card.appendChild(spacer(10));
          card.appendChild(renderReadOnlyBlock("Evening", je));
          card.appendChild(spacer(10));
          card.appendChild(renderMaintenanceSummary(mt));

          card.appendChild(spacer(12));
          var back = document.createElement("button");
          back.className = "btnGhost";
          back.type = "button";
          back.textContent = tr("Back to Vault List");
          back.onclick = function () { Router.go("vault"); };
          card.appendChild(back);
        }

        container.appendChild(card);
        return;
      }

      if (!list.length) {
        var p0 = document.createElement("div");
        p0.className = "p";
        p0.textContent = tr("No archived days yet. Use Evening Flow → Close Day to Vault.");
        card.appendChild(p0);
        container.appendChild(card);
        return;
      }

      var listEl = document.createElement("div");
      listEl.className = "list";

      for (var i = 0; i < list.length; i++) {
        (function (row) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");

          var k = document.createElement("div");
          k.className = "k";
          k.textContent = row.dayKey;

          var m = document.createElement("div");
          m.className = "m";
          try { m.textContent = new Date(row.closedAt).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" }); }
          catch (e) { m.textContent = tr("Closed"); }

          left.appendChild(k);
          left.appendChild(m);

          var che = document.createElement("div");
          che.style.opacity = ".55";
          che.style.fontWeight = "900";
          che.textContent = tr("›");

          it.appendChild(left);
          it.appendChild(che);

          it.onclick = function () { Router.go("vault", { day: row.dayKey }); };

          listEl.appendChild(it);
        })(list[i]);
      }

      card.appendChild(listEl);
      container.appendChild(card);
    }

    function renderMaintenanceSummary(mt) {
      var box = document.createElement("div");
      box.className = "glass card";
      box.style.boxShadow = "none";
      box.style.borderRadius = "18px";

      var t = document.createElement("div");
      t.style.fontWeight = "860";
      t.style.marginBottom = "8px";
      t.textContent = tr("Maintenance");
      box.appendChild(t);

      if (!mt) {
        var p = document.createElement("div");
        p.className = "p";
        p.textContent = tr("No maintenance snapshot.");
        box.appendChild(p);
        return box;
      }

      var pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = "Performance: " + mt.score + "% (" + mt.done + "/" + mt.total + ")";
      box.appendChild(pill);

      return box;
    }

    function renderReadOnlyBlock(title, obj) {
      var box = document.createElement("div");
      box.className = "glass card";
      box.style.boxShadow = "none";
      box.style.borderRadius = "18px";

      var t = document.createElement("div");
      t.style.fontWeight = "860";
      t.style.marginBottom = "8px";
      t.textContent = title;
      box.appendChild(t);

      if (!obj) {
        var p = document.createElement("div");
        p.className = "p";
        p.textContent = tr("No entry.");
        box.appendChild(p);
        return box;
      }

      var pre = document.createElement("div");
      pre.className = "p";
      pre.style.whiteSpace = "pre-wrap";
      pre.textContent = formatObj(obj);
      box.appendChild(pre);
      return box;
    }

    function formatObj(obj) {
      var lines = [];
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = obj[k];
        if (v === null || typeof v === "undefined") continue;
        if (String(v).trim() === "") continue;
        lines.push(k + ": " + v);
      }
      return lines.length ? lines.join("\n\n") : "No content.";
    }

    async function maintenance(container) {
      await State.loadMaintenance();
      var root = sectionTitle(tr("Routines"), "Habits, routines and daily tasks — all in one simple list.");

      // Score card
      var perf = State.s.perf;
      var scoreCard = document.createElement("div");
      scoreCard.className = "glass card";
      scoreCard.appendChild(textLine("Performance", "Today"));
      scoreCard.appendChild(spacer(10));
      var pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = perf.total ? (perf.score + "% (" + perf.done + "/" + perf.total + ")") : "No active items yet";
      scoreCard.appendChild(pill);
      root.appendChild(scoreCard);

      // Add forms
      var addCard = document.createElement("div");
      addCard.className = "glass card quick-add-card";
      addCard.appendChild(textLine("Add Items", "Create a routine or task"));

      var habitName = labeledInput("New Habit", "", "e.g., Mobility (10 min)");
      var addHabitBtn = document.createElement("button");
      addHabitBtn.className = "btnGhost";
      addHabitBtn.type = "button";
      addHabitBtn.textContent = tr("Add Habit");
      addHabitBtn.onclick = async function () {
        try {
          await State.addHabit(habitName.input.value);
          habitName.input.value = "";
          toast("Habit added.");
          Router.render();
        } catch (e) { toast("Habit name required."); }
      };

      addCard.appendChild(habitName.wrap);
      addCard.appendChild(addHabitBtn);
      addCard.appendChild(document.createElement("hr")).className = "hr";

      var taskName = labeledInput("New Daily Task", "", "e.g., Admin (15 min)");
      var taskCat = labeledInput("Category", "General", "e.g., Mobility / Admin / Home");
      var addTaskBtn = document.createElement("button");
      addTaskBtn.className = "btnGhost";
      addTaskBtn.type = "button";
      addTaskBtn.textContent = tr("Add Task");
      addTaskBtn.onclick = async function () {
        try {
          await State.addTask(taskName.input.value, taskCat.input.value);
          taskName.input.value = "";
          toast("Task added.");
          Router.render();
        } catch (e) { toast("Task name required."); }
      };

      addCard.appendChild(taskName.wrap);
      addCard.appendChild(taskCat.wrap);
      addCard.appendChild(addTaskBtn);

      // Active list
      var listCard = document.createElement("div");
      listCard.className = "glass card";
      listCard.appendChild(textLine("Today Checklist", "Tap to toggle"));

      var listWrap = document.createElement("div");
      listWrap.className = "stack";
      listWrap.appendChild(spacer(6));

      var habits = State.s.habits.filter(function (h) { return !!h.active; });
      var tasks = State.s.tasks.filter(function (t) { return !!t.active; });

      if (!habits.length && !tasks.length) {
        var p0 = document.createElement("div");
        p0.className = "p";
        p0.textContent = tr("Add at least one Habit or Task to start tracking Performance.");
        listCard.appendChild(p0);
      } else {
        for (var i = 0; i < habits.length; i++) {
          listWrap.appendChild(makeCheckRow("habit", habits[i].id, habits[i].name, "Habit"));
        }
        for (var j = 0; j < tasks.length; j++) {
          listWrap.appendChild(makeCheckRow("task", tasks[j].id, tasks[j].name, (tasks[j].category || "Task")));
        }
        listCard.appendChild(listWrap);
      }

      root.appendChild(listCard);
      root.appendChild(addCard);

      // Manage actives
      var manage = document.createElement("div");
      manage.className = "glass card";
      manage.appendChild(textLine("Manage Items", "Deactivate without deleting"));
      manage.appendChild(spacer(6));

      var manageList = document.createElement("div");
      manageList.className = "stack";

      var allHabits = State.s.habits;
      var allTasks = State.s.tasks;

      if (!allHabits.length && !allTasks.length) {
        var p1 = document.createElement("div");
        p1.className = "p";
        p1.textContent = tr("Nothing to manage yet.");
        manage.appendChild(p1);
      } else {
        for (var a = 0; a < allHabits.length; a++) {
          manageList.appendChild(makeActiveRow("habit", allHabits[a].id, allHabits[a].name, !!allHabits[a].active));
        }
        for (var b = 0; b < allTasks.length; b++) {
          manageList.appendChild(makeActiveRow("task", allTasks[b].id, allTasks[b].name + " (" + (allTasks[b].category || "General") + ")", !!allTasks[b].active));
        }
        manage.appendChild(manageList);
      }

      root.appendChild(manage);

      container.appendChild(root);

      function makeCheckRow(kind, id, name, meta) {
        var on = State.isTargetChecked(kind, id);

        var row = document.createElement("div");
        row.className = "checkrow";

        var left = document.createElement("div");
        left.className = "checkrow__left";

        var n = document.createElement("div");
        n.className = "checkrow__name";
        n.textContent = name;

        var m = document.createElement("div");
        m.className = "checkrow__meta";
        m.textContent = meta;

        left.appendChild(n);
        left.appendChild(m);

        var btn = document.createElement("button");
        btn.className = "checkrow__btn" + (on ? " is-on" : "");
        btn.type = "button";
        btn.textContent = on ? "✓" : "○";
        btn.setAttribute("aria-pressed", on ? "true" : "false");

        btn.onclick = async function () {
          try {
            var next = !State.isTargetChecked(kind, id);
            await State.toggleCheck(kind, id, next);
            toast(next ? "Checked." : "Unchecked.");
            Router.render();
          } catch (e) {
            toast("Update failed.");
          }
        };

        row.appendChild(left);
        row.appendChild(btn);
        return row;
      }

      function makeActiveRow(kind, id, label, active) {
        var row = document.createElement("div");
        row.className = "checkrow";

        var left = document.createElement("div");
        left.className = "checkrow__left";

        var n = document.createElement("div");
        n.className = "checkrow__name";
        n.textContent = label;

        var m = document.createElement("div");
        m.className = "checkrow__meta";
        m.textContent = active ? "Active" : "Inactive";

        left.appendChild(n);
        left.appendChild(m);

        var btn = document.createElement("button");
        btn.className = "checkrow__btn" + (active ? " is-on" : "");
        btn.type = "button";
        btn.textContent = active ? "On" : "Off";
        btn.onclick = async function () {
          try {
            if (kind === "habit") await State.setHabitActive(id, !active);
            else await State.setTaskActive(id, !active);
            toast("Updated.");
            Router.render();
          } catch (e) { toast("Update failed."); }
        };

        row.appendChild(left);
        row.appendChild(btn);
        return row;
      }
    }

    async function calendar(container, params) {
      var today = dayKey(new Date());
      State.s.today = today;
      State.s.month = monthKey(new Date());
      var requestedDay = params && params.get("day");
      var requestedTime = params && params.get("time");
      var requestedEditType = params && params.get("editType");
      var requestedEditId = params && params.get("editId");
      var selectedDate = parseDayKey(requestedDay) || parseDayKey(today) || new Date();
      var selectedDay = dayKey(selectedDate);
      var bounds = monthBounds(selectedDate);
      var monthEvents = await listCalendarEvents(bounds.start, bounds.end);
      var eventsByDay = {};

      monthEvents.forEach(function (event) {
        if (!eventsByDay[event.dayKey]) eventsByDay[event.dayKey] = [];
        eventsByDay[event.dayKey].push(event);
      });

      var root = sectionTitle("Calendar", "See blocks and reminders by day.");

      var monthCard = document.createElement("div");
      monthCard.className = "glass card calendar";

      var nav = document.createElement("div");
      nav.className = "calendar__nav";

      function shiftedDay(monthOffset) {
        var targetMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + monthOffset, 1, 12, 0, 0, 0);
        var maxDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
        return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(selectedDate.getDate(), maxDay), 12, 0, 0, 0);
      }

      function monthButton(label, offset) {
        var button = document.createElement("button");
        button.className = "hbtn calendar__navbtn";
        button.type = "button";
        button.setAttribute("aria-label", label);
        var icon = svgIcon(offset < 0 ? "back" : "chevron");
        button.appendChild(icon);
        button.onclick = function () { Router.go("calendar", { day: dayKey(shiftedDay(offset)) }); };
        return button;
      }

      nav.appendChild(monthButton("Previous month", -1));
      var monthTitle = document.createElement("div");
      monthTitle.className = "calendar__title";
      monthTitle.textContent = formatMonthTitle(selectedDate);
      nav.appendChild(monthTitle);
      nav.appendChild(monthButton("Next month", 1));
      monthCard.appendChild(nav);

      var todayButton = document.createElement("button");
      todayButton.className = "calendar__today";
      todayButton.type = "button";
      todayButton.textContent = tr("Go to today");
      todayButton.onclick = function () { Router.go("calendar", { day: today }); };
      monthCard.appendChild(todayButton);

      var weekdays = document.createElement("div");
      weekdays.className = "calendar__weekdays";
      var mondayFirst = effectiveLang() === "de";
      var weekdayBase = new Date(2023, 0, mondayFirst ? 2 : 1, 12, 0, 0, 0);
      for (var wi = 0; wi < 7; wi++) {
        var weekday = document.createElement("div");
        weekday.textContent = new Intl.DateTimeFormat(localeTag(), { weekday: "narrow" })
          .format(addDays(weekdayBase, wi));
        weekdays.appendChild(weekday);
      }
      monthCard.appendChild(weekdays);

      var grid = document.createElement("div");
      grid.className = "calendar__grid";
      var firstWeekday = bounds.first.getDay();
      var blankCount = mondayFirst ? ((firstWeekday + 6) % 7) : firstWeekday;
      for (var blank = 0; blank < blankCount; blank++) {
        var spacerCell = document.createElement("span");
        spacerCell.className = "calendar__blank";
        grid.appendChild(spacerCell);
      }

      for (var dayNumber = 1; dayNumber <= bounds.last.getDate(); dayNumber++) {
        (function (number) {
          var date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), number, 12, 0, 0, 0);
          var key = dayKey(date);
          var dayEvents = eventsByDay[key] || [];
          var dayButton = document.createElement("button");
          dayButton.type = "button";
          dayButton.className = "calendar__day"
            + (key === today ? " calendar__day--today" : "")
            + (key === selectedDay ? " calendar__day--selected" : "");
          dayButton.setAttribute("aria-label", formatNiceDate(date) + (dayEvents.length ? (", " + dayEvents.length + " events") : ""));
          var numberEl = document.createElement("span");
          numberEl.textContent = String(number);
          dayButton.appendChild(numberEl);
          if (dayEvents.length) {
            var dots = document.createElement("span");
            dots.className = "calendar__dots";
            var hasBlock = dayEvents.some(function (event) { return event.type === "block"; });
            var hasReminder = dayEvents.some(function (event) { return event.type === "reminder" && !event.done; });
            if (hasBlock) {
              var blockDot = document.createElement("span");
              blockDot.className = "calendar__dot calendar__dot--block";
              dots.appendChild(blockDot);
            }
            if (hasReminder) {
              var reminderDot = document.createElement("span");
              reminderDot.className = "calendar__dot calendar__dot--reminder";
              dots.appendChild(reminderDot);
            }
            dayButton.appendChild(dots);
          }
          dayButton.onclick = function () { Router.go("calendar", { day: key }); };
          grid.appendChild(dayButton);
        })(dayNumber);
      }
      monthCard.appendChild(grid);
      root.appendChild(monthCard);

      var selectedEvents = eventsByDay[selectedDay] || [];
      var editingEvent = null;
      if (requestedEditId && requestedEditType) {
        editingEvent = selectedEvents.find(function (event) {
          return event.id === requestedEditId && event.type === requestedEditType;
        }) || null;
      }
      var agendaCard = document.createElement("div");
      agendaCard.className = "glass card";
      agendaCard.appendChild(textLine("Agenda", formatNiceDate(selectedDate)));
      agendaCard.appendChild(spacer(10));

      if (!selectedEvents.length) {
        var empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = tr("Nothing scheduled for this day.");
        agendaCard.appendChild(empty);
      } else {
        var agendaList = document.createElement("div");
        agendaList.className = "calendar-agenda";
        selectedEvents.forEach(function (event) {
          var item = document.createElement("div");
          item.className = "calendar-event"
            + (event.done ? " calendar-event--done" : "");

          if (event.type === "reminder") {
            var toggle = document.createElement("button");
            toggle.className = "checkrow__btn" + (event.done ? " is-on" : "");
            toggle.type = "button";
            toggle.textContent = event.done ? "✓" : "○";
            toggle.setAttribute("aria-label", event.done ? "Mark reminder open" : "Mark reminder done");
            toggle.setAttribute("aria-pressed", event.done ? "true" : "false");
            toggle.onclick = async function () {
              await DB.setReminderDone(event.id, !event.done);
              toast("Reminder updated.");
              Router.render();
            };
            item.appendChild(toggle);
          }

          var eventBody = document.createElement("div");
          eventBody.className = "calendar-event__body";
          var eventTitle = document.createElement("div");
          eventTitle.className = "calendar-event__title";
          eventTitle.textContent = event.title;
          var eventMeta = document.createElement("div");
          eventMeta.className = "calendar-event__meta";
          eventMeta.textContent = (event.time || tr("All day"))
            + (event.time ? (" – " + eventEnd(event)) : "")
            + (event.note ? (" · " + event.note) : "");
          eventBody.appendChild(eventTitle);
          eventBody.appendChild(eventMeta);
          item.appendChild(eventBody);

          var badge = document.createElement("span");
          badge.className = "calendar-event__badge calendar-event__badge--" + event.type;
          badge.textContent = tr(event.type === "block" ? "Block" : "Reminder");
          item.appendChild(badge);

          var edit = document.createElement("button");
          edit.className = "calendar-event__edit";
          edit.type = "button";
          edit.textContent = tr("Edit");
          edit.onclick = function () {
            Router.go("calendar", { day: selectedDay, editType: event.type, editId: event.id });
          };
          item.appendChild(edit);

          var remove = document.createElement("button");
          remove.className = "calendar-event__remove";
          remove.type = "button";
          remove.setAttribute("aria-label", tr("Remove") + " " + event.title);
          remove.textContent = "×";
          remove.onclick = async function () {
            if (event.type === "block") await DB.deleteBlock(event.id);
            else await DB.deleteReminder(event.id);
            toast(event.type === "block" ? "Block removed." : "Reminder removed.");
            Router.render();
          };
          item.appendChild(remove);
          agendaList.appendChild(item);
        });
        agendaCard.appendChild(agendaList);
      }
      root.appendChild(agendaCard);

      var addCard = document.createElement("div");
      addCard.className = "glass card";
      addCard.appendChild(textLine(editingEvent ? tr("Edit Entry") : tr("Add an entry"), formatNiceDate(selectedDate)));
      var defaultStart = requestedTime && hmToMinutes(requestedTime) !== null
        ? requestedTime
        : (selectedDay === today ? pad2(Math.min(22, new Date().getHours() + 1)) + ":00" : "09:00");
      var initialStart = editingEvent ? (editingEvent.time || defaultStart) : defaultStart;
      var initialEnd = editingEvent ? eventEnd(editingEvent) : addMinutesToHM(defaultStart, 60);
      var titleInput = makeInput("text", editingEvent ? editingEvent.title : "", tr("e.g., Call the dentist"));
      var dateInput = makeInput("date", editingEvent ? editingEvent.dayKey : selectedDay);
      var timeInput = makeInput("time", initialStart);
      var endInput = makeInput("time", initialEnd);
      var noteInput = labeledTextarea("Note", editingEvent ? editingEvent.note : "", "Optional details");
      var entryType = editingEvent ? editingEvent.type : "reminder";
      if (!editingEvent) {
        var entryTypeControl = segmented("reminder", [
          { key: "reminder", label: tr("Reminder") },
          { key: "block", label: tr("Time Block") }
        ], function (type) {
          entryType = type;
          noteInput.wrap.style.display = type === "reminder" ? "" : "none";
        });
        addCard.appendChild(entryTypeControl.el);
      }
      var endWasEdited = !!editingEvent;
      timeInput.onchange = function () {
        if (!endWasEdited || hmToMinutes(endInput.value) <= hmToMinutes(timeInput.value)) {
          endInput.value = addMinutesToHM(timeInput.value, 60);
          endWasEdited = false;
        }
      };
      endInput.onchange = function () { endWasEdited = true; };
      addCard.appendChild(fieldWrap("Title", titleInput));
      addCard.appendChild(fieldWrap("Date", dateInput));
      var entryTimeRow = document.createElement("div");
      entryTimeRow.className = "row";
      entryTimeRow.appendChild(fieldWrap("Start", timeInput));
      entryTimeRow.appendChild(fieldWrap("End", endInput));
      addCard.appendChild(entryTimeRow);
      if (!editingEvent || editingEvent.type === "reminder") addCard.appendChild(noteInput.wrap);
      addCard.appendChild(spacer(12));
      var addReminderButton = document.createElement("button");
      addReminderButton.className = "btnPrimary";
      addReminderButton.type = "button";
      addReminderButton.textContent = editingEvent ? tr("Save Changes") : tr("Add an entry");
      addReminderButton.onclick = async function () {
        try {
          var startMinutes = hmToMinutes(timeInput.value);
          var endMinutes = hmToMinutes(endInput.value);
          if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
            throw new Error("End time must be after start time");
          }
          if (editingEvent && editingEvent.type === "block") {
            await DB.updateBlock(editingEvent.id, {
              dayKey: dateInput.value, start: timeInput.value,
              end: endInput.value, title: titleInput.value
            });
          } else if (editingEvent) {
            await DB.updateReminder(editingEvent.id, {
              dayKey: dateInput.value, time: timeInput.value, end: endInput.value,
              title: titleInput.value, note: noteInput.textarea.value
            });
          } else if (entryType === "block") {
            await DB.addBlock(dateInput.value, timeInput.value, endInput.value, titleInput.value);
          } else {
            await DB.addReminder(
              dateInput.value, timeInput.value, endInput.value,
              titleInput.value, noteInput.textarea.value
            );
          }
          toast(editingEvent ? "Entry updated." : "Reminder added.");
          Router.go("calendar", { day: dateInput.value });
        } catch (e) {
          toast(e && e.message === "Reminder title required" ? "Title required." : (e && e.message ? e.message : "Add failed."));
        }
      };
      addCard.appendChild(addReminderButton);
      if (editingEvent) {
        var cancelEdit = document.createElement("button");
        cancelEdit.className = "btnGhost calendar-entry__cancel";
        cancelEdit.type = "button";
        cancelEdit.textContent = tr("Cancel");
        cancelEdit.onclick = function () { Router.go("calendar", { day: selectedDay }); };
        addCard.appendChild(cancelEdit);
      }
      root.appendChild(addCard);
      var structuresLink = document.createElement("button");
      structuresLink.className = "btnGhost structures-link";
      structuresLink.type = "button";
      structuresLink.textContent = tr("Day Structures") + " →";
      structuresLink.onclick = function () { Router.go("path"); };
      root.appendChild(structuresLink);

      container.appendChild(root);
    }

    async function path(container) {
      var root = sectionTitle(tr("Day Structures"), "Build reusable routines from time blocks and apply them to any day.");
      var today = State.s.today;
      var blocks = await DB.listBlocksByDay(today);

      // Today's blocks
      var listCard = document.createElement("div");
      listCard.className = "glass card";
      listCard.appendChild(textLine("Today’s Blocks", blocks.length ? (blocks.length + " scheduled") : "Empty"));
      listCard.appendChild(spacer(10));

      if (!blocks.length) {
        var p0 = document.createElement("div");
        p0.className = "p";
        p0.textContent = tr("No time blocks yet. Add one below or load a template.");
        listCard.appendChild(p0);
      } else {
        var list = document.createElement("div");
        list.className = "list";
        blocks.forEach(function (b) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");
          var k = document.createElement("div");
          k.className = "k";
          k.textContent = b.title;
          var m = document.createElement("div");
          m.className = "m";
          m.textContent = (b.start || "—") + (b.end ? (" – " + b.end) : "");
          left.appendChild(k);
          left.appendChild(m);
          var del = document.createElement("button");
          del.className = "btnGhost";
          del.type = "button";
          del.textContent = tr("Remove");
          del.onclick = async function () {
            await DB.deleteBlock(b.id);
            toast("Block removed.");
            Router.render();
          };
          it.appendChild(left);
          it.appendChild(del);
          list.appendChild(it);
        });
        listCard.appendChild(list);
      }
      root.appendChild(listCard);

      // Add block
      var addCard = document.createElement("div");
      addCard.className = "glass card";
      addCard.appendChild(textLine("Add Block", "Time-boxed focus"));
      var titleI = makeInput("text", "", "e.g., Deep Work");
      var startI = makeInput("time", "09:00");
      var endI = makeInput("time", "10:00");
      var blockEndWasEdited = false;
      startI.onchange = function () {
        if (!blockEndWasEdited || hmToMinutes(endI.value) <= hmToMinutes(startI.value)) {
          endI.value = addMinutesToHM(startI.value, 60);
          blockEndWasEdited = false;
        }
      };
      endI.onchange = function () { blockEndWasEdited = true; };
      addCard.appendChild(fieldWrap("Title", titleI));
      var timeRow = document.createElement("div");
      timeRow.className = "row";
      timeRow.appendChild(fieldWrap("Start", startI));
      timeRow.appendChild(fieldWrap("End", endI));
      addCard.appendChild(timeRow);
      addCard.appendChild(spacer(12));
      var addBtn = document.createElement("button");
      addBtn.className = "btnPrimary";
      addBtn.type = "button";
      addBtn.textContent = tr("Add Block");
      addBtn.onclick = async function () {
        try {
          await DB.addBlock(today, startI.value, endI.value, titleI.value);
          toast("Block added.");
          Router.render();
        } catch (e) { toast(e && e.message ? e.message : "Add failed."); }
      };
      addCard.appendChild(addBtn);
      root.appendChild(addCard);

      // Reusable day structures
      var tplCard = document.createElement("div");
      tplCard.className = "glass card";
      tplCard.appendChild(textLine(tr("Day Structures"), tr("Reusable day plans")));
      tplCard.appendChild(spacer(10));
      var structureDate = makeInput("date", today);
      tplCard.appendChild(fieldWrap("Apply to date", structureDate));
      tplCard.appendChild(spacer(10));

      var templates = await DB.listTemplates();
      if (!templates.length) {
        var pt = document.createElement("div");
        pt.className = "p";
        pt.textContent = tr("No templates yet. Create the sample Workday, or save today’s blocks below.");
        tplCard.appendChild(pt);
        tplCard.appendChild(spacer(10));
        var seed = document.createElement("button");
        seed.className = "btnGhost";
        seed.type = "button";
        seed.textContent = tr("Create ‘Workday’ template");
        seed.onclick = async function () {
          await DB.addTemplate("Workday", [
            { start: "07:00", end: "08:00", title: "Morning Routine" },
            { start: "09:00", end: "12:00", title: "Deep Work" },
            { start: "12:00", end: "13:00", title: "Lunch" },
            { start: "13:00", end: "17:00", title: "Focused Tasks" },
            { start: "18:00", end: "19:00", title: "Training" }
          ]);
          toast("Workday template created.");
          Router.render();
        };
        tplCard.appendChild(seed);
      } else {
        var tlist = document.createElement("div");
        tlist.className = "list";
        templates.forEach(function (t) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");
          var k = document.createElement("div");
          k.className = "k";
          k.textContent = t.name;
          var m = document.createElement("div");
          m.className = "m";
          m.textContent = (t.blocks ? t.blocks.length : 0) + " blocks";
          left.appendChild(k);
          left.appendChild(m);
          var actions = document.createElement("div");
          var load = document.createElement("button");
          load.className = "btnGhost";
          load.type = "button";
          load.textContent = tr("Use");
          load.onclick = async function () {
            var targetDay = parseDayKey(structureDate.value) ? structureDate.value : today;
            await DB.applyTemplateToDay(t.id, targetDay);
            toast("Day structure applied.");
            Router.go("calendar", { day: targetDay });
          };
          var del = document.createElement("button");
          del.className = "btnGhost";
          del.type = "button";
          del.textContent = tr("Delete");
          del.style.marginLeft = "8px";
          del.onclick = async function () {
            await DB.deleteTemplate(t.id);
            toast("Template deleted.");
            Router.render();
          };
          actions.appendChild(load);
          actions.appendChild(del);
          it.appendChild(left);
          it.appendChild(actions);
          tlist.appendChild(it);
        });
        tplCard.appendChild(tlist);
      }

      if (blocks.length) {
        tplCard.appendChild(spacer(12));
        var hrt = document.createElement("hr");
        hrt.className = "hr";
        tplCard.appendChild(hrt);
        var nameI = makeInput("text", "", "Template name (e.g., Workday)");
        tplCard.appendChild(fieldWrap("Save today as structure", nameI));
        tplCard.appendChild(spacer(10));
        var saveTpl = document.createElement("button");
        saveTpl.className = "btnGhost";
        saveTpl.type = "button";
        saveTpl.textContent = tr("Save Template");
        saveTpl.onclick = async function () {
          try {
            var tb = blocks.map(function (b) { return { start: b.start, end: b.end, title: b.title }; });
            await DB.addTemplate(nameI.value, tb);
            toast("Template saved.");
            Router.render();
          } catch (e) { toast(e && e.message ? e.message : "Save failed."); }
        };
        tplCard.appendChild(saveTpl);
      }
      root.appendChild(tplCard);

      container.appendChild(root);
    }

    async function finance(container) {
      var root = sectionTitle("Finance", "Monthly budget, recurring costs, spending breakdown, and the 72h Gatekeeper.");
      var month = State.s.month;
      var budget = await DB.getBudget(month);
      var txns = await DB.listTransactionsByMonth(month);
      var recurringItems = await DB.listRecurring();
      var oneOffSpent = await DB.sumTransactionsForMonth(month);
      var recurringSpent = await DB.sumRecurring();
      var spent = oneOffSpent + recurringSpent;
      var remaining = budget - spent;

      // Overview
      var overview = document.createElement("div");
      overview.className = "glass card card--strong finance-hero";
      overview.appendChild(textLine("Budget", month));
      overview.appendChild(spacer(10));
      var pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = budget > 0
        ? ("Remaining: " + formatMoney(remaining) + " / " + formatMoney(budget))
        : "No budget set";
      overview.appendChild(pill);
      overview.appendChild(spacer(10));
      var sub = document.createElement("div");
      sub.className = "p";
      sub.textContent = "Spent this month: " + formatMoney(spent)
        + " (recurring " + formatMoney(recurringSpent) + ")";
      overview.appendChild(sub);
      root.appendChild(overview);

      // Spending breakdown (pie chart)
      var slices = buildExpenseSlices(txns, recurringItems);
      var chartCard = document.createElement("div");
      chartCard.className = "glass card";
      chartCard.appendChild(textLine("Spending Breakdown", month));
      chartCard.appendChild(spacer(12));
      if (!slices.length) {
        var cp = document.createElement("div");
        cp.className = "p";
        cp.textContent = tr("Add an expense or a recurring cost to see your breakdown.");
        chartCard.appendChild(cp);
      } else {
        chartCard.appendChild(pieChart(slices));
      }

      // Set budget
      var budgetCard = document.createElement("div");
      budgetCard.className = "glass card";
      budgetCard.appendChild(textLine("Set Monthly Budget", "Applies to " + month));
      var budgetI = makeInput("number", budget > 0 ? String(budget) : "", "e.g., 1500", { min: "0", step: "1" });
      budgetCard.appendChild(fieldWrap("Amount", budgetI));
      budgetCard.appendChild(spacer(12));
      var saveB = document.createElement("button");
      saveB.className = "btnPrimary";
      saveB.type = "button";
      saveB.textContent = tr("Save Budget");
      saveB.onclick = async function () {
        await DB.setBudget(month, budgetI.value);
        toast("Budget saved.");
        Router.render();
      };
      budgetCard.appendChild(saveB);

      // Expenses
      var expCard = document.createElement("div");
      expCard.className = "glass card quick-add-card";
      expCard.appendChild(textLine("Add Expense", "Track your spending"));
      var amtI = makeInput("number", "", "0.00", { min: "0", step: "0.01", inputmode: "decimal" });
      var noteI = makeInput("text", "", "e.g., Groceries");
      expCard.appendChild(fieldWrap("Amount", amtI));
      expCard.appendChild(fieldWrap("Note", noteI));
      var categories = document.createElement("div");
      categories.className = "choice-chips";
      ["Food", "Transport", "Home", "Health", "Leisure"].forEach(function (category) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "choice-chip";
        chip.textContent = category;
        chip.onclick = function () {
          noteI.value = category;
          var chips = categories.querySelectorAll(".choice-chip");
          for (var ci = 0; ci < chips.length; ci++) chips[ci].classList.toggle("is-active", chips[ci] === chip);
        };
        categories.appendChild(chip);
      });
      expCard.appendChild(categories);
      expCard.appendChild(spacer(12));
      var addE = document.createElement("button");
      addE.className = "btnPrimary";
      addE.type = "button";
      addE.textContent = tr("Add Expense");
      addE.onclick = async function () {
        try {
          await DB.addTransaction(month, amtI.value, noteI.value);
          toast("Expense added.");
          Router.render();
        } catch (e) { toast(e && e.message ? e.message : "Add failed."); }
      };
      expCard.appendChild(addE);

      if (txns.length) {
        expCard.appendChild(spacer(12));
        var hrx = document.createElement("hr");
        hrx.className = "hr";
        expCard.appendChild(hrx);
        var tl = document.createElement("div");
        tl.className = "list";
        txns.forEach(function (t) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");
          var k = document.createElement("div");
          k.className = "k";
          k.textContent = formatMoney(t.amount);
          var m = document.createElement("div");
          m.className = "m";
          m.textContent = t.note || "—";
          left.appendChild(k);
          left.appendChild(m);
          var del = document.createElement("button");
          del.className = "btnGhost";
          del.type = "button";
          del.textContent = tr("Delete");
          del.onclick = async function () {
            await DB.deleteTransaction(t.id);
            toast("Expense removed.");
            Router.render();
          };
          it.appendChild(left);
          it.appendChild(del);
          tl.appendChild(it);
        });
        expCard.appendChild(tl);
      }
      root.appendChild(expCard);
      root.appendChild(chartCard);
      root.appendChild(budgetCard);

      // Recurring monthly expenses
      var recCard = document.createElement("div");
      recCard.className = "glass card";
      recCard.appendChild(textLine("Recurring Expenses", "Charged every month"));
      recCard.appendChild(spacer(8));
      var recInfo = document.createElement("div");
      recInfo.className = "p";
      recInfo.textContent = tr("Fixed monthly costs (rent, subscriptions…) count automatically toward every month’s budget.");
      recCard.appendChild(recInfo);
      recCard.appendChild(spacer(10));
      var recName = makeInput("text", "", "e.g., Rent");
      var recAmt = makeInput("number", "", "0.00", { min: "0", step: "0.01" });
      recCard.appendChild(fieldWrap("Name", recName));
      recCard.appendChild(fieldWrap("Amount / month", recAmt));
      recCard.appendChild(spacer(12));
      var addR = document.createElement("button");
      addR.className = "btnGhost";
      addR.type = "button";
      addR.textContent = tr("Add Recurring");
      addR.onclick = async function () {
        try {
          await DB.addRecurring(recName.value, recAmt.value);
          toast("Recurring expense added.");
          Router.render();
        } catch (e) { toast(e && e.message ? e.message : "Add failed."); }
      };
      recCard.appendChild(addR);

      if (recurringItems.length) {
        recCard.appendChild(spacer(12));
        var hrr = document.createElement("hr");
        hrr.className = "hr";
        recCard.appendChild(hrr);
        var rl = document.createElement("div");
        rl.className = "list";
        recurringItems.forEach(function (rc) {
          var it = document.createElement("div");
          it.className = "item";
          var left = document.createElement("div");
          var k = document.createElement("div");
          k.className = "k";
          k.textContent = formatMoney(rc.amount) + " / month";
          var m = document.createElement("div");
          m.className = "m";
          m.textContent = rc.name;
          left.appendChild(k);
          left.appendChild(m);
          var del = document.createElement("button");
          del.className = "btnGhost";
          del.type = "button";
          del.textContent = tr("Delete");
          del.onclick = async function () {
            await DB.deleteRecurring(rc.id);
            toast("Recurring expense removed.");
            Router.render();
          };
          it.appendChild(left);
          it.appendChild(del);
          rl.appendChild(it);
        });
        recCard.appendChild(rl);
      }
      root.appendChild(recCard);

      // Gatekeeper
      var gateCard = document.createElement("div");
      gateCard.className = "glass card";
      gateCard.appendChild(textLine("72h Gatekeeper", "Beat impulse purchases"));
      gateCard.appendChild(spacer(8));
      var gp = document.createElement("div");
      gp.className = "p";
      gp.textContent = tr("Add something you want to buy. It stays locked for 72 hours before you can approve it.");
      gateCard.appendChild(gp);
      gateCard.appendChild(spacer(10));
      var gItem = makeInput("text", "", "e.g., New headphones");
      var gAmt = makeInput("number", "", "0.00", { min: "0", step: "0.01" });
      gateCard.appendChild(fieldWrap("Item", gItem));
      gateCard.appendChild(fieldWrap("Amount", gAmt));
      gateCard.appendChild(spacer(12));
      var addG = document.createElement("button");
      addG.className = "btnGhost";
      addG.type = "button";
      addG.textContent = tr("Lock for 72h");
      addG.onclick = async function () {
        try {
          await DB.addGate(gItem.value, gAmt.value, 72);
          toast("Locked for 72 hours.");
          Router.render();
        } catch (e) { toast(e && e.message ? e.message : "Add failed."); }
      };
      gateCard.appendChild(addG);

      var gates = await DB.listGates();
      if (gates.length) {
        gateCard.appendChild(spacer(12));
        var hrg = document.createElement("hr");
        hrg.className = "hr";
        gateCard.appendChild(hrg);
        var gl = document.createElement("div");
        gl.className = "list";
        gates.forEach(function (g) {
          var it = document.createElement("div");
          it.className = "checkrow";
          var left = document.createElement("div");
          left.className = "checkrow__left";
          var n = document.createElement("div");
          n.className = "checkrow__name";
          n.textContent = g.item + " · " + formatMoney(g.amount);
          var meta = document.createElement("div");
          meta.className = "checkrow__meta";
          var right = document.createElement("div");
          var now = Date.now();

          if (now >= g.unlockAt) {
            meta.textContent = tr("Unlocked — decide now");
            var ok = document.createElement("button");
            ok.className = "btnGhost";
            ok.type = "button";
            ok.textContent = tr("Approve");
            ok.onclick = async function () {
              await DB.addTransaction(month, g.amount, "Gatekeeper: " + g.item);
              await DB.deleteGate(g.id);
              toast("Approved & logged as expense.");
              Router.render();
            };
            var no = document.createElement("button");
            no.className = "btnGhost";
            no.type = "button";
            no.textContent = tr("Let it go");
            no.style.marginLeft = "8px";
            no.onclick = async function () {
              await DB.deleteGate(g.id);
              toast("Released. Money saved.");
              Router.render();
            };
            right.appendChild(ok);
            right.appendChild(no);
          } else {
            var cd = document.createElement("span");
            cd.setAttribute("data-unlock", String(g.unlockAt));
            cd.textContent = formatCountdown(g.unlockAt - now);
            meta.appendChild(document.createTextNode("Unlocks in "));
            meta.appendChild(cd);
            var cancel = document.createElement("button");
            cancel.className = "btnGhost";
            cancel.type = "button";
            cancel.textContent = tr("Cancel");
            cancel.onclick = async function () {
              await DB.deleteGate(g.id);
              toast("Cancelled.");
              Router.render();
            };
            right.appendChild(cancel);
          }

          left.appendChild(n);
          left.appendChild(meta);
          it.appendChild(left);
          it.appendChild(right);
          gl.appendChild(it);
        });
        gateCard.appendChild(gl);

        // Live countdown ticker (cleared on navigation via Timers)
        Timers.add(setInterval(function () {
          var els = gateCard.querySelectorAll("[data-unlock]");
          var now2 = Date.now();
          var needsRefresh = false;
          for (var i = 0; i < els.length; i++) {
            var u = Number(els[i].getAttribute("data-unlock"));
            var diff = u - now2;
            if (diff <= 0) { needsRefresh = true; }
            else { els[i].textContent = formatCountdown(diff); }
          }
          if (needsRefresh) Router.render();
        }, 1000));
      }
      root.appendChild(gateCard);

      container.appendChild(root);
    }

    async function settings(container) {
      var root = sectionTitle("Settings", "Back up, restore, and reset your PERSONAL OS.");

      // Preferences (currency / language / measurement)
      var prefCard = document.createElement("div");
      prefCard.className = "glass card";
      prefCard.appendChild(textLine("Preferences", "Regional & display"));
      prefCard.appendChild(fieldWrap("Currency",
        makeSelect(CURRENCIES, Prefs.currency, async function (v) {
          await savePref("currency", v);
          toast("Preferences saved.");
          Router.render();
        })));
      prefCard.appendChild(fieldWrap("Language",
        makeSelect(LANGUAGES, Prefs.language, async function (v) {
          await savePref("language", v);
          toast("Preferences saved.");
          Router.render();
        })));
      prefCard.appendChild(fieldWrap("Measurement system",
        makeSelect(MEASURES, Prefs.measure, async function (v) {
          await savePref("measure", v);
          toast("Preferences saved.");
          Router.render();
        })));
      var measNote = document.createElement("div");
      measNote.className = "p";
      measNote.style.marginTop = "8px";
      measNote.textContent = tr("Applies to unit-based values as they are added.");
      prefCard.appendChild(measNote);
      root.appendChild(prefCard);

      // Export
      var expCard = document.createElement("div");
      expCard.className = "glass card";
      expCard.appendChild(textLine("Export Data", "Download a JSON backup"));
      expCard.appendChild(spacer(8));
      var ep = document.createElement("div");
      ep.className = "p";
      ep.textContent = tr("Save all your journals, habits, tasks, blocks, finances, and locks to a file.");
      expCard.appendChild(ep);
      expCard.appendChild(spacer(12));
      var expBtn = document.createElement("button");
      expBtn.className = "btnPrimary";
      expBtn.type = "button";
      expBtn.textContent = tr("Export Backup");
      expBtn.onclick = async function () {
        try {
          var data = await DB.exportAll();
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "personal-os-backup-" + State.s.today + ".json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          toast("Backup exported.");
        } catch (e) { toast("Export failed."); }
      };
      expCard.appendChild(expBtn);
      root.appendChild(expCard);

      // Import
      var impCard = document.createElement("div");
      impCard.className = "glass card";
      impCard.appendChild(textLine("Import Data", "Restore from a backup file"));
      impCard.appendChild(spacer(12));
      var fileI = document.createElement("input");
      fileI.type = "file";
      fileI.accept = "application/json,.json";
      fileI.className = "input";
      impCard.appendChild(fieldWrap("Backup file", fileI));
      impCard.appendChild(spacer(12));
      var impBtn = document.createElement("button");
      impBtn.className = "btnGhost";
      impBtn.type = "button";
      impBtn.textContent = tr("Import & Merge");
      impBtn.onclick = function () {
        var f = fileI.files && fileI.files[0];
        if (!f) { toast("Choose a file first."); return; }
        var reader = new FileReader();
        reader.onload = async function () {
          try {
            var data = JSON.parse(reader.result);
            var n = await DB.importAll(data);
            toast("Imported " + n + " records.");
            Router.render();
          } catch (e) { toast(e && e.message ? e.message : "Invalid backup file."); }
        };
        reader.onerror = function () { toast("Could not read file."); };
        reader.readAsText(f);
      };
      impCard.appendChild(impBtn);
      root.appendChild(impCard);

      // Danger zone: reset
      var resetCard = document.createElement("div");
      resetCard.className = "glass card";
      resetCard.appendChild(textLine("Danger Zone", "Erase all data"));
      resetCard.appendChild(spacer(8));
      var rp = document.createElement("div");
      rp.className = "p";
      rp.textContent = tr("This permanently deletes everything on this device. Export a backup first.");
      resetCard.appendChild(rp);
      resetCard.appendChild(spacer(12));
      var confI = makeInput("text", "", "Type RESET to confirm");
      resetCard.appendChild(fieldWrap("Confirmation", confI));
      resetCard.appendChild(spacer(12));
      var resetBtn = document.createElement("button");
      resetBtn.className = "btnGhost";
      resetBtn.type = "button";
      resetBtn.textContent = tr("Reset PERSONAL OS");
      resetBtn.onclick = async function () {
        if ((confI.value || "").trim().toUpperCase() !== "RESET") {
          toast("Type RESET to confirm.");
          return;
        }
        try {
          await DB.clearAllData();
          toast("All data cleared.");
          Router.go("dashboard");
        } catch (e) { toast("Reset failed."); }
      };
      resetCard.appendChild(resetBtn);
      root.appendChild(resetCard);

      // About
      var infoCard = document.createElement("div");
      infoCard.className = "glass card";
      infoCard.appendChild(textLine("About", "PERSONAL OS"));
      infoCard.appendChild(spacer(8));
      var v = document.createElement("div");
      v.className = "p";
      v.textContent = "Version " + APP_VERSION + " · The Architecture of Excellence.";
      infoCard.appendChild(v);
      root.appendChild(infoCard);

      container.appendChild(root);
    }

    function notFound(container, route) {
      var root = sectionTitle("Not Found", "Unknown route: " + route);
      container.appendChild(root);
    }

    function bootError(container, title, details) {
      container.innerHTML = "";
      var root = document.createElement("div");
      root.className = "stack";

      var card = document.createElement("div");
      card.className = "glass card card--strong";

      var h = document.createElement("div");
      h.className = "h1";
      h.textContent = title;

      var p = document.createElement("div");
      p.className = "p";
      p.textContent = details;

      card.appendChild(h);
      card.appendChild(p);

      var b = document.createElement("button");
      b.className = "btnGhost";
      b.type = "button";
      b.textContent = tr("Reload");
      b.onclick = function () { location.reload(); };

      root.appendChild(card);
      root.appendChild(b);

      container.appendChild(root);
    }

    return {
      dashboard: dashboard,
      calendar: calendar,
      path: path,
      alignment: alignment,
      maintenance: maintenance,
      finance: finance,
      vault: vault,
      settings: settings,
      notFound: notFound,
      bootError: bootError
    };
  })();

  // ---------- Service Worker ----------
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    if (hasNoSwFlag()) return;
    try { await navigator.serviceWorker.register("./sw.js?v=" + encodeURIComponent(APP_VERSION), { scope: "./" }); }
    catch (e) {}
  }

  // ---------- Boot ----------
  async function boot() {
    var killed = await runKillSwitchIfNeeded();
    if (killed) return;

    try { await DB.open(); }
    catch (e) { toast("Storage unavailable. Avoid Private Mode on iOS Safari."); }

    await loadPrefs();

    Router.onChange(Router.render);

    // Always open the Dashboard on start — never the last-opened page.
    if (getHashRoute().split("?")[0] !== "dashboard") {
      Router.go("dashboard");
    }
    await Router.render();

    registerSW();
  }

  boot().catch(function (e) {
    var view = $("view");
    if (view) Screens.bootError(view, "Boot Error", String(e && e.message ? e.message : e));
  });
})();
