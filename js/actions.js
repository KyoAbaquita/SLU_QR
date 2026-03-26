/* ── Custom confirm dialog (replaces native confirm()) ─── */
let _confirmResolve = null;

function showConfirmDialog(title, message, okLabel = 'Yes, Delete') {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.querySelector('.confirm-ok-btn').textContent = okLabel;
    document.getElementById('confirm-modal').classList.add('show');
    return new Promise(resolve => { _confirmResolve = resolve; });
}

function confirmDialogResolve(result) {
    document.getElementById('confirm-modal').classList.remove('show');
    if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}

async function clearAll() {
    if (!registrations.length) { showToast('ℹ️ Nothing to clear', ''); return; }
    const ok = await showConfirmDialog(
        '🗑️ Clear All Registrations',
        `You are about to delete all ${registrations.length} registration(s). This cannot be undone.`,
        'Yes, Clear All'
    );
    if (!ok) return;
    registrations = [];
    tableCounter = 0;
    lastScanned = '';
    localStorage.removeItem(STORAGE_KEY);
    await clearRegistrationsOnServer();
    renderTable(false);
    updateStats();
    showToast('🗑️ All registrations cleared', '');
}


function exportExcel() {
    if (!registrations.length) {
        showToast('⚠️ No data to export', 'error');
        return;
    }

    const rows = registrations.map((r, i) => {
        // Break date and time with a literal newline so Excel wraps them inside the cell
        let ts = r.timestamp || '';
        if (ts.includes(',')) {
            ts = ts.replace(/,\s*(\d{2}:\d{2}:\d{2}\s*(?:AM|PM))/i, ',\n($1)');
        }

        return {
            'Full Name': r.scanData,
            'Department': r.department || '',
            'Job Title': r.jobTitle || '',
            'Table Number': r.tableNo || 'N/A',
            'Date & Time': ts
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Style the sheet using xlsx-js-style syntax
    for (const cellAdd in ws) {
        if (cellAdd[0] === '!') continue;

        const cell = ws[cellAdd];
        const rowMatch = cellAdd.match(/\d+/);
        const rowNum = rowMatch ? parseInt(rowMatch[0], 10) : 0;

        // Ensure cell has a base style object
        cell.s = {
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        };

        if (rowNum === 1) {
            // Header styling
            cell.s.font = { bold: true, color: { rgb: "FFFFFF" } };
            cell.s.fill = { fgColor: { rgb: "6C63FF" } }; // Purple Accent
        } else {
            // Data row styling (Zebra Striping)
            cell.s.font = { color: { rgb: "333333" } };
            cell.s.fill = { fgColor: { rgb: rowNum % 2 === 0 ? "F8F9FA" : "FFFFFF" } };
        }
    }

    // Adjust column widths explicitly (Name, Dept, Job, Table, Time)
    ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `registrations_${dateStr}.xlsx`);
    showToast('📥 Excel file downloaded!', 'success');
}

/* ── Absent List Modal ───────────────────────────────── */
function showAbsentModal() {
    if (!guests || guests.length === 0) {
        showToast('⚠️ No guests imported yet.', 'error');
        return;
    }

    const scannedIds = new Set(registrations.map(r => r.guestId).filter(Boolean));
    const absentGuests = guests.filter(g => !scannedIds.has(g.id));

    // Update the count badge
    const badge = document.getElementById('absent-count-badge');
    if (badge) badge.textContent = `${absentGuests.length} absent`;

    // Render the table
    const tbody = document.getElementById('absent-tbody');
    if (!tbody) return;

    if (absentGuests.length === 0) {
        tbody.innerHTML = `
        <tr><td colspan="5">
            <div class="empty-state" style="padding:40px 20px;">
                <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                <p>🎉 All guests have checked in!</p>
            </div>
        </td></tr>`;
    } else {
        tbody.innerHTML = absentGuests.map((g, idx) => `
        <tr>
            <td style="text-align:center;color:var(--muted);font-size:0.8rem;font-weight:600;">${idx + 1}</td>
            <td style="font-weight:600;">${escHtml(g.Name || '')}</td>
            <td style="color:var(--muted);">${escHtml(g.Department || '—')}</td>
            <td style="color:var(--muted);">${escHtml(g['Job Title'] || '—')}</td>
            <td style="text-align:center;font-weight:700;color:var(--accent);">${escHtml(String(g['Table Number'] || 'N/A').replace(/^table\s*/i, '').trim())}</td>
        </tr>`).join('');
    }

    // Clear search box & reset dept filter
    const searchEl = document.getElementById('absent-search');
    if (searchEl) searchEl.value = '';

    // Populate department filter with unique depts from absent guests
    const deptSelect = document.getElementById('absent-dept-filter');
    if (deptSelect) {
        const depts = [...new Set(absentGuests.map(g => g.Department || '').filter(Boolean))].sort();
        deptSelect.innerHTML = '<option value="">All Departments</option>' +
            depts.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('');
    }

    document.getElementById('absent-modal').classList.add('show');
}

function closeAbsentModal() {
    document.getElementById('absent-modal').classList.remove('show');
}

function filterAbsentTable() {
    const q    = (document.getElementById('absent-search')?.value || '').toLowerCase().trim();
    const dept = (document.getElementById('absent-dept-filter')?.value || '').toLowerCase();
    const rows = document.querySelectorAll('#absent-tbody tr');
    rows.forEach(tr => {
        if (tr.id === 'absent-empty-row') return;
        const text  = tr.textContent.toLowerCase();
        const cells = tr.querySelectorAll('td');
        // dept column is index 2
        const rowDept = cells[2] ? cells[2].textContent.toLowerCase().trim() : '';
        const matchText = !q    || text.includes(q);
        const matchDept = !dept || rowDept === dept;
        tr.style.display = matchText && matchDept ? '' : 'none';
    });
}

/* ── Feature 4: Export absent guests to Excel ─────────── */
function exportAbsentList() {
    if (!guests || guests.length === 0) {
        showToast('⚠️ No guests imported yet.', 'error');
        return;
    }

    const scannedIds = new Set(registrations.map(r => r.guestId).filter(Boolean));
    const absentGuests = guests.filter(g => !scannedIds.has(g.id));

    if (absentGuests.length === 0) {
        showToast('🎉 All guests have already checked in!', 'success');
        return;
    }

    const rows = absentGuests.map(g => ({
        'Full Name': g.Name,
        'Department': g.Department || '',
        'Job Title': g['Job Title'] || '',
        'Table Number': g['Table Number'] || 'N/A',
        'Email': g.Email || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Style header row
    for (const cellAddr in ws) {
        if (cellAddr[0] === '!') continue;
        const rowNum = parseInt(cellAddr.match(/\d+/)?.[0] || '0', 10);
        ws[cellAddr].s = {
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                right: { style: 'thin', color: { rgb: 'E2E8F0' } }
            },
            font: rowNum === 1 ? { bold: true, color: { rgb: 'FFFFFF' } } : { color: { rgb: '333333' } },
            fill: { fgColor: { rgb: rowNum === 1 ? 'FF3366' : rowNum % 2 === 0 ? 'FFF0F3' : 'FFFFFF' } }
        };
    }

    ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 28 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Absent Guests');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `absent_guests_${dateStr}.xlsx`);
    showToast(`📋 ${absentGuests.length} absent guest(s) exported!`, 'success');
}

/* ── Delete a single registration record ─────────────── */
async function deleteRegistration(registrationId) {
    const rec = registrations.find(r => r.id === registrationId);
    if (!rec) return;

    const ok = await showConfirmDialog(
        '🗑️ Delete Registration',
        `Remove "${rec.scanData}" from the registration log?`,
        'Yes, Delete'
    );
    if (!ok) return;

    registrations = registrations.filter(r => r.id !== registrationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
    await deleteRegistrationOnServer(registrationId);
    renderTable(false);
    updateStats();
    showToast(`🗑️ "${rec.scanData}" removed`, '');
}

/* ── Walk-In Registration ────────────────────────────── */
let _walkInRawQR = '';

function showWalkInModal(rawQR) {
    _walkInRawQR = rawQR || '';
    document.getElementById('walkin-name').value  = '';
    document.getElementById('walkin-dept').value  = '';
    document.getElementById('walkin-table').value = '';
    document.getElementById('walkin-modal').classList.add('show');
    setTimeout(() => document.getElementById('walkin-name').focus(), 100);
}

function cancelWalkIn() {
    document.getElementById('walkin-modal').classList.remove('show');
    // Resume scanner
    if (!scannerActive && scanner) {
        try {
            scanner.resume();
            scannerActive = true;
            document.getElementById('toggle-btn').textContent = 'Pause';
            setStatus('idle', 'Ready — waiting for QR code…');
        } catch (e) {}
    }
}

function confirmWalkIn() {
    const name  = document.getElementById('walkin-name').value.trim();
    const dept  = document.getElementById('walkin-dept').value.trim();
    const tbl   = document.getElementById('walkin-table').value.trim() || 'Walk-In';

    if (!name) {
        document.getElementById('walkin-name').focus();
        document.getElementById('walkin-name').style.borderColor = 'var(--danger)';
        setTimeout(() => document.getElementById('walkin-name').style.borderColor = '', 1500);
        return;
    }

    const entry = {
        id: Date.now(),
        tableNo: tbl,
        scanData: name,
        guestId: null,
        department: dept,
        jobTitle: 'Walk-In',
        timestamp: new Date().toLocaleString('en-PH', {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        })
    };

    registrations.unshift(entry);
    saveData();
    renderTable(true);
    updateStats();
    playBeep('success');
    document.getElementById('walkin-modal').classList.remove('show');

    // Show success modal (reuse scan modal in non-guest style)
    showScanModal(false, null, name, tbl);
}

/* ── Fullscreen / Presentation Mode ─────────────────── */
function togglePresentationMode() {
    const body = document.body;
    const btn  = document.getElementById('exit-presentation-btn');
    const fbtn = document.getElementById('fullscreen-btn');

    if (body.classList.toggle('presentation-mode')) {
        btn.style.display = 'block';
        if (fbtn) fbtn.innerHTML = '▣ <span class="btn-label">Exit Focus</span>';
        // Try native fullscreen
        document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
        btn.style.display = 'none';
        if (fbtn) fbtn.innerHTML = '⛶ <span class="btn-label">Focus</span>';
        document.exitFullscreen?.().catch(() => {});
    }
}

// Exit presentation if user presses Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('presentation-mode')) {
        togglePresentationMode();
    }
});

/* ── Table Capacity Tracker ──────────────────────────── */
function showTableTracker() {
    if (!guests || guests.length === 0) {
        showToast('⚠️ No guests imported yet.', 'error');
        return;
    }

    // Build table map: { tableNo -> { total, present } }
    const tableMap = {};
    guests.forEach(g => {
        const t = String(g['Table Number'] || 'N/A').replace(/^table\s*/i, '').trim();
        if (!tableMap[t]) tableMap[t] = { total: 0, present: 0 };
        tableMap[t].total++;
        if (registrations.find(r => r.guestId === g.id)) {
            tableMap[t].present++;
        }
    });

    const grid = document.getElementById('table-tracker-grid');
    const sorted = Object.keys(tableMap).sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
    });

    grid.innerHTML = sorted.map(t => {
        const { total, present } = tableMap[t];
        const absent  = total - present;
        const pct     = total ? Math.round((present / total) * 100) : 0;
        const full    = present >= total;
        const color   = full ? '#0dfb9c' : pct >= 60 ? '#f39c12' : 'var(--muted)';
        const barClr  = full ? 'linear-gradient(90deg,#0ba360,#0dfb9c)'
                             : pct >= 60 ? 'linear-gradient(90deg,#f39c12,#f1c40f)'
                             : 'linear-gradient(90deg,#6c63ff,#a78bfa)';
        return `
        <div style="
            background:rgba(255,255,255,0.04);
            border:1px solid rgba(255,255,255,${full ? '0.2' : '0.07'});
            border-radius:14px;padding:14px 16px;
            box-shadow:${full ? '0 0 12px rgba(13,251,156,0.15)' : 'none'};
            transition:transform .15s;cursor:default;
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
            <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:0.06em;margin-bottom:6px;">Table</div>
            <div style="font-size:1.6rem;font-weight:800;font-family:'Outfit',sans-serif;color:${color};line-height:1;margin-bottom:8px;">${escHtml(t)}</div>
            <div style="font-size:0.82rem;font-weight:600;margin-bottom:8px;">${present}/${total} <span style="color:var(--muted);font-weight:400;">filled</span></div>
            <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${barClr};border-radius:3px;transition:width .6s cubic-bezier(.34,1.56,.64,1);"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.7rem;color:var(--muted);">
                <span style="color:#0dfb9c;">✓ ${present}</span>
                <span style="color:var(--danger);">✗ ${absent}</span>
            </div>
        </div>`;
    }).join('');

    document.getElementById('table-tracker-modal').classList.add('show');
}

