// ============================================================
// POST /api/auth/verify
// Verifikasi initData dari Telegram WebApp
// Mencegah manipulasi data user di client
// Body: { initData: string }
// ============================================================

import crypto from 'crypto';

const BOT_TOKEN  = process.env.BOT_TOKEN;
const SUPABASE_URL         = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { initData } = req.body;
    if (!initData) return res.status(400).json({ error: 'initData wajib diisi' });

    try {
        // Parse initData
        const params   = new URLSearchParams(initData);
        const hash     = params.get('hash');
        if (!hash) return res.status(400).json({ error: 'hash tidak ditemukan' });

        // Buat data-check-string (semua param kecuali hash, sorted, join \n)
        params.delete('hash');
        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        // HMAC-SHA256 dengan secret key = HMAC-SHA256("WebAppData", BOT_TOKEN)
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (expectedHash !== hash) {
            return res.status(401).json({ error: 'initData tidak valid — kemungkinan data dimanipulasi' });
        }

        // Parse user dari initData
        const userStr = params.get('user');
        if (!userStr) return res.status(400).json({ error: 'Data user tidak ditemukan di initData' });
        const tgUser = JSON.parse(userStr);

        // Upsert user ke Supabase
        const existing = await fetch(`${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${tgUser.id}&limit=1`, {
            headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
        }).then(r => r.json());

        let user;
        if (existing.length > 0) {
            // Update username/nama kalau berubah
            await fetch(`${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${tgUser.id}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username:  tgUser.username || null,
                    full_name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim()
                })
            });
            user = { ...existing[0], username: tgUser.username, full_name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() };
        } else {
            // User baru — insert
            const created = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    telegram_id:  tgUser.id,
                    username:     tgUser.username || null,
                    full_name:    `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
                    balance_idr:  0,
                    anti_dup_active: false
                })
            }).then(r => r.json());
            user = created[0];
        }

        // Return data user yang sudah terverifikasi
        return res.status(200).json({ ok: true, user });

    } catch (err) {
        console.error('auth/verify error:', err);
        return res.status(500).json({ error: err.message });
    }
}
