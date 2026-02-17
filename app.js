// Ergänze das app-Objekt um diese Funktionen:
app.saveAlignment = async function(type) {
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

    await db.save('alignment', data);
    alert('Alignment gespeichert.');
};

// Initialisierung beim Laden (um alte Daten anzuzeigen)
app.loadAlignment = async function() {
    const today = new Date().toISOString().split('T')[0];
    const logs = await db.getAll('alignment');
    const todayLog = logs.find(l => l.date === today);
    
    if (todayLog) {
        if (todayLog.type === 'morning') document.getElementById('morning-intent').value = todayLog.intent || '';
        // ... Logik für Evening analog
    }
};
