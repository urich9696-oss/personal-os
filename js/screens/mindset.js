// js/screens/mindset.js
// PERSONAL OS — Mindset (Morning + Evening + Vault)

ScreenRegistry.register("mindset", {

  async mount(container, ctx) {

    try {

      container.innerHTML = "";

      const today = new Date().toISOString().split("T")[0];
      const status = await State.getDayStatus();
      const viewVault = Router.getParam("viewVault") === true;

      const root = document.createElement("div");
      root.className = "mindset";

      // ===== VAULT MODE =====
      if (viewVault) {

        Router.clearParams();

        const title = document.createElement("h2");
        title.innerText = "Vault";
        root.appendChild(title);

        const db = await State.openDB();
        const tx = db.transaction("vaultEntries", "readonly");
        const store = tx.objectStore("vaultEntries");
        const req = store.getAll();

        req.onsuccess = function () {
          const entries = req.result || [];

          entries.sort((a, b) => b.dayKey.localeCompare(a.dayKey));

          entries.forEach(entry => {

            const card = document.createElement("div");
            card.className = "vault-card";

            card.innerHTML = `
              <div><strong>${entry.dayKey}</strong></div>
              <div>Performance: ${entry.performanceScore}%</div>
              <div>Todos: ${entry.todos.done}/${entry.todos.total}</div>
              <div>Remaining: ${entry.finance.remaining}</div>
            `;

            root.appendChild(card);
          });

        };

        container.appendChild(root);
        return;
      }

      // ===== NORMAL MODE =====

      const journal = await new Promise(resolve => {
        const tx = window.indexedDB.open("personalOS");
        tx.onsuccess = function (e) {
          const db = e.target.result;
          const t = db.transaction("journalEntries", "readonly");
          const store = t.objectStore("journalEntries");
          const r = store.get(today);
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => resolve(null);
        };
      });

      let entry = journal || {
        date: today,
        morning: { lookingForward: "", planning: "", todos: [] },
        evening: { reflection: "", rating: "", gratitude: "" }
      };

      function saveJournal() {
        return new Promise(resolve => {
          const tx = window.indexedDB.open("personalOS");
          tx.onsuccess = function (e) {
            const db = e.target.result;
            const t = db.transaction("journalEntries", "readwrite");
            t.objectStore("journalEntries").put(entry);
            t.oncomplete = () => resolve(true);
          };
        });
      }

      // ===== MORNING =====
      if (status === "morning") {

        const title = document.createElement("h2");
        title.innerText = "Morning Setup";
        root.appendChild(title);

        const input1 = document.createElement("textarea");
        input1.placeholder = "I look forward to...";
        input1.value = entry.morning.lookingForward;

        const input2 = document.createElement("textarea");
        input2.placeholder = "I will do well today...";
        input2.value = entry.morning.planning;

        root.appendChild(input1);
        root.appendChild(input2);

        const todoInput = document.createElement("input");
        todoInput.placeholder = "Add To-Do";
        root.appendChild(todoInput);

        const addBtn = document.createElement("button");
        addBtn.innerText = "Add";
        addBtn.onclick = () => {
          const text = todoInput.value.trim();
          if (!text) return;
          entry.morning.todos.push({ text, done: false });
          todoInput.value = "";
          renderTodos();
        };

        root.appendChild(addBtn);

        const todoList = document.createElement("div");
        root.appendChild(todoList);

        function renderTodos() {
          todoList.innerHTML = "";
          entry.morning.todos.forEach(t => {
            const div = document.createElement("div");
            div.innerText = t.text;
            todoList.appendChild(div);
          });
        }

        renderTodos();

        const completeBtn = document.createElement("button");
        completeBtn.innerText = "Complete Morning";
        completeBtn.onclick = async () => {
          entry.morning.lookingForward = input1.value;
          entry.morning.planning = input2.value;
          await saveJournal();
          await State.completeMorning();
          Router.go("dashboard");
        };

        root.appendChild(completeBtn);
      }

      // ===== EVENING =====
      if (status === "evening") {

        const title = document.createElement("h2");
        title.innerText = "Evening Review";
        root.appendChild(title);

        const input1 = document.createElement("textarea");
        input1.placeholder = "Reflection...";
        input1.value = entry.evening.reflection;

        const input2 = document.createElement("input");
        input2.placeholder = "Rating (e.g. 8/10)";
        input2.value = entry.evening.rating;

        const input3 = document.createElement("textarea");
        input3.placeholder = "Gratitude...";
        input3.value = entry.evening.gratitude;

        root.appendChild(input1);
        root.appendChild(input2);
        root.appendChild(input3);

        const closeBtn = document.createElement("button");
        closeBtn.innerText = "Close Day";
        closeBtn.onclick = async () => {
          entry.evening.reflection = input1.value;
          entry.evening.rating = input2.value;
          entry.evening.gratitude = input3.value;
          await saveJournal();
          await State.closeDay();
          Router.go("dashboard");
        };

        root.appendChild(closeBtn);
      }

      // ===== EXECUTION VIEW (read-only journal) =====
      if (status === "execution") {

        const title = document.createElement("h2");
        title.innerText = "Execution Mode";
        root.appendChild(title);

        const info = document.createElement("div");
        info.innerText = "Journal locked. Execute your plan.";
        root.appendChild(info);

        const startEveningBtn = document.createElement("button");
        startEveningBtn.innerText = "Start Evening Review";
        startEveningBtn.onclick = async () => {
          const transitioned = await State.startEvening();
          if (transitioned) Router.go("mindset");
        };

        root.appendChild(startEveningBtn);
      }

      container.appendChild(root);

    } catch (e) {
      console.error("Mindset mount error", e);
      container.innerHTML = "<div class='error'>Mindset failed to load</div>";
    }

  }

});
