function openGuestModal() {
    renderGuestTable();
    document.getElementById('guest-modal').classList.add('show');
}
function closeGuestModal() {
    document.getElementById('guest-modal').classList.remove('show');
}

function handleGuestUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);

        if (rows.length === 0) {
            showToast('Excel file is empty or formatted incorrectly.', 'error');
            return;
        }

        // Auto-adjust: Find headers by keywords, or default to their position (Col 1, Col 2...)
        const originalKeys = Object.keys(rows[0]);

        const colName = originalKeys.find(k => k.toLowerCase().includes('name')) || originalKeys[0];
        const colDept = originalKeys.find(k => k.toLowerCase().includes('dept') || k.toLowerCase().includes('department') || k.toLowerCase().includes('org') || k.toLowerCase().includes('company')) || originalKeys[1] || 'Department';
        const colJob = originalKeys.find(k => k.toLowerCase().includes('job') || k.toLowerCase().includes('title') || k.toLowerCase().includes('position') || k.toLowerCase().includes('role')) || originalKeys[2] || 'Job Title';
        const colTable = originalKeys.find(k => k.toLowerCase().includes('table') || k.toLowerCase().includes('seat') || k.toLowerCase().includes('no')) || originalKeys[3] || 'Table Number';
        const colEmail = originalKeys.find(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('gmail') || k.toLowerCase().includes('mail')) || 'Email';

        let added = 0;
        rows.forEach((r, idx) => {
            const name = r[colName];
            if (!name) return; // Skip empty rows

            // Generate a numeric ID based on Name, Dept, Job, and Table to ensure unique people are uniquely counted.
            const rawString = String(name).trim().toLowerCase() + "|" +
                (r[colDept] ? String(r[colDept]).trim().toLowerCase() : "") + "|" +
                (r[colJob] ? String(r[colJob]).trim().toLowerCase() : "") + "|" +
                String(idx);
            let hash = 2166136261;
            for (let i = 0; i < rawString.length; i++) {
                hash ^= rawString.charCodeAt(i);
                hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            }
            const numericId = (hash >>> 0).toString();

            const newGuest = {
                id: numericId,
                Name: String(name),
                Department: r[colDept] ? String(r[colDept]) : '',
                'Job Title': r[colJob] ? String(r[colJob]) : '',
                'Table Number': r[colTable] ? String(r[colTable]).replace(/^table\s*/i, '').trim() : '',
                Email: r[colEmail] ? String(r[colEmail]) : ''
            };

            const existingIdx = guests.findIndex(g => g.id === numericId);
            if (existingIdx !== -1) {
                // Update existing guest
                guests[existingIdx] = newGuest;
            } else {
                guests.push(newGuest);
                added++;
            }
        });

        saveGuests();
        renderGuestTable();
        updateDeptFilter();
        e.target.value = ''; // reset file input

        if (added > 0) {
            showToast(`✅ Imported ${added} guests successfully`, 'success');
        } else {
            showToast(`⚠️ No valid rows found. Check your 'Name' column.`, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

async function clearGuests() {
    if (!guests.length) return;
    const ok = await showConfirmDialog(
        '🗑️ Clear Guest List',
        'This will remove all imported guests. This cannot be undone.',
        'Yes, Clear Guests'
    );
    if (!ok) return;
    guests = [];
    saveGuests();
    updateDeptFilter();
    renderGuestTable();
    showToast('🗑️ Guests cleared', '');
}


function renderGuestTable() {
    const tbody = document.getElementById('guest-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const badge = document.getElementById('guest-count-badge');
    if (badge) {
        badge.textContent = guests.length > 0 ? `${guests.length} loaded` : '';
        badge.style.display = guests.length > 0 ? 'inline-block' : 'none';
    }

    const searchVal = (document.getElementById('guest-search')?.value || '').toLowerCase();
    const deptVal = document.getElementById('guest-dept-filter')?.value || '';

    const filteredGuests = guests.filter(g => {
        const matchName = g.Name.toLowerCase().includes(searchVal);
        const matchDept = deptVal === '' || g.Department === deptVal;
        return matchName && matchDept;
    });

    if (filteredGuests.length === 0) {
        tbody.innerHTML = `<tr id="guest-empty-row"><td colspan="6" style="text-align:center;color:var(--muted);padding:30px;">No guests match your filters.</td></tr>`;
        return;
    }
    filteredGuests.forEach(g => {
        const isPresent = !!registrations.find(r => r.guestId === g.id);
        const tr = document.createElement('tr');

        const emailStr = (g.Email || '').trim();
        let emailBadge = '';
        if (g.emailSent) {
            emailBadge = '<span style="display:inline-block;background:rgba(13,251,156,0.15);color:#0dfb9c;font-size:0.65rem;padding:3px 6px;border-radius:4px;font-weight:800;">SENT</span>';
        } else if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
            emailBadge = '<span style="display:inline-block;background:rgba(255,51,102,0.15);color:#ff3366;font-size:0.65rem;padding:3px 6px;border-radius:4px;font-weight:800;">INVALID FORMAT</span>';
        }

        tr.innerHTML = `
            <td style="font-weight:600;">${escHtml(g.Name)}</td>
            <td style="color:var(--muted);">${escHtml(g.Department)}</td>
            <td style="font-size:0.8rem;">${escHtml(g['Job Title'])}</td>
            <td><span class="table-no-badge" style="padding:2px 8px;font-size:0.75rem;">${escHtml(String(g['Table Number'] || 'N/A').replace(/^table\s*/i, '').trim())}</span></td>
            <td style="font-size:0.8rem;">
                <div style="white-space:nowrap;margin-bottom:${emailBadge ? '4px' : '0'};">${escHtml(emailStr)}</div>
                ${emailBadge}
            </td>
            <td style="text-align:center;">
                ${isPresent
                ? `<span class="checkin-present-badge">✓ Present</span>`
                : `<button class="checkin-btn" onclick="manualCheckIn('${escHtml(g.id)}')">✚ Check In</button>`
            }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/* ── Manual Check-In ─────────────────────────────────── */
function manualCheckIn(guestId) {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;

    // Prevent double check-in
    if (registrations.find(r => r.guestId === guest.id)) {
        playBeep('error');
        showToast(`${guest.Name} is already checked in.`, 'error');
        return;
    }

    const tNo = guest['Table Number'] || guest['Table'] || 'N/A';
    const entry = {
        id: Date.now(),
        tableNo: tNo,
        scanData: guest.Name,
        guestId: guest.id,
        department: guest.Department || '',
        jobTitle: guest['Job Title'] || '',
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
    renderGuestTable(); // refresh button → badge

    // Show the same success modal as a QR scan
    closeGuestModal();
    showScanModal(true, guest, guest.Name, tNo);
}

/* ── Feature 3: Print a single guest's QR card ────────── */
function printSingleQR(guestId, name, jobTitle, tableNo) {
    const uid = 'sqr' + Math.random().toString(36).substr(2, 8);
    const popup = window.open('', '_blank', 'width=400,height=500');
    if (!popup) { showToast('❌ Popup blocked! Allow popups for this site.', 'error'); return; }

    popup.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>QR Card - ${name}</title>
<script src="vendor/js/qrcode.min.js"><\/script>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: Arial, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f5f5f5; }
  .card { background:#fff; border:1px solid #ddd; border-radius:16px; padding:32px 28px; text-align:center; box-shadow:0 4px 20px rgba(0,0,0,0.1); width:300px; }
  .event-label { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#888; margin-bottom:16px; }
  .qr-wrap { background:#f9f9f9; border-radius:10px; padding:12px; display:inline-block; margin-bottom:16px; }
  .qr-wrap canvas, .qr-wrap img { display:block; width:160px!important; height:160px!important; }
  .guest-name { font-size:15px; font-weight:800; color:#111; margin-bottom:4px; }
  .guest-job  { font-size:11px; color:#777; margin-bottom:8px; }
  .table-badge { display:inline-block; background:#6c63ff; color:#fff; font-size:11px; font-weight:700; padding:4px 14px; border-radius:999px; }
  @media print { body { background:#fff; } }
<\/style>
</head><body>
<div class="card">
  <div class="event-label">Guest QR Code</div>
  <div class="qr-wrap" id="${uid}"></div>
  <div class="guest-name">${name}</div>
  <div class="guest-job">${jobTitle}</div>
  <div class="table-badge">${String(tableNo).toLowerCase().startsWith('table') ? tableNo : `Table ${tableNo}`}</div>
</div>
<script>
window.onload = function() {
  new QRCode(document.getElementById('${uid}'), {
    text: '${guestId}', width:160, height:160,
    colorDark:'#000000', colorLight:'#ffffff',
    correctLevel: QRCode.CorrectLevel.L
  });
  setTimeout(function() {
    // convert canvas to img for reliable printing
    var c = document.querySelector('#${uid} canvas');
    if (c) { var img=document.createElement('img'); img.src=c.toDataURL('image/png'); img.style.width='160px'; img.style.height='160px'; c.parentNode.replaceChild(img,c); }
    window.print();
  }, 350);
};
<\/script>
</body></html>`);
    popup.document.close();
}



function generateQRCodes() {
    if (!guests.length) {
        showToast('❌ No guests available. Please import an Excel file first.', 'error');
        return;
    }

    showToast('Generating QRs...', 'success');

    // Build the HTML for the new window
    let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Guest QR Codes</title>
                <link rel="stylesheet" href="vendor/fonts/fonts.css">
                <!-- QRCode.js for generating inside new window -->
                <script src="vendor/js/qrcode.min.js"><\/script>
                <style>
                    body { font-family: 'Inter', sans-serif; background: #f0f2f5; margin: 0; padding: 20px; color: #111; }
                    .header-actions { position: fixed; top: 0; left: 0; width: 100%; background: #fff; padding: 15px 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 100; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; }
                    .header-actions button { background: #6c63ff; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
                    .header-actions button:hover { background: #5a52d5; }
                    .main-content { margin-top: 70px; }
                    .dept-section { margin-bottom: 40px; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                    .dept-title { font-size: 24px; font-weight: 700; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #eee; color: #333; }
                    .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
                    .qr-card { border: 1px solid #ddd; border-radius: 10px; padding: 20px; display: flex; flex-direction: column; align-items: center; background: #fafafa; text-align: center; }
                    .qr-name { font-weight: 700; font-size: 16px; margin-top: 15px; color: #222; }
                    .qr-job { font-size: 13px; color: #666; margin-top: 5px; }
                    .qr-code { width: 150px; height: 150px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; flex-shrink: 0; line-height: 0; }
                    .qr-code canvas, .qr-code img { width: 150px !important; height: 150px !important; display: block; max-width: 150px; max-height: 150px; }
                    @media print {
                        body { background: #fff; padding: 8mm; }
                        .header-actions { display: none !important; }
                        .main-content { margin-top: 0 !important; }
                        .dept-section { box-shadow: none; padding: 0; margin-bottom: 12mm; page-break-after: always; break-after: page; }
                        .dept-section:last-child { page-break-after: avoid; break-after: avoid; }
                        .qr-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 5mm; }
                        .qr-card { break-inside: avoid; border: 1px solid #ccc !important; box-shadow: none; padding: 8px; }
                        .qr-name { font-size: 10px !important; }
                        .qr-job { font-size: 9px !important; }
                    }
                </style>
            </head>
            <body>
                                <div class="header-actions" style="flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <h2 style="margin:0; font-size: 1.2rem;">Generated QR Codes</h2>
                        <input type="text" id="qr-search" placeholder="Search name..." onkeyup="filterQRs()" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; outline: none; font-family: inherit; font-size: 14px; width: 200px;" />
                        <select id="qr-dept" onchange="filterQRs()" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; outline: none; font-family: inherit; font-size: 14px;">
                            <option value="">All Departments</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="saveAsPDF()" style="background: #22d3a5;">📄 Save as PDF</button>
                        <button onclick="window.print()">🖨️ Print QRs</button>
                    </div>
                </div>
                <script>
                    function filterQRs() {
                        const searchVal = document.getElementById('qr-search').value.toLowerCase();
                        const deptVal = document.getElementById('qr-dept').value;
                        
                        const cards = document.querySelectorAll('.qr-card');
                        let visibleCount = 0;
                        
                        cards.forEach(card => {
                            const name = card.querySelector('.qr-name').textContent.toLowerCase();
                            const dept = card.getAttribute('data-dept');
                            
                            const matchName = name.includes(searchVal);
                            const matchDept = deptVal === '' || dept === deptVal;
                            
                            if (matchName && matchDept) {
                                card.style.display = 'flex';
                                visibleCount++;
                            } else {
                                card.style.display = 'none';
                            }
                        });
                        
                        // Hide empty department sections
                        const sections = document.querySelectorAll('.dept-section');
                        sections.forEach(sec => {
                            const anyVisible = Array.from(sec.querySelectorAll('.qr-card')).some(c => c.style.display !== 'none');
                            sec.style.display = anyVisible ? 'block' : 'none';
                        });
                    }
                    
                    window.addEventListener('DOMContentLoaded', () => {
                        const depts = new Set();
                        document.querySelectorAll('.qr-card').forEach(c => {
                            const d = c.getAttribute('data-dept');
                            if (d) depts.add(d);
                        });
                        const select = document.getElementById('qr-dept');
                        Array.from(depts).sort().forEach(d => {
                            const opt = document.createElement('option');
                            opt.value = d;
                            opt.textContent = d;
                            select.appendChild(opt);
                        });
                    });

                    function saveAsPDF() {
                        // Step 1: Convert all QR canvas elements to <img> so browsers
                        // can render them in print/PDF (canvas content doesn't print reliably).
                        document.querySelectorAll('.qr-code canvas').forEach(function(canvas) {
                            var img = document.createElement('img');
                            img.src = canvas.toDataURL('image/png');
                            img.width = canvas.width;
                            img.height = canvas.height;
                            img.style.display = 'block';
                            canvas.parentNode.replaceChild(img, canvas);
                        });
                        // Step 2: Short delay, then open browser's native Print / Save as PDF dialog.
                        setTimeout(function() { window.print(); }, 200);
                    }
                </script>
                <div class="main-content">
            `;

    // Group by department
    const byDept = {};
    guests.forEach(g => {
        const d = g.Department || 'No Department';
        if (!byDept[d]) byDept[d] = [];
        byDept[d].push(g);
    });

    // Script to run in the new window to actually draw the QRs
    let scriptContent = '<script>\nwindow.onload = function() {\n';

    for (const dept in byDept) {
        htmlContent += `<div class="dept-section">`;
        htmlContent += `<div class="dept-title">${escHtml(dept)}</div>`;
        htmlContent += `<div class="qr-grid">`;

        byDept[dept].forEach((g, index) => {
            const uniqueId = `qr-${Math.random().toString(36).substr(2, 9)}`;
            htmlContent += `
                        <div class="qr-card" data-dept="${escHtml(dept)}">
                            <div class="qr-code" id="${uniqueId}"></div>
                            <div class="qr-name">${escHtml(g.Name)}</div>
                            <div class="qr-job">${escHtml(g['Job Title'])}</div>
                        </div>
                    `;
            // Queue the JS to generate this specific QR code
            scriptContent += `
                        new QRCode(document.getElementById('${uniqueId}'), {
                            text: "${g.id}",
                            width: 150,
                            height: 150,
                            colorDark : "#000000",
                            colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.L
                        });
                    `;
        });

        htmlContent += `</div></div>`;
    }

    scriptContent += '};\n<\/script>';
    htmlContent += `</div>${scriptContent}</body></html>`;

    // Open in new window
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
    } else {
        showToast('❌ Popup blocked! Please allow popups for this site.', 'error');
    }
}

async function sendQREmails() {
    if (!guests || guests.length === 0) {
        showToast('❌ No guests available.', 'error');
        return;
    }

    const searchVal = (document.getElementById('guest-search')?.value || '').toLowerCase();
    const deptVal = document.getElementById('guest-dept-filter')?.value || '';

    const filteredGuests = guests.filter(g => {
        const matchName = g.Name.toLowerCase().includes(searchVal);
        const matchDept = deptVal === '' || g.Department === deptVal;
        return matchName && matchDept;
    });

    const guestsWithEmail = filteredGuests.filter(g => g.Email && g.Email.trim() !== '');

    if (guestsWithEmail.length === 0) {
        showToast('⚠️ No guests in the current list have an Email address.', 'error');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = guestsWithEmail.filter(g => !emailRegex.test(g.Email.trim()));
    if (invalidEmails.length > 0) {
        const names = invalidEmails.map(g => g.Name).slice(0, 3).join(', ');
        const more = invalidEmails.length > 3 ? ` and ${invalidEmails.length - 3} more` : '';
        alert(`Error: Invalid email format found for: ${names}${more}.\\n\\nPlease check your Excel file and re-import.`);
        showToast(`⚠️ Invalid email format blocked sending.`, 'error');
        return;
    }

    if (!confirm(`Are you sure you want to send emails to ${guestsWithEmail.length} guests?`)) {
        return;
    }

    let successCount = 0;
    let failCount = 0;

    showToast(`Sending ${guestsWithEmail.length} emails, please wait...`, '');

    // Send emails sequentially to avoid spamming the backend / API limits
    for (const g of guestsWithEmail) {
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail: g.Email.trim(),
                    toName: g.Name,
                    toJob: g['Job Title'] || '',
                    toDept: g.Department || '',
                    qrData: String(g.id)
                })
            });

            if (response.ok) {
                successCount++;
                g.emailSent = true;
                if (typeof saveGuests === 'function') saveGuests();
                renderGuestTable();
            } else {
                failCount++;
                try {
                    const errData = await response.json();
                    console.error(`Error sending to ${g.Email}:`, errData);
                    showToast(`Error: ${errData.error || response.statusText}`, 'error');
                } catch (e) {
                    console.error(`Status ${response.status} sending to ${g.Email}`);
                }
            }
        } catch (err) {
            console.error('Email send failed for ' + g.Email, err);
            failCount++;
            showToast(`Connection failed. Server running?`, 'error');
        }
    }

    if (failCount === 0) {
        showToast(`✅ Successfully sent ${successCount} emails.`, 'success');
    } else {
        showToast(`⚠️ Sent ${successCount} emails, but ${failCount} failed.`, 'error');
    }
}

function updateDeptFilter() {
    const select = document.getElementById('guest-dept-filter');
    if (!select) return;
    const currentVal = select.value;

    const depts = new Set();
    guests.forEach(g => {
        if (g.Department && g.Department.trim() !== '') {
            depts.add(g.Department.trim());
        }
    });

    const sortedDepts = Array.from(depts).sort();

    select.innerHTML = '<option value="">All Departments</option>';
    sortedDepts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        select.appendChild(opt);
    });

    if (sortedDepts.includes(currentVal)) {
        select.value = currentVal;
    }
}

