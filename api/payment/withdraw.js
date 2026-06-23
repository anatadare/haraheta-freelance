// ============================================================
// POST /api/payment/withdraw
// Proses withdraw QRIS (manual via admin) atau xRocket (USDT otomatis)
// Body: { method: 'qris'|'xrocket', amount: number, telegram_id: number, destination: string }
// ============================================================

const XROCKET_TOKEN        = process.env.XROCKET_TOKEN;
const INTERNAL_KEY         = process.env.INTERNAL_KEY;
const SUPABASE_URL         = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BOT_TOKEN            = process.env.BOT_TOKEN;
const OWNER_TELEGRAM_ID    = process.env.OWNER_TELEGRAM_ID; // set ke telegram ID @harahetaowner

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const MIN_WITHDRAW = 50000;  // minimum withdraw Rp50.000

async function dbGet(table, query = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    return res.json();
}

async function dbPatch(table, query, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

async function dbPost(table, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(data)
    });
}

async function sendTelegram(chatId, text) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (req.headers['x-internal-key'] !== INTERNAL_KEY) return res.status(401).json({ error: 'Unauthorized' });

    const { method, amount, telegram_id, destination } = req.body;

    if (!method || !amount || !telegram_id || !destination) {
        return res.status(400).json({ error: 'method, amount, telegram_id, destination wajib diisi' });
    }
    if (amount < MIN_WITHDRAW) {
        return res.status(400).json({ error: `Minimal withdraw Rp${MIN_WITHDRAW.toLocaleString('id-ID')}` });
    }

    try {
        // Ambil user dan cek saldo
        const users = await dbGet('users', `?telegram_id=eq.${telegram_id}&limit=1`);
        const user = users[0];
        if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
        if (user.balance_idr < amount) {
            return res.status(400).json({ error: 'Saldo tidak cukup' });
        }

        // ── Withdraw QRIS (manual via admin notif) ───────────────
        if (method === 'qris') {
            // Potong saldo dulu (lock)
            await dbPatch('users', `?id=eq.${user.id}`, { balance_idr: user.balance_idr - amount });
            await dbPost('transactions', {
                user_id: user.id, type: 'withdraw', amount: -amount, method: 'qris',
                note: `Withdraw QRIS ke: ${destination}`
            });

            // Notif ke owner untuk proses manual
            await sendTelegram(OWNER_TELEGRAM_ID,
                `💸 <b>REQUEST WITHDRAW QRIS</b>\n\n` +
                `👤 User: @${user.username || 'unknown'} (ID: ${telegram_id})\n` +
                `💰 Nominal: <b>Rp ${amount.toLocaleString('id-ID')}</b>\n` +
                `🏦 Tujuan: <code>${destination}</code>\n\n` +
                `Segera proses transfer manual ke nomor di atas.`
            );

            // Notif ke user
            await sendTelegram(telegram_id,
                `✅ <b>Request Withdraw Diterima</b>\n\n` +
                `💰 Nominal: <b>Rp ${amount.toLocaleString('id-ID')}</b>\n` +
                `🏦 Tujuan: ${destination}\n\n` +
                `Tim Haraheta akan memproses transfer dalam 1x24 jam. Cek notifikasi Telegram kamu.`
            );

            return res.status(200).json({ ok: true, method: 'qris', message: 'Request withdraw diterima, akan diproses dalam 1x24 jam' });
        }

        // ── Withdraw xRocket (otomatis kirim USDT) ───────────────
        if (method === 'xrocket') {
            const usdtAmount = (amount / 16300).toFixed(2);

            // Transfer via xRocket API
            const xrocketRes = await fetch('https://pay.xrocket.tg/tg-invoices/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Rocket-Pay-Key': XROCKET_TOKEN },
                body: JSON.stringify({
                    tgUserId:    telegram_id,
                    currency:    'USDT',
                    amount:      usdtAmount,
                    toAddress:   destination,
                    description: `Withdraw Haraheta Freelance`
                })
            });
            const xrocketData = await xrocketRes.json();

            if (!xrocketData.success) {
                console.error('xRocket withdraw error:', xrocketData);
                return res.status(500).json({ error: 'Gagal proses withdraw xRocket', detail: xrocketData });
            }

            // Potong saldo
            await dbPatch('users', `?id=eq.${user.id}`, { balance_idr: user.balance_idr - amount });
            await dbPost('transactions', {
                user_id: user.id, type: 'withdraw', amount: -amount, method: 'xrocket',
                note: `Withdraw ${usdtAmount} USDT ke: ${destination}`
            });

            // Notif ke user
            await sendTelegram(telegram_id,
                `✅ <b>Withdraw Berhasil!</b>\n\n` +
                `💰 <b>${usdtAmount} USDT</b> (≈ Rp ${amount.toLocaleString('id-ID')}) sudah dikirim\n` +
                `🚀 Ke wallet: <code>${destination}</code>\n\n` +
                `Cek wallet xRocket kamu.`
            );

            return res.status(200).json({ ok: true, method: 'xrocket', usdt_amount: usdtAmount });
        }

        return res.status(400).json({ error: `Method tidak dikenal: ${method}` });

    } catch (err) {
        console.error('payment/withdraw error:', err);
        return res.status(500).json({ error: err.message });
    }
}
