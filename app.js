const app = {
    init() {
        console.log("Personal OS: Core Loading...");
        this.navigate('dashboard');
        this.loadAlignment(); // Lädt Daten beim Start
    },

    // Zentraler Router
    navigate(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + viewId);
        if (target) {
            target.classList.add('active');
            window.scrollTo(0, 0);
        }
        // Kleines haptisches Feedback für iOS
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    },

    // Alignment Logik (Journaling)
    async saveAlignment(type) {
        const today = new Date().toISOString().split('T')[0];
        let data = { id: `${today}_${type}`, date: today, type: type };

        if (type === 'morning') {
            data.intent = document.getElementById('morning-intent').value;
        } else {
            data.q1 = document.getElementById('evening-q1').value;
            data.q2 = document.getElementById('evening-q2').value;
            data.q3 = document.getElementById('evening-q3').value;
            data.q4 = document.getElementById('evening-q4').value;
        }

        try {
            await db.save('alignment', data);
            alert('Journal lokal gesichert.');
        } catch (e) {
            console.error("Save Error", e);
        }
    },

    async loadAlignment() {
        const today = new Date().toISOString().split('T')[0];
        const allLogs = await db.getAll('alignment');
        
        // Suche Daten für heute
        const morning = allLogs.find(l => l.id === `${today}_morning`);
        const evening = allLogs.find(l => l.id === `${today}_evening`);

        if (morning) document.getElementById('morning-intent').value = morning.intent || '';
        if (evening) {
            document.getElementById('evening-q1').value = evening.q1 || '';
            document.getElementById('evening-q2').value = evening.q2 || '';
            document.getElementById('evening-q3').value = evening.q3 || '';
            document.getElementById('evening-q4').value = evening.q4 || '';
        }
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());
