const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

// ── Load Environment Variables ─────────────────────────────
try {
    require('dotenv').config();
} catch (e) { }

const app = express();
const PORT = process.env.PORT || 3000;

// ── Supabase Client Initialization ─────────────────────────
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=*, microphone=*');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

app.use(express.static(path.join(__dirname)));

// ── Root Route (Fixes "Cannot GET /") ────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Endpoints ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, 'display.html'));
});

// GUESTS 
app.get('/api/guests', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .order('name');

        if (error) throw error;

        const guests = data.map(r => ({
            id: r.id,
            Name: r.name,
            Department: r.department,
            'Job Title': r.job_title,
            'Table Number': r.table_number,
            Email: r.gmail || ''
        }));
        res.json(guests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/guests', async (req, res) => {
    const guests = req.body;
    if (!Array.isArray(guests)) return res.status(400).json({ error: 'Expected array' });
    try {
        // Step 1: Clear existing guests
        await supabase.from('guests').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        // Step 2: Insert new ones
        if (guests.length > 0) {
            const values = guests.map(g => ({
                id: g.id,
                name: g.Name || '',
                department: g.Department || '',
                job_title: g['Job Title'] || '',
                table_number: String(g['Table Number'] || ''),
                gmail: g.Email || g.gmail || ''
            }));
            const { error } = await supabase.from('guests').insert(values);
            if (error) throw error;
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REGISTRATIONS
app.get('/api/registrations', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const regs = data.map(r => ({
            id: r.scan_id || String(r.id),
            tableNo: r.table_no,
            scanData: r.scan_data,
            guestId: r.guest_id,
            department: r.department,
            timestamp: r.timestamp
        }));
        res.json(regs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/registrations', async (req, res) => {
    const r = req.body;
    try {
        // If it's a known guest (has guestId), check for existing registration first
        if (r.guestId) {
            const { data: existing } = await supabase
                .from('registrations')
                .select('id')
                .eq('guest_id', r.guestId);

            if (existing && existing.length > 0) {
                return res.status(409).json({ error: 'Guest already registered' });
            }
        }

        const { error } = await supabase.from('registrations').insert([
            {
                scan_id: String(r.id || Date.now()),
                guest_id: r.guestId || null,
                scan_data: r.scanData,
                department: r.department || '',
                table_no: String(r.tableNo || ''),
                timestamp: r.timestamp || new Date().toLocaleString()
            }
        ]);
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/registrations', async (req, res) => {
    try {
        // Must use scan_id because the column "id" might not exist or be typed differently
        const { error } = await supabase.from('registrations').delete().neq('scan_id', '0');
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/registrations/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('registrations').delete().eq('scan_id', req.params.id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════
//  EMAIL (BREVO)
// ════════════════════════════════════════════════════════════
app.post('/api/send-email', async (req, res) => {
    const { toEmail, toName, toJob, toDept, qrData } = req.body;

    const BREVO_API_KEY = process.env.BREVO_API_KEY || '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';
    const SENDER_EMAIL = 'sluannouncement19@gmail.com';
    const SENDER_NAME = 'SLU J&T Event Registration';

    const qrPublicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
    let qrBase64 = '';
    try {
        const imgRes = await fetch(qrPublicUrl);
        const imgArrayBuffer = await imgRes.arrayBuffer();
        qrBase64 = Buffer.from(imgArrayBuffer).toString('base64');
    } catch (err) {
        return res.status(500).json({ error: 'Failed to generate QR attachment.' });
    }

    const payload = {
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: toEmail, name: toName || 'Guest' }],
        subject: 'Your Event Invitation & QR Code',
        htmlContent: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #6c63ff; text-align: center;">Event Invitation & QR Code</h2>
                <p>Hello Mr/Ms. <b>${toName || 'Guest'}</b>,</p>
                <p>You are cordially invited to an evening of celebration and recognition as we commemorate seven years of excellence and success.</p>
                
                </br> 

                <h2 style="color: #6c63ff; text-align: left;">Event Details</h2>
                <p><b>Date:</b> March 28, 2026 (Saturday)</p>
                <p><b>Registration Opens:</b> 3:30 PM</p>
                <p><b>Venue:</b> Enchanting Events Place</p>
                <p>Enchanted Kingdom, Santa Rosa City, Laguna</p>
                
                </br> 

                <h2 style="color: #6c63ff; text-align: center;">Attire Guidlines:</h2>
                <p style="text-align: center"> <b> Formal Attire - Hollywood Themed</b></p>
                </br>
                <p style="text-align: center"> Please choose outfits in any shade of the following colors:</p>
                <p style="text-align: center"> <b> Black, Red, Blue, Gold, Silver, Brown, or White.</b></p>
                
                <div style="margin: 30px auto; padding: 25px; border: 2px dashed #ccc; border-radius: 12px; text-align: center; max-width: 350px; background-color: #fafafa;">
                <img src="${qrPublicUrl}" alt="QR Code" style="width: 250px; height: 250px; display: block; margin: 0 auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
                <h3 style="margin: 20px 0 5px 0; font-size: 24px; color: #222;">${toName || ''}</h3>
                <p style="margin: 0; font-size: 16px; color: #555; font-weight: 600;">${toJob || ''}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #888;">${toDept || ''}</p>
                </div>
                
                <p style="text-align: center">Present this QR Code upon entry. Please keep it private and do not share it.</p>

                <p style="text-align: center;">For any questions, please contact:</p>
                <p style="text-align: center;">Catherine B. Gural</p>
                <p style="text-align: center;">cbgural@jtexpress.ph</p>
                <p style="text-align: center;">0920-979-8178</p>
           
            </div>
        `,
        attachment: [{
            content: qrBase64,
            name: "qrcode.png",
            contentType: "image/png"
        }]
    };

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) return res.status(500).json({ error: data.message });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});

// Export for Vercel
module.exports = app;

