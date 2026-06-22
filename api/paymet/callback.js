// ============================================================
// POST /api/payment/callback
// Terima notifikasi dari bayar.gg & xRocket
// Verifikasi signature → update saldo Supabase → notif Telegram
// ============================================================

const BAYARGG_WEBHOOK_SECRET = process.env.BAYARGG_WEBHOOK_SECRET; // dari bayar.gg → Developer → Webhook & Callback
const XROCKET_TOKEN          = process.env.XROCKET_TOKEN;
const SUPABASE_URL           = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const BOT_TOKEN              = process.env.BOT_TOKEN;

import crypto from 'crypto';

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Supabase helpers ─────────────────────────────────────────
async function dbGet(table, query = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    return res.json();
}

async function dbPatch(table, query, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
}

async function dbPost(table, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data)
    });
}

// ── Tambah saldo user & catat transaksi ──────────────────────
async function addBalance(telegramId, amount, method, note) {
    const users = await dbGet('users', `?telegram_id=eq.${telegramId}&limit=1`);
    const user = users[0];
    if (!user) throw new Error(`User tidak ditemukan: telegram_id=${telegramId}`);

    await dbPatch('users', `?telegram_id=eq.${telegramId}`, {
        balance_idr: user.balance_idr + amount
    });

    await dbPost('transactions', {
        user_id: user.id,
        type:    'deposit',
        amount,
        method,
        note
    });

    return user;
}

// ── Notif Telegram ───────────────────────────────────────────
async function sendTelegramMessage(chatId, text) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
}

// ── Main handler ─────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const body      = req.body;
    const timestamp = req.headers['x-webhook-timestamp'] || '';
    const signature = req.headers['x-webhook-signature'] || '';

    try {
        // ── Callback dari bayar.gg ───────────────────────────────
        // Payload: { event, invoice_id, status, final_amount, description, ... }
        if (body.event === 'payment.paid') {

            // Verifikasi signature bayar.gg
            // Format: HMAC SHA256 dari "{invoice_id}|{status}|{final_amount}|{timestamp}"
            const sigData      = `${body.invoice_id}|${body.status}|${body.final_amount}|${timestamp}`;
            const expectedSig  = crypto.createHmac('sha256', BAYARGG_WEBHOOK_SECRET)
                .update(sigData)
                .digest('hex');

            if (expectedSig !== signature) {
                console.error('bayar.gg webhook signature mismatch');
                return res.status(200).send('INVALID SIGNATURE');
            }

            if (body.status !== 'paid') {
                return res.status(200).send('OK');
            }

            // Ambil telegram_id dari description / customer_name
            // Format customer_name saat create: "User {telegram_id}"
            const telegramIdMatch = (body.customer_name || '').match(/User (\d+)/);
            if (!telegramIdMatch) {
                console.error('Tidak bisa parse telegram_id dari:', body.customer_name);
                return res.status(200).send('OK');
            }
            const telegramId = parseInt(telegramIdMatch[1]);
            const amount     = parseInt(body.final_amount);

            const user = await addBalance(telegramId, amount, 'qris', body.invoice_id);

            await sendTelegramMessage(telegramId,
                `✅ <b>Deposit Berhasil!</b>\n\n` +
                `💰 <b>+Rp ${amount.toLocaleString('id-ID')}</b> masuk ke saldo kamu\n` +
                `📋 Via: QRIS (bayar.gg)\n` +
                `🔖 Ref: ${body.invoice_id}\n\n` +
                `Cek saldo terbaru di menu Dompet 👇`
            );

            return res.status(200).send('SUCCESS');
        }

        // ── Callback dari xRocket ────────────────────────────────
        if (body.type === 'invoice') {
            const xrocketSig = req.headers['rocket-pay-signature'];
            if (!xrocketSig) return res.status(200).send('OK');

            // Verifikasi HMAC SHA256 dari payload JSON
            const bodyStr    = JSON.stringify(body);
            const sigCheck   = crypto.createHmac('sha256', XROCKET_TOKEN)
                .update(bodyStr)
                .digest('hex');

            if (sigCheck !== xrocketSig) {
                console.error('xRocket signature mismatch');
                return res.status(200).send('OK');
            }

            if (body.status !== 'success') {
                return res.status(200).send('OK');
            }

            // payload format: "{telegram_id}:{merchantOrderId}:{idr_amount}"
            const [telegramIdStr, merchantOrderId, idrAmountStr] = (body.payload || '').split(':');
            if (!telegramIdStr) return res.status(200).send('OK');

            const telegramId = parseInt(telegramIdStr);
            const idrAmount  = parseInt(idrAmountStr);

            await addBalance(telegramId, idrAmount, 'xrocket', merchantOrderId);

            await sendTelegramMessage(telegramId,
                `✅ <b>Deposit Berhasil!</b>\n\n` +
                `💰 <b>+Rp ${idrAmount.toLocaleString('id-ID')}</b> masuk ke saldo kamu\n` +
                `🚀 Via: xRocket (${body.amount} ${body.currency})\n` +
                `🔖 Ref: ${merchantOrderId}\n\n` +
                `Cek saldo terbaru di menu Dompet 👇`
            );

            return res.status(200).send('SUCCESS');
        }

        return res.status(200).send('OK');

    } catch (err) {
        console.error('payment/callback error:', err);
        // Selalu return 200 ke payment gateway biar mereka gak retry terus
        return res.status(200).send('OK');
    }
}
