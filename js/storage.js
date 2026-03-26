// ============================================================
//  storage.js — API-backed storage (MySQL via server.js)
//  Falls back to localStorage when the server is unreachable
// ============================================================

// ── Server base URL ──────────────────────────────────────────
const API_BASE = window.location.origin;
const SYNC_QUEUE_KEY = 'qr_sync_queue';

// ── Generic fetch helpers ────────────────────────────────────
async function apiFetch(path, options = {}) {
    const res = await fetch(API_BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) throw new Error(`API ${path} → HTTP ${res.status}`);
    return res.json();
}

// ── Connection status indicator ──────────────────────────────
function setDbStatus(online) {
    const el = document.getElementById('db-status');
    if (!el) return;
    if (online) {
        el.textContent = '🟢 Connected & Synced';
        el.style.color = 'var(--success, #22d3a5)';
    } else {
        el.textContent = '🟡 Offline (Saving Locally)';
        el.style.color = '#f59e0b';
    }
}

// ════════════════════════════════════════════════════════════
//  LOAD & SYNC
// ════════════════════════════════════════════════════════════
async function loadData() {
    // 1. Load Local Fallback immediately for speed
    try {
        const rawRegs = localStorage.getItem(STORAGE_KEY);
        const rawGuests = localStorage.getItem(GUEST_KEY);
        registrations = rawRegs ? JSON.parse(rawRegs) : [];
        guests = rawGuests ? JSON.parse(rawGuests) : [];
        renderTable(false);
        renderGuestTable();
        updateDeptFilter();
    } catch (e) { console.error("Local load failed", e); }

    // 2. Try to Sync with Server
    try {
        const [fetchedGuests, fetchedRegs] = await Promise.all([
            apiFetch('/api/guests'),
            apiFetch('/api/registrations')
        ]);

        // Smart Merge: Keep the most recent data
        guests = fetchedGuests;
        registrations = fetchedRegs;

        // Cache for next offline session
        localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
        localStorage.setItem(GUEST_KEY, JSON.stringify(guests));

        setDbStatus(true);
        updateDeptFilter();
        // Process any pending offline scans
        await processSyncQueue();

    } catch (err) {
        console.warn('⚠️ Offline mode:', err.message);
        setDbStatus(false);
    }

    updateStats();
}

// ── Live Sync (Polling) ───────────────────────────────────
async function syncRegistrations() {
    try {
        const fetchedRegs = await apiFetch('/api/registrations');
        
        // Only update if the number of records has changed
        if (fetchedRegs.length !== registrations.length) {
            console.log("🔄 Background sync: Updating records...");
            registrations = fetchedRegs;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
            renderTable(false);
            updateStats();
        }
    } catch (err) {
        // Silently fail background sync to avoid annoying popups
    }
}

// ════════════════════════════════════════════════════════════
//  SAVE REGISTRATIONS (Offline-Aware)
// ════════════════════════════════════════════════════════════
async function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));

    if (registrations.length === 0) return;
    const newestRecord = registrations[0];

    try {
        const res = await fetch(API_BASE + '/api/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newestRecord)
        });

        if (res.status === 409) {
            // Already registered on another device!
            showToast('⚠️ Already scanned on another device', 'warn');
            syncRegistrations(); // Refresh list immediately
            return;
        }

        if (!res.ok) throw new Error('Sync failed');
        
        setDbStatus(true);
    } catch (err) {
        // ADD TO QUEUE IF FAILED (and not a 409 conflict)
        addToSyncQueue(newestRecord);
        setDbStatus(false);
        showToast('📍 Saved locally (will sync later)', '');
    }
}

// ── Sync Queue Helpers ─────────────────────────────────────
function addToSyncQueue(record) {
    let queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    queue.push(record);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

async function processSyncQueue() {
    let queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    console.log(`🔄 Syncing ${queue.length} offline records...`);

    for (const record of queue) {
        try {
            await apiFetch('/api/registrations', {
                method: 'POST',
                body: JSON.stringify(record)
            });
        } catch (e) {
            console.error("Sync failed for record", record);
            return; // Stop if server goes down again
        }
    }

    // Clear queue if all succeeded
    localStorage.removeItem(SYNC_QUEUE_KEY);
    showToast('✅ All offline scans synced!', '');
}

// ════════════════════════════════════════════════════════════
//  OTHER ENDPOINTS
// ════════════════════════════════════════════════════════════
async function clearRegistrationsOnServer() {
    try {
        await apiFetch('/api/registrations', { method: 'DELETE' });
    } catch (err) { console.warn('Server clear failed'); }
}

async function deleteRegistrationOnServer(id) {
    try {
        await apiFetch(`/api/registrations/${id}`, { method: 'DELETE' });
    } catch (err) { console.warn('Server delete failed'); }
}

async function saveGuests() {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guests));
    try {
        await apiFetch('/api/guests', { method: 'POST', body: JSON.stringify(guests) });
        setDbStatus(true);
    } catch (err) {
        setDbStatus(false);
        showToast('⚠️ Guest list updated locally', '');
    }
}
