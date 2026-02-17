import { db } from './db.js';

// --- ROUTER ---
window.router = {
    navigate: (id, el) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        if(el) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            el.classList.add('active');
        }
        ui.updateDash();
    }
};

// --- UI ENGINE ---
window.ui = {
    showModal: (contentHTML, onConfirm) => {
        const modal = document.getElementById('modal-overlay');
        document.getElementById('modal-body').innerHTML = contentHTML;
        modal.style.display = 'flex';
        document.getElementById('modal-confirm').onclick = async () => {
            await onConfirm();
            ui.closeModal();
            ui.updateDash();
        };
    },
    closeModal: () => {
        document.getElementById('modal-overlay').style.display = 'none';
    },
    
    // Path Logic
    showPathAdd: () => {
        ui.showModal(`
            <h2 style="margin:0">New Path Block</h2>
            <input id="p-title" placeholder="Activity Name">
            <input type="time" id="p-time" value="09:00">
        `, async () => {
            const title = document.getElementById('p-title').value;
            const time = document.getElementById('p-time').value;
            if(title) await db.save('path', { title, time });
            ui.renderPath();
        });
    },

    renderPath: async () => {
        const items = await db.getAll('path');
        items.sort((a,b) => a.time.localeCompare(b.time));
        document.getElementById('path-list').innerHTML = items.map(i => `
            <div class="glass" style="padding:18px; border-radius:18px; margin-bottom:12px;">
                <small style="color:var(--ios-sub)">${i.time}</small>
                <div style="font-weight:600">${i.title}</div>
            </div>
        `).join('');
    },

    // Finance Logic
    showFinAdd: () => {
        ui.showModal(`
            <h2 style="margin:0">Log Expense</h2>
            <input id="f-name" placeholder="Item Name">
            <input type="number" id="f-amount" placeholder="0.00">
        `, async () => {
            const name = document.getElementById('f-name').value;
            const amount = document.getElementById('f-amount').value;
            if(name && amount) await db.save('fin', { name, amount: parseFloat(amount) });
            ui.renderFin();
        });
    },

    renderFin: async () => {
        const items = await db.getAll('fin');
        const total = items.reduce((s, i) => s + i.amount, 0);
        document.getElementById('total-spent').innerText = `€ ${total.toFixed(2)}`;
        document.getElementById('gatekeeper-list').innerHTML = items.map(i => `
            <div class="glass" style="padding:15px; border-radius:15px; margin-bottom:10px; display:flex; justify-content:space-between;">
                <span>${i.name}</span><strong>€${i.amount}</strong>
            </div>
        `).join('');
    },

    updateDash: async () => {
        const fins = await db.getAll('fin');
        const total = fins.reduce((s, i) => s + i.amount, 0);
        document.getElementById('dash-fin').innerText = `€${Math.round(total)}`;
        
        const paths = await db.getAll('path');
        if(paths.length > 0) {
            document.getElementById('dash-path').innerText = paths[0].title;
            document.getElementById('dash-perf').innerText = '100%';
        }
    }
};

// --- SYSTEM ---
window.system = {
    exportData: async () => {
        const all = await db.getAll('path'); // Simplified for example
        alert('Data export ready in console (JSON)');
        console.log(JSON.stringify(all));
    },
    reset: () => {
        if(confirm('Delete all data?')) {
            indexedDB.deleteDatabase('PERSONAL_OS_DB');
            location.reload();
        }
    }
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
        document.getElementById('status-clock').innerText = new Date().toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
    }, 1000);
    ui.updateDash();
    ui.renderPath();
    ui.renderFin();
});
