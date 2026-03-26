function setStatus(type, text) {
    const el = document.getElementById('scan-status');
    const dot = document.getElementById('pulse-dot');
    const span = document.getElementById('status-text');

    el.className = 'scanner-status ' + (type === 'ok' ? 'ok' : type === 'warn' ? 'warn' : 'idle');
    dot.className = 'pulse ' + (type === 'ok' ? 'active' : type === 'warn' ? 'warn' : '');
    span.textContent = text;
}


function renderTable(highlightFirst) {
    const tbody = document.getElementById('reg-tbody');
    tbody.innerHTML = '';

    if (registrations.length === 0) {
        tbody.innerHTML = `
        <tr id="empty-row"><td colspan="6">
          <div class="empty-state">
            <svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 12H8v-2h4v2zm4-4H8v-2h8v2zm0-4H8V5h8v2z"/></svg>
            <p>No registrations yet.<br/>Point a QR code at the camera to begin.</p>
          </div>
        </td></tr>`;
        document.getElementById('record-count').textContent = '0 records';
        return;
    }

    registrations.forEach((r, idx) => {
        const tr = document.createElement('tr');
        if (highlightFirst && idx === 0) tr.className = 'new-row';

        // Look up live guest data — fixes stale scan records that had no jobTitle saved
        const liveGuest = (r.guestId && guests) ? guests.find(g => g.id === r.guestId) : null;
        const dept = liveGuest ? (liveGuest.Department || '') : (r.department || '');
        const jobTitle = liveGuest ? (liveGuest['Job Title'] || '') : (r.jobTitle || '');

        let formattedTime = r.timestamp || '';
        if (formattedTime.includes(',')) {
            formattedTime = formattedTime.replace(/,\s*(\d{2}:\d{2}:\d{2}\s*(?:AM|PM))/i, ',<br/>($1)');
        }

        tr.innerHTML = `
        <td style="text-align:center;color:var(--muted);font-size:0.8rem;font-weight:600;width:40px;">${idx + 1}</td>
        <td style="font-weight:600;" title="${escHtml(r.scanData)}">${escHtml(r.scanData)}</td>
        <td style="color:var(--muted);">${escHtml(dept)}</td>
        <td style="color:var(--muted);">${escHtml(jobTitle)}</td>
        <td style="text-align: center; font-weight: bold; color: var(--accent); font-size: 1.1em;">${escHtml(String(r.tableNo || 'N/A').replace(/^table\s*/i, '').trim())}</td>
        <td class="ts-cell" style="text-align: center; line-height: 1.4;">${formattedTime}</td>`;

        tbody.appendChild(tr);
    });

    document.getElementById('record-count').textContent =
        `${registrations.length} record${registrations.length !== 1 ? 's' : ''}`;

    // Re-apply any active search filter after re-render
    filterRegTable();
}

/* ── Feature 2: Search/filter the attendance table ─────── */
function filterRegTable() {
    const q = (document.getElementById('reg-search')?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#reg-tbody tr');
    let visible = 0;
    rows.forEach(tr => {
        if (tr.id === 'empty-row') return;
        const text = tr.textContent.toLowerCase();
        const show = !q || text.includes(q);
        tr.style.display = show ? '' : 'none';
        if (show) visible++;
    });
}

function updateStats() {
    const totalReg = registrations.length;

    const totalGuests = guests.length;
    if (totalGuests > 0) {
        const percent = Math.round((totalReg / totalGuests) * 100);
        const absentCount = totalGuests - totalReg;
        document.getElementById('stat-percent').textContent = percent + '%';
        document.getElementById('stat-progress').style.width = percent + '%';
        document.getElementById('stat-present-count').textContent = totalReg;
        document.getElementById('stat-absent-count').textContent = absentCount;
    } else {
        document.getElementById('stat-percent').textContent = '—';
        document.getElementById('stat-progress').style.width = '0%';
        document.getElementById('stat-present-count').textContent = totalReg;
        document.getElementById('stat-absent-count').textContent = '—';
    }

    // Feature 1: Update department breakdown
    updateDeptBreakdown();
}

/* ── Feature 1: Per-dept attendance breakdown ────────────── */
function updateDeptBreakdown() {
    const list = document.getElementById('dept-breakdown-list');
    if (!list) return;

    if (!guests || guests.length === 0) {
        list.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 12px;">
            <svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:rgba(255,255,255,0.08);"><path d="M17 20H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3zM9 8v2h6V8H9zm0 4v2h6v-2H9zm0 4v2h4v-2H9z"/></svg>
            <span style="font-size:0.78rem;color:var(--muted);text-align:center;line-height:1.5;">No guest data imported yet.<br/>Import an Excel file to see breakdown.</span>
        </div>`;
        return;
    }

    // Group guests by department
    const deptMap = {};
    guests.forEach(g => {
        const d = g.Department || 'No Department';
        if (!deptMap[d]) deptMap[d] = { total: 0, present: 0 };
        deptMap[d].total++;
        if (registrations.find(r => r.guestId === g.id)) deptMap[d].present++;
    });

    const sorted = Object.entries(deptMap).sort((a, b) => b[1].present - a[1].present || b[1].total - a[1].total);
    const medals = ['🥇', '🥈', '🥉'];

    list.innerHTML = sorted.map(([dept, { total, present }], idx) => {
        const pct    = Math.round((present / total) * 100);
        const absent = total - present;

        // Colour shifts: green ≥80%, amber ≥50%, red <50%
        const color     = pct >= 80 ? '#0dfb9c' : pct >= 50 ? '#f59e0b' : '#ff3366';
        const bgColor   = pct >= 80 ? 'rgba(13,251,156,0.06)'  : pct >= 50 ? 'rgba(245,158,11,0.06)'  : 'rgba(255,51,102,0.06)';
        const borderClr = pct >= 80 ? 'rgba(13,251,156,0.15)'   : pct >= 50 ? 'rgba(245,158,11,0.15)'   : 'rgba(255,51,102,0.15)';
        const gradBar   = pct >= 80
            ? 'linear-gradient(90deg, #0dfb9c, #00c98a)'
            : pct >= 50
            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
            : 'linear-gradient(90deg, #ff3366, #ff6b35)';

        const rankBadge = idx < 3
            ? `<span style="font-size:1.1rem;line-height:1;">${medals[idx]}</span>`
            : `<span style="width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,0.06);display:inline-flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:800;color:var(--muted);">${idx + 1}</span>`;

        return `
        <div class="dept-box" style="
            background:${bgColor};
            border:1px solid ${borderClr};
            border-radius:12px;
            padding:12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            position: relative;
            overflow: hidden;
        ">
            <!-- Header: Rank + Name + Pct -->
            <div style="display:flex;align-items:center;gap:6px;">
                ${rankBadge}
                <span style="flex:1;font-size:0.75rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(dept)}">${escHtml(dept)}</span>
                <span style="font-size:0.95rem;font-weight:900;font-family:'Outfit',sans-serif;color:${color};text-shadow:0 0 10px ${color}33;">${pct}%</span>
            </div>

            <!-- Progress -->
            <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${gradBar};border-radius:2px;transition:width 0.8s ease;"></div>
            </div>

            <!-- Stats Row -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                <div style="display:flex;gap:4px;">
                    <span style="color:#0dfb9c;font-size:0.6rem;font-weight:800;">${present} P</span>
                    <span style="color:var(--muted);font-size:0.6rem;font-weight:700;">/ ${total} T</span>
                </div>
                <div style="font-size:0.6rem;color:var(--muted);opacity:0.6;">
                    ${absent} missing
                </div>
            </div>
        </div>`;
    }).join('');
}
