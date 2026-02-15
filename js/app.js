import { db } from "./db.js";
import { mountMindset } from "./screens/mindset.js";
import { mountPath } from "./screens/path.js";
import { mountMaintenance } from "./screens/maintenance.js";
import { mountFinance } from "./screens/finance.js";

const buttons = document.querySelectorAll(".nav-btn");
const screens = document.querySelectorAll(".screen");

let mounted = {
  mindset: false,
  path: false,
  maintenance: false,
  finance: false
};

function setActive(target) {
  buttons.forEach((b) => b.classList.remove("active"));
  screens.forEach((s) => s.classList.remove("active"));

  const btn = document.querySelector(`.nav-btn[data-target="${target}"]`);
  const screen = document.getElementById("screen-" + target);

  if (btn) btn.classList.add("active");
  if (screen) screen.classList.add("active");
}

async function mountIfNeeded(target) {
  if (mounted[target]) return;
  if (target === "mindset") await mountMindset();
  if (target === "path") await mountPath();
  if (target === "maintenance") await mountMaintenance();
  if (target === "finance") await mountFinance();
  mounted[target] = true;
}

buttons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = btn.dataset.target;
    setActive(target);
    await mountIfNeeded(target);
  });
});

async function boot() {
  // ensure DB init + settings exist
  const settings = await db.getSettings();

  // STARTSCREEN FIX: default to Today’s Path unless settings override
  const startTab = settings?.ui?.startTab || "path";

  setActive(startTab);
  await mountIfNeeded(startTab);
}

boot();

// Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}
