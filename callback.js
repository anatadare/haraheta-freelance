// ============================================================
// POST /api/payment/callback
// Terima notifikasi pembayaran dari Duitku & xRocket
// Setelah verifikasi → update saldo Supabase → notif Telegram
// ============================================================

const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE;
const DUITKU_API_KEY       = process.env.DUITKU_API_KEY;
const SUPABASE_URL         = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BOT_TOKEN            = process.env.BOT_TOKEN;
const APP_URL              = 'https://haraheta-freelance.vercel.app';
const XROCKET_TOKEN        = process.env.XROCKET_TOKEN;

import crypto from 'crypto';

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function dbGet(table, query = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    return res.json();
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

async function addBalance(telegramId, amount, method, note) {
    // Ambil user
    const users = await dbGet('users', `?telegram_id=eq.${telegramId}&limit=1`);
    const user = users[0];
    if (!user) throw new Error(`User tidak ditemukan: ${telegramId}`);

    // Update saldo
    await fetch(`${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${telegramId}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ balance_idr: user.balance_idr + amount })
    });

    // Catat transaksi
    await dbPost('transactions', {
        user_id:  user.id,
        type:     'deposit',
        amount:   amount,
        method,
        note
    });

    return user;
}

async function sendTelegramMessage(chatId, text) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
}

export default async function handler(req, res) {
    // Telegram & Duitku pakai POST, xRocket juga POST
    if (req.method !== 'POST') return res.status(200).send('OK');

    const body = req.body;

    try {
        // ── Callback dari Duitku ─────────────────────────────────
        // Duitku kirim: merchantCode, amount, merchantOrderId, productDetail,
        //               additionalParam, resultCode, merchantUserId, reference, signature
        if (body.merchantCode && body.merchantOrderId) {
            const { merchantCode, amount, merchantOrderId, resultCode, signature } = body;

            // Verifikasi signature Duitku
            const expectedSig = crypto
                .createMd5Hash(`${merchantCode}${amount}${merchantOrderId}${DUITKU_API_KEY}`)
                .digest('hex');

            // Verifikasi manual karena crypto.createMd5Hash tidak ada, pakai cara benar:
            const sigCheck = crypto.createHash('md5')
                .update(`${merchantCode}${amount}${merchantOrderId}${DUITKU_API_KEY}`)
                .digest('hex');

            if (sigCheck !== signature) {
                console.error('Duitku signature mismatch');
                return res.status(200).send('INVALID SIGNATURE');
            }

            // resultCode '00' = sukses
            if (resultCode !== '00') {
                console.log(`Duitku payment not successful: ${resultCode}`);
                return res.status(200).send('OK');
            }

            // Extract telegram_id dari merchantOrderId: DEP-{telegram_id}-{timestamp}
            const parts = merchantOrderId.split('-');
            const telegramId = parseInt(parts[1]);
            if (!telegramId) return res.status(200).send('OK');

            const amountInt = parseInt(amount);
            const user = await addBalance(telegramId, amountInt, 'qris', merchantOrderId);

            // Notif Telegram ke user
            await sendTelegramMessage(telegramId,
                `✅ <b>Deposit Berhasil!</b>\n\n` +
                `💰 <b>+Rp ${amountInt.toLocaleString('id-ID')}</b> masuk ke saldo kamu\n` +
                `📋 Via: QRIS\n` +
                `🔖 Ref: ${merchantOrderId}\n\n` +
                `Cek saldo terbaru di Dompet 👇`,
            );

            return res.status(200).send('SUCCESS');
        }

        // ── Callback dari xRocket ────────────────────────────────
        // xRocket kirim: { type: 'invoice', status: 'success'/'expired', payload, amount, currency }
        if (body.type === 'invoice') {
            // Verifikasi webhook signature xRocket
            const xrocketSig = req.headers['rocket-pay-signature'];
            if (!xrocketSig) return res.status(200).send('OK');

            const sigCheck = crypto.createHmac('sha256', XROCKET_TOKEN)
                .update(JSON.stringify(body))
                .digest('hex');

            if (sigCheck !== xrocketSig) {
                console.error('xRocket signature mismatch');
                return res.status(200).send('OK');
            }

            if (body.status !== 'success') {
                console.log(`xRocket invoice not paid: ${body.status}`);
                return res.status(200).send('OK');
            }

            // payload format: "{telegram_id}:{merchantOrderId}:{idr_amount}"
            const [telegramId, merchantOrderId, idrAmount] = (body.payload || '').split(':');
            if (!telegramId) return res.status(200).send('OK');

            const amountInt = parseInt(idrAmount);
            await addBalance(parseInt(telegramId), amountInt, 'xrocket', merchantOrderId);

            // Notif Telegram ke user
            await sendTelegramMessage(parseInt(telegramId),
                `✅ <b>Deposit Berhasil!</b>\n\n` +
                `💰 <b>+Rp ${amountInt.toLocaleString('id-ID')}</b> masuk ke saldo kamu\n` +
                `🚀 Via: xRocket (${body.amount} ${body.currency})\n` +
                `🔖 Ref: ${merchantOrderId}\n\n` +
                `Cek saldo terbaru di Dompet 👇`
            );

            return res.status(200).send('SUCCESS');
        }

        return res.status(200).send('OK');

    } catch (err) {
        console.error('payment/callback error:', err);
        // Selalu return 200 ke payment gateway, biar mereka gak retry terus
        return res.status(200).send('OK');
    }
}
