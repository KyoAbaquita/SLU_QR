function escHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        let toastTimer;
        function showToast(msg, type) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.className = 'toast show ' + (type || '');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => t.className = 'toast', 3000);
        }

// ── Audio feedback using Web Audio API (no files needed) ──
function playBeep(type = 'success') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = type === 'success'
            ? [{ f: 523, t: 0,    d: 0.12 }, { f: 659, t: 0.1,  d: 0.12 }, { f: 784, t: 0.2,  d: 0.18 }]  // C-E-G chime
            : [{ f: 220, t: 0,    d: 0.25 }, { f: 185, t: 0.22, d: 0.25 }]; // low buzzer

        notes.forEach(({ f, t, d }) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = type === 'success' ? 'sine' : 'square';
            osc.frequency.setValueAtTime(f, ctx.currentTime + t);
            gain.gain.setValueAtTime(type === 'success' ? 0.35 : 0.2, ctx.currentTime + t);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + d + 0.05);
        });
    } catch (e) { /* Ignore if audio not supported */ }
}
