import { db } from "./db.js";

const defaults = {
  profile: { name: "", currency: "EUR", weekStart: "monday", timeFormat: "24", calendarView: "month" },
  theme: "system",
  dashboard: { priorities: true, timeline: true, tasks: true, dayPlan: true, maintenance: true, path: true, finance: true },
  onboardingComplete: false
};

export const state = {
  settings: structuredClone(defaults),
  async load() {
    const row = await db.get("settings", "preferences");
    this.settings = {
      ...structuredClone(defaults), ...(row?.value || {}),
      profile: { ...defaults.profile, ...(row?.value?.profile || {}) },
      dashboard: { ...defaults.dashboard, ...(row?.value?.dashboard || {}) }
    };
    this.applyTheme();
  },
  async save(patch) {
    this.settings = { ...this.settings, ...patch };
    await db.put("settings", { id: "preferences", value: this.settings });
    this.applyTheme();
  },
  applyTheme() {
    document.documentElement.dataset.theme = this.settings.theme || "system";
    const dark = this.settings.theme === "dark" ||
      (this.settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#111513" : "#f5f4ef");
  }
};
