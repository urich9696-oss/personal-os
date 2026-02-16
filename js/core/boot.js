// js/core/boot.js
// PERSONAL OS — Bootloader (robust, crash-safe, iOS-safe)

document.addEventListener("DOMContentLoaded", async function () {

  try {

    // ===== 1) IndexedDB öffnen =====
    if (typeof State === "undefined" || typeof State.openDB !== "function") {
      console.error("State module missing");
      return;
    }

    await State.openDB();
    await State.ensureTodayState();

    // ===== 2) Router initialisieren =====
    if (typeof Router === "undefined" || typeof Router.init !== "function") {
      console.error("Router module missing");
      return;
    }

    Router.init();

  } catch (e) {
    console.error("Boot failure", e);
  }

  // ===== 3) Service Worker Registrierung =====
  try {

    if ("serviceWorker" in navigator) {

      // GH Pages Subpath Safe
      const swUrl = "./service-worker.js";

      navigator.serviceWorker
        .register(swUrl)
        .then(function (reg) {
          console.log("SW registered", reg.scope);
        })
        .catch(function (err) {
          console.error("SW registration failed", err);
        });

    }

  } catch (e) {
    console.error("SW init error", e);
  }

});
