const routes = new Map();

export const router = {
  register(name, render) { routes.set(name, render); },
  current() {
    const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
    return { name: path || "dashboard", params: new URLSearchParams(query) };
  },
  go(name) { location.hash = `#/${name}`; },
  async render(root) {
    const route = this.current();
    const renderer = routes.get(route.name) || routes.get("dashboard");
    root.setAttribute("aria-busy", "true");
    try {
      await renderer(root, route.params);
      document.title = `${root.querySelector("h1")?.textContent || "PersonalOS"} · PersonalOS`;
      root.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      document.querySelectorAll("[data-route]").forEach(node => {
        const active = node.dataset.route === route.name || (route.name === "tasks" && node.dataset.route === "more");
        node.classList.toggle("active", active);
        if (active) node.setAttribute("aria-current", "page"); else node.removeAttribute("aria-current");
      });
    } catch (error) {
      console.error(error);
      root.innerHTML = `<section class="error-card"><h1>Etwas ist schiefgelaufen</h1><p>${String(error.message || error)}</p><button onclick="location.reload()">Neu laden</button></section>`;
    } finally { root.removeAttribute("aria-busy"); }
  }
};
