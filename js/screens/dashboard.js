// js/screens/dashboard.js

const Dashboard = (function () {

  async function mount() {
    try {
      const status = await State.getDayStatus();
      const btn = document.getElementById("primary-action");
      if (!btn) return;

      btn.onclick = null;

      if (status === "morning") {
        btn.innerText = "Start Morning Setup";
        btn.onclick = () => Router.go("mindset");
        return;
      }

      if (status === "execution") {
        btn.innerText = "Go to Execution";
        btn.onclick = () => Router.go("path");
        return;
      }

      if (status === "evening") {
        btn.innerText = "Continue Evening Review";
        btn.onclick = () => Router.go("mindset");
        return;
      }

      if (status === "closed") {
        btn.innerText = "View Day Summary";
        btn.onclick = () => {
          if (typeof Router.setParam === "function") Router.setParam("viewVault", true);
          Router.go("mindset");
        };
        return;
      }

      // Defensive fallback
      btn.innerText = "Open";
      btn.onclick = () => Router.go("dashboard");

    } catch (e) {
      console.error("Dashboard mount error", e);
    }
  }

  return { mount };

})();
