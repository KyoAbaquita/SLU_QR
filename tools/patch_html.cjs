const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<div class="flex-between" style="margin-bottom: 20px;">\s*<div>[\s\S]*?<\/div>\s*<\/div>/;

const newHTML = `
                <div class="flex-between" style="margin-bottom: 20px;">
                    <div>
                        <p style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">
                            Import Excel with <b>Name, Department, Job Title, Table Number</b> columns.
                        </p>
                        <input type="file" id="guest-file" accept=".xlsx, .xls, .csv" style="display:none;"
                            onchange="handleGuestUpload(event)">
                        <button class="btn btn-ghost" onclick="document.getElementById('guest-file').click()">
                            📁 Import Excel
                        </button>
                        <button class="btn btn-success" onclick="exportGuestsToExcel()" style="margin-left:8px;">
                            📥 Export Guests
                        </button>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="generateQRCodes()">
                            🔲 Generate QRs
                        </button>
                        <button class="btn btn-danger" onclick="clearGuests()" style="margin-left:8px;">
                            🗑️ Clear
                        </button>
                    </div>
                </div>

                <div class="flex-between" style="margin-bottom: 20px;">
                    <div style="display:flex;gap:10px;flex:1;">
                        <input type="text" id="guest-search" placeholder="Search by name..." oninput="renderGuestTable()"
                            style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px 12px;font-family:'Inter',sans-serif;font-size:0.85rem;outline:none;" />
                        <select id="guest-dept-filter" onchange="renderGuestTable()"
                            style="min-width:150px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px 12px;font-family:'Inter',sans-serif;font-size:0.85rem;outline:none;">
                            <option value="">All Departments</option>
                        </select>
                    </div>
                </div>
`.trim();

html = html.replace(regex, newHTML);
fs.writeFileSync('index.html', html);
console.log('index.html patched with new UI.');
