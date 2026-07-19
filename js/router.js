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
      root.replaceChildren();
      const card = document.createElement("section");
      card.className = "error-card";
      const heading = document.createElement("h1");
      heading.textContent = "Etwas ist schiefgelaufen";
      const detail = document.createElement("p");
      detail.textContent = String(error.message || error);
      const reload = document.createElement("button");
      reload.textContent = "Neu laden";
      reload.addEventListener("click", () => location.reload());
      card.append(heading, detail, reload);
      root.append(card);
    } finally { root.removeAttribute("aria-busy"); }
  }
};
