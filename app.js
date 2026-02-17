import { dbProvider, pathDB, financeDB } from './db.js';

window.router = {
    navigate: (viewId, navElement = null) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if (navElement) {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            navElement.classList.add('active');
        }
        if(viewId === 'dashboard') systemOS.refreshDashboard();
        if(viewId === 'maintenance') maintenanceUI.render();
        if(viewId === 'path') pathUI.render();
        if(viewId === 'finance') financeUI.render();
    }
};

window.alignmentUI = {
    startFlow: (type) => {
        const modal = document.getElementById('global-modal');
        const body = document.getElementById('modal-body');
        modal.style.display = 'block';
        body.innerHTML = `<h3>${type.toUpperCase()} FLOW</h3><textarea id="flow-input" style="height:200px" placeholder="Write here..."></textarea><button class="primary-trigger" onclick="alignmentUI.save('${type}')">SAVE</button>`;
    },
    save: async (type) => {
        const val = document.getElementById('flow-input').value;
        const date = new Date().toISOString().split('T')[0];
        await dbProvider.saveJournal({ date, [type]: val });
        document.getElementById('global-modal').style.display = 'none';
    },
    toggleVault: async () => {
        const v = document.getElementById('vault-list');
        v.style.display = v.style.display === 'none' ? 'block' : 'none';
        const logs = await dbProvider.getAllJournals();
        v.innerHTML = logs.map(l => `<div class="glass" style="padding:10px; margin-bottom:5px;">${l.date}</div>`).join('');
    }
};

window.maintenanceUI = {
    render: async () => {
        const items = await dbProvider.getMaintenance();
        const list = document.getElementById('habit-list');
        list.innerHTML = items.map(i => `
            <div class="ops-item" style="display:flex; justify-content:space-between; align-items:center;">
                <span>${i.title}</span>
                <div class="checkbox-native ${i.completed ? 'checked' : ''}" onclick="maintenanceUI.toggle(${i.id})"></div>
            </div>
        `).join('');
    },
    showAddModal: () => {
        const modal = document.getElementById('global-modal');
        modal.style.display = 'block';
        document.getElementById('modal-body').innerHTML = `<input id="ops-title" placeholder="Habit Title"><button class="primary-trigger" onclick="maintenanceUI.add()">ADD</button>`;
    },
    add: async () => {
        const title = document.getElementById('ops-title').value;
        await dbProvider.addMaintenanceItem({ title, completed: false, type: 'habit' });
        document.getElementById('global-modal').style.display = 'none';
        maintenanceUI.render();
    },
    toggle: async (id) => {
        const items = await dbProvider.getMaintenance();
        const item = items.find(i => i.id === id);
        item.completed = !item.completed;
        await dbProvider.updateMaintenanceItem(item);
        maintenanceUI.render();
    }
};

window.pathUI = {
    render: async () => {
        const blocks = await pathDB.getBlocks();
        document.getElementById('path-timeline').innerHTML = blocks.map(b => `<div class="time-block"><strong>${b.start}</strong> - ${b.title}</div>`).join('');
    },
    showAddModal: () => {
        const modal = document.getElementById('global-modal');
        modal.style.display = 'block';
        document.getElementById('modal-body').innerHTML = `<input id="p-title" placeholder="Task"><input type="time" id="p-start"><button class="primary-trigger" onclick="pathUI.add()">ADD</button>`;
    },
    add: async () => {
        const title = document.getElementById('p-title').value;
        const start = document.getElementById('p-start').value;
        await pathDB.saveBlock({ title, start });
        document.getElementById('global-modal').style.display = 'none';
        pathUI.render();
    }
};

window.financeUI = {
    render: async () => {
        const items = await financeDB.getItems();
        let total = 0;
        const list = document.getElementById('gatekeeper-list');
        list.innerHTML = '';
        items.forEach(i => {
            total += parseFloat(i.amount);
            list.innerHTML += `<div class="gatekeeper-card">${i.name} - €${i.amount}</div>`;
        });
        document.getElementById('total-spent').innerText = `€ ${total.toFixed(2)}`;
    },
    showAddModal: () => {
        const modal = document.getElementById('global-modal');
        modal.style.display = 'block';
        document.getElementById('modal-body').innerHTML = `<input id="f-name" placeholder="Item"><input type="number" id="f-amount" placeholder="0.00"><button class="primary-trigger" onclick="financeUI.add()">LOG</button>`;
    },
    add: async () => {
        const name = document.getElementById('f-name').value;
        const amount = document.getElementById('f-amount').value;
        await financeDB.saveItem({ name, amount });
        document.getElementById('global-modal').style.display = 'none';
        financeUI.render();
    }
};

window.systemOS = {
    refreshDashboard: async () => {
        const ops = await dbProvider.getMaintenance();
        if(ops.length > 0) {
            const score = Math.round((ops.filter(i => i.completed).length / ops.length) * 100);
            document.querySelector('#dashboard-grid div:nth-child(1) div').innerText = `${score}%`;
        }
    },
    exportData: async () => {
        const data = { maintenance: await dbProvider.getMaintenance(), path: await pathDB.getBlocks(), finance: await financeDB.getItems() };
        const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'personal_os.json';
        a.click();
    },
    factoryReset: () => { if(confirm('Clear all?')) { indexedDB.deleteDatabase('PersonalOS_DB'); location.reload(); } }
};

document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => { document.getElementById('status-clock').innerText = new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}); }, 1000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
    systemOS.refreshDashboard();
});
