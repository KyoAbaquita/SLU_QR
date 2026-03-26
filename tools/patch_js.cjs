const fs = require('fs');

let js = fs.readFileSync('guests.js', 'utf8');

js = js.replace('renderGuestTable();\n                e.target.value', 'renderGuestTable();\n                updateDeptFilter();\n                e.target.value');
js = js.replace('saveGuests();\n            renderGuestTable();', 'saveGuests();\n            renderGuestTable();\n            updateDeptFilter();');

const newRender = `function renderGuestTable() {
    const tbody = document.getElementById('guest-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const searchVal = (document.getElementById('guest-search')?.value || '').toLowerCase();
    const deptVal = document.getElementById('guest-dept-filter')?.value || '';

    const filteredGuests = guests.filter(g => {
        const matchName = g.Name.toLowerCase().includes(searchVal);
        const matchDept = deptVal === '' || g.Department === deptVal;
        return matchName && matchDept;
    });

    if (filteredGuests.length === 0) {
        tbody.innerHTML = \`<tr id="guest-empty-row"><td colspan="4" style="text-align:center;color:var(--muted);padding:30px;">No guests match your filters.</td></tr>\`;
        return;
    }
    filteredGuests.forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
            <td style="font-weight:600;">\${escHtml(g.Name)}</td>
            <td style="color:var(--muted);">\${escHtml(g.Department)}</td>
            <td style="font-size:0.8rem;">\${escHtml(g['Job Title'])}</td>
            <td><span class="table-no-badge" style="padding:2px 8px;font-size:0.75rem;">\${escHtml(g['Table Number'] || 'N/A')}</span></td>
        \`;
        tbody.appendChild(tr);
    });
}`;

const oldRenderRegex = /function renderGuestTable\(\) \{[\s\S]*?(?=\s*function generateQRCodes)/;
js = js.replace(oldRenderRegex, newRender + '\n\n');

const additionalFunctions = `
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

function exportGuestsToExcel() {
    if (!guests || guests.length === 0) {
        showToast('⚠️ No guests to export', 'error');
        return;
    }

    const searchVal = (document.getElementById('guest-search')?.value || '').toLowerCase();
    const deptVal = document.getElementById('guest-dept-filter')?.value || '';

    const filteredGuests = guests.filter(g => {
        const matchName = g.Name.toLowerCase().includes(searchVal);
        const matchDept = deptVal === '' || g.Department === deptVal;
        return matchName && matchDept;
    });

    if (filteredGuests.length === 0) {
        showToast('⚠️ No guests match criteria to export', 'error');
        return;
    }

    const rows = filteredGuests.map(g => ({
        'Name': g.Name,
        'Department': g.Department || '',
        'Job Title': g['Job Title'] || '',
        'Table Number': g['Table Number'] || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Guest List');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, \`Guest_List_\${dateStr}.xlsx\`);
    showToast('📥 Guest Excel file downloaded!', 'success');
}
`;
js += additionalFunctions;
fs.writeFileSync('guests.js', js);

let storageJs = fs.readFileSync('storage.js', 'utf8');
storageJs = storageJs.replace('renderGuestTable();', 'renderGuestTable();\n    if(typeof updateDeptFilter === "function") updateDeptFilter();');
fs.writeFileSync('storage.js', storageJs);

console.log('patched');
