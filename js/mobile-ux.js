// ============================================================
//  mobile-ux.js  —  Bottom Nav, Tab Switcher, Skeleton Loader
// ============================================================

/* ──────────────────────────────────────────────────────────
   TAB SWITCHER
   ────────────────────────────────────────────────────────── */
let activeTab = 'scanner'; // 'scanner' | 'log'

function switchTab(tab) {
    activeTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Show/hide panels
    document.querySelectorAll('.mobile-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.panel === tab);
    });
}

// Called after a new scan — auto-switch to log tab so user sees the new entry
function autoSwitchToLog() {
    if (window.innerWidth <= 991) {
        switchTab('log');
        // Briefly bounce the log tab button
        const logBtn = document.querySelector('.tab-btn[data-tab="log"]');
        if (logBtn) {
            logBtn.style.transform = 'scale(1.05)';
            setTimeout(() => logBtn.style.transform = '', 300);
        }
    }
}

// Update the badge count on the Log tab
function updateTabBadge(count) {
    const badge = document.getElementById('tab-log-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.add('visible');
    } else {
        badge.classList.remove('visible');
    }
}

/* ──────────────────────────────────────────────────────────
   SKELETON LOADER
   ────────────────────────────────────────────────────────── */
const SKELETON_ROW_COUNT = 6;

function showSkeletons() {
    const tbody = document.getElementById('reg-tbody');
    if (!tbody) return;

    // Stat boxes loading state
    document.querySelectorAll('.stat-box').forEach(box => box.classList.add('loading'));

    // Build skeleton rows for the table
    let html = '';
    for (let i = 0; i < SKELETON_ROW_COUNT; i++) {
        html += `
        <tr class="skeleton-row">
            <td><span class="skeleton sk-num"></span></td>
            <td><span class="skeleton sk-name"></span></td>
            <td><span class="skeleton sk-dept"></span></td>
            <td><span class="skeleton sk-job"></span></td>
            <td><span class="skeleton sk-table"></span></td>
            <td><span class="skeleton sk-time"></span></td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

function hideSkeletons() {
    // Remove loading from stat boxes
    document.querySelectorAll('.stat-box').forEach(box => box.classList.remove('loading'));
    // The real renderTable() call will replace the tbody content
}

/* ──────────────────────────────────────────────────────────
   INIT — run after DOM is ready
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

    // ── Show skeletons immediately while data loads ──
    showSkeletons();

    // ── Build Bottom Nav Bar ──
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = `
        <button class="bottom-nav-item" onclick="document.getElementById('analytics-modal').classList.add('show')" aria-label="Analytics">
            <span class="nav-icon">📊</span>
            <span class="bottom-nav-label">Analytics</span>
        </button>
        <button class="bottom-nav-item" onclick="openGuestModal()" aria-label="Guests and QR">
            <span class="nav-icon">👥</span>
            <span class="bottom-nav-label">Guests</span>
        </button>
        <button class="bottom-nav-item nav-success" onclick="exportExcel()" aria-label="Export">
            <span class="nav-icon">📥</span>
            <span class="bottom-nav-label">Export</span>
        </button>
        <button class="bottom-nav-item nav-danger" onclick="clearAll()" aria-label="Clear all">
            <span class="nav-icon">🗑️</span>
            <span class="bottom-nav-label">Clear</span>
        </button>
    `;
    document.body.appendChild(nav);

    // ── Build Tab Bar ──
    const tabBar = document.createElement('div');
    tabBar.className = 'mobile-tab-bar';
    tabBar.innerHTML = `
        <button class="tab-btn active" data-tab="scanner" onclick="switchTab('scanner')" aria-label="Scanner view">
            <span class="tab-icon">📷</span>
            <span>Scanner</span>
        </button>
        <button class="tab-btn" data-tab="log" onclick="switchTab('log')" aria-label="Registration log">
            <span class="tab-icon">📋</span>
            <span>Reg. Log</span>
            <span class="tab-badge" id="tab-log-badge">0</span>
        </button>
    `;

    // Insert tab bar right after the top-bar header
    const header = document.querySelector('header.top-bar');
    if (header && header.parentNode) {
        header.parentNode.insertBefore(tabBar, header.nextSibling);
    }

    // ── Wrap columns as switchable panels ──
    const scannerCol = document.querySelector('.col-12.col-lg-4');
    const logCol     = document.querySelector('.col-12.col-lg-8');

    if (scannerCol && logCol) {
        scannerCol.setAttribute('data-panel', 'scanner');
        scannerCol.classList.add('mobile-panel', 'active');

        logCol.setAttribute('data-panel', 'log');
        logCol.classList.add('mobile-panel');
    }

    // ── Initial tab state ──
    switchTab('scanner');
});

/* ──────────────────────────────────────────────────────────
   PATCH: wrap renderTable to hide skeletons + update badge
   ────────────────────────────────────────────────────────── */
const _originalRenderTable = typeof renderTable === 'function' ? renderTable : null;

// We monkey-patch after all scripts load via a MutationObserver trick
// (since renderTable is defined in ui.js which loads before this file)
window.addEventListener('load', () => {
    const origRender = window.renderTable;
    if (typeof origRender === 'function') {
        window.renderTable = function(highlightFirst) {
            hideSkeletons();
            origRender.call(this, highlightFirst);
            // Update tab badge with current count
            updateTabBadge(registrations ? registrations.length : 0);
        };
    }

    const origUpdateStats = window.updateStats;
    if (typeof origUpdateStats === 'function') {
        window.updateStats = function() {
            origUpdateStats.call(this);
            updateTabBadge(registrations ? registrations.length : 0);
        };
    }
});
