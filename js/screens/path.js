// js/screens/path.js
// PERSONAL OS — Execution (Today’s Path)

ScreenRegistry.register("path", {

  async mount(container, ctx) {

    try {

      container.innerHTML = "";

      const today = new Date().toISOString().split("T")[0];
      const status = await State.getDayStatus();

      const root = document.createElement("div");
      root.className = "path";

      if (status !== "execution") {
        const locked = document.createElement("div");
        locked.innerHTML = "<h2>Execution Locked</h2><div>Complete Morning first.</div>";
        root.appendChild(locked);
        container.appendChild(root);
        return;
      }

      // ===== LOAD JOURNAL =====
      const journal = await new Promise(resolve => {
        const req = indexedDB.open("personalOS");
        req.onsuccess = function (e) {
          const db = e.target.result;
          const tx = db.transaction("journalEntries", "readonly");
          const r = tx.objectStore("journalEntries").get(today);
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => resolve(null);
        };
      });

      if (!journal || !journal.morning?.todos) {
        root.innerHTML = "<h2>No Plan Found</h2>";
        container.appendChild(root);
        return;
      }

      const todos = journal.morning.todos;

      const title = document.createElement("h2");
      title.innerText = "Execution";
      root.appendChild(title);

      const perfDiv = document.createElement("div");
      root.appendChild(perfDiv);

      function renderPerformance() {
        const total = todos.length;
        const done = todos.filter(t => t.done).length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        perfDiv.innerHTML = `<div>Performance: ${pct}% (${done}/${total})</div>`;
      }

      renderPerformance();

      // ===== TODO LIST =====
      const list = document.createElement("div");

      async function saveJournal(updated) {
        return new Promise(resolve => {
          const req = indexedDB.open("personalOS");
          req.onsuccess = function (e) {
            const db = e.target.result;
            const tx = db.transaction("journalEntries", "readwrite");
            tx.objectStore("journalEntries").put(updated);
            tx.oncomplete = () => resolve(true);
          };
        });
      }

      function renderTodos() {
        list.innerHTML = "";
        todos.forEach((t, index) => {

          const row = document.createElement("div");
          row.className = "todo-row";

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!t.done;

          cb.onchange = async function () {
            t.done = cb.checked;
            await saveJournal(journal);
            renderPerformance();
          };

          const span = document.createElement("span");
          span.innerText = t.text;

          row.appendChild(cb);
          row.appendChild(span);

          list.appendChild(row);
        });
      }

      renderTodos();
      root.appendChild(list);

      // ===== CALENDAR BLOCKS =====
      const blockTitle = document.createElement("h3");
      blockTitle.innerText = "Today’s Blocks";
      root.appendChild(blockTitle);

      const blockList = document.createElement("div");
      root.appendChild(blockList);

      function timeToMinutes(str) {
        if (!str) return 0;
        const parts = str.split(":");
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }

      async function loadBlocks() {
        return new Promise(resolve => {
          const req = indexedDB.open("personalOS");
          req.onsuccess = function (e) {
            const db = e.target.result;
            const tx = db.transaction("calendarBlocks", "readonly");
            const index = tx.objectStore("calendarBlocks").index("date");
            const r = index.getAll(today);
            r.onsuccess = () => resolve(r.result || []);
            r.onerror = () => resolve([]);
          };
        });
      }

      async function renderBlocks() {
        const blocks = await loadBlocks();
        blocks.sort((a, b) =>
          timeToMinutes(a.start) - timeToMinutes(b.start)
        );

        blockList.innerHTML = "";

        blocks.forEach(b => {
          const div = document.createElement("div");
          div.innerText = `${b.start} - ${b.end} | ${b.title}`;
          blockList.appendChild(div);
        });
      }

      await renderBlocks();

      // ===== QUICK ADD BLOCK =====
      const startInput = document.createElement("input");
      startInput.placeholder = "Start (HH:MM)";

      const endInput = document.createElement("input");
      endInput.placeholder = "End (HH:MM)";

      const titleInput = document.createElement("input");
      titleInput.placeholder = "Title";

      const addBlockBtn = document.createElement("button");
      addBlockBtn.innerText = "Add Block";

      addBlockBtn.onclick = async function () {
        const start = startInput.value.trim();
        const end = endInput.value.trim();
        const title = titleInput.value.trim();
        if (!start || !end || !title) return;

        await new Promise(resolve => {
          const req = indexedDB.open("personalOS");
          req.onsuccess = function (e) {
            const db = e.target.result;
            const tx = db.transaction("calendarBlocks", "readwrite");
            tx.objectStore("calendarBlocks").add({
              date: today,
              start,
              end,
              title
            });
            tx.oncomplete = () => resolve(true);
          };
        });

        startInput.value = "";
        endInput.value = "";
        titleInput.value = "";

        await renderBlocks();
      };

      root.appendChild(startInput);
      root.appendChild(endInput);
      root.appendChild(titleInput);
      root.appendChild(addBlockBtn);

      container.appendChild(root);

    } catch (e) {
      console.error("Path mount error", e);
      container.innerHTML = "<div class='error'>Execution failed</div>";
    }

  }

});
