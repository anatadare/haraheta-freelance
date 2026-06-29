// ============================================================
// POST /api/payment/callback
// Terima notifikasi dari bayar.gg, xRocket (deposit & withdrawal)
// ============================================================

const BAYARGG_WEBHOOK_SECRET = process.env.BAYARGG_WEBHOOK_SECRET;
const XROCKET_TOKEN          = process.env.XROCKET_TOKEN;
const SUPABASE_URL           = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const BOT_TOKEN              = process.env.BOT_TOKEN;

import crypto from 'crypto';

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

async function addBalance(telegramId, amount, method, note) {
    const users = await dbGet('users', `?telegram_id=eq.${telegramId}&limit=1`);
    const user = users[0];
    if (!user) throw new Error(`User tidak ditemukan: telegram_id=${telegramId}`);

    await dbPatch('users', `?telegram_id=eq.${telegramId}`, {
        balance_idr: user.balance_idr + amount
    });
    await dbPost('transactions', {
        user_id: user.id, type: 'deposit', amount, method, note
    });
    return user;
}

async function sendTelegram(chatId, text) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const body      = req.body;
    const timestamp = req.headers['x-webhook-timestamp'] || '';
    const signature = req.headers['x-webhook-signature'] || '';

    console.log('callback received:', JSON.stringify(body).slice(0, 200));

    try {
        // ── Callback dari bayar.gg ───────────────────────────────
        // Docs: event = "payment.paid", header X-Webhook-Signature
        // Signature: HMAC SHA256 dari "{invoice_id}|{status}|{final_amount}|{timestamp}"
        if (body.event === 'payment.paid') {
            // Verifikasi signature
            const sigData     = `${body.invoice_id}|${body.status}|${body.final_amount}|${timestamp}`;
            const expectedSig = crypto.createHmac('sha256', BAYARGG_WEBHOOK_SECRET)
                .update(sigData).digest('hex');

            if (expectedSig !== signature) {
                console.error('bayar.gg signature mismatch. Expected:', expectedSig, 'Got:', signature);
                return res.status(200).send('INVALID SIGNATURE');
            }

            if (body.status !== 'paid') return res.status(200).send('OK');

            // Extract telegram_id dari customer_name: "User {telegram_id}"
            const match = (body.customer_name || '').match(/User (\d+)/);
            if (!match) {
                console.error('Tidak bisa parse telegram_id dari customer_name:', body.customer_name);
                return res.status(200).send('OK');
            }

            const telegramId = parseInt(match[1]);
            const amount     = parseInt(body.final_amount);

            await addBalance(telegramId, amount, 'qris', body.invoice_id);

            await sendTelegram(telegramId,
                `✅ <b>Deposit Berhasil!</b>\n\n` +
                `💰 <b>+Rp ${amount.toLocaleString('id-ID')}</b> masuk ke saldo kamu\n` +
                `📋 Via: QRIS (bayar.gg)\n` +
                `🔖 Ref: ${body.invoice_id}\n\n` +
                `Cek saldo terbaru di menu Dompet 👇`
            );

            return res.status(200).send('SUCCESS');
        }

        // ── Callback dari xRocket ────────────────────────────────
        if (body.type === 'invoice' || body.type === 'transfer') {
            const xrocketSig = req.headers['rocket-pay-signature'];
            if (!xrocketSig) return res.status(200).send('OK');

            const sigCheck = crypto.createHmac('sha256', XROCKET_TOKEN)
                .update(JSON.stringify(body)).digest('hex');

            if (sigCheck !== xrocketSig) {
                console.error('xRocket signature mismatch');
                return res.status(200).send('OK');
            }

            // ── DEPOSIT xRocket (invoice) ──────────────────────────
            if (body.type === 'invoice' && body.status === 'success') {
                // payload: "{telegram_id}:{orderId}:{usdt_amount}"
                const parts = (body.payload || '').split(':');
                if (!parts[0]) return res.status(200).send('OK');

                const telegramId = parseInt(parts[0]);
                const usdtAmount = parts[2] || body.amount || '0';

                // Konversi USDT ke IDR untuk tambah saldo (kurs 16.300)
                const idrAmount = Math.round(parseFloat(usdtAmount) * 16300);

                await addBalance(telegramId, idrAmount, 'xrocket', body.payload);

                await sendTelegram(telegramId,
                    `✅ <b>Deposit xRocket Berhasil!</b>\n\n` +
                    `🚀 <b>${usdtAmount} USDT</b> sudah masuk\n` +
                    `💰 +Rp ${idrAmount.toLocaleString('id-ID')} ke saldo kamu\n\n` +
                    `Cek saldo terbaru di menu Dompet 👇`
                );

                return res.status(200).send('SUCCESS');
            }

            // ── WITHDRAWAL xRocket (transfer) ──────────────────────
            if (body.type === 'transfer') {
                const parts = (body.payload || '').split(':');
                if (!parts[0]) return res.status(200).send('OK');

                const telegramId = parseInt(parts[0]);
                const orderId = parts[1];
                const usdtAmount = parts[2];

                // Cari transaction record
                const transactions = await dbGet('transactions', `?note=like.*${orderId}*&limit=1`);
                const txn = transactions[0];

                if (!txn) {
                    console.error('Transaction tidak ditemukan:', orderId);
                    return res.status(200).send('OK');
                }

                if (body.status === 'success') {
                    // ── Update transaction status to SUCCESS ────────
                    await dbPatch('transactions', `?id=eq.${txn.id}`, {
                        status: 'completed'
                    });

                    await sendTelegram(telegramId,
                        `✅ <b>Withdrawal Berhasil!</b>\n\n` +
                        `🚀 <b>${usdtAmount} USDT</b> sudah dikirim\n` +
                        `📋 Order ID: ${orderId}\n` +
                        `📍 TX Hash: <code>${body.txHash || 'processing'}</code>\n\n` +
                        `Cek transaction di blockchain explorer 👇`
                    );
                } else if (body.status === 'failed') {
                    // ── REFUND balance kalo gagal ────────────────────
                    const user = await dbGet('users', `?telegram_id=eq.${telegramId}&limit=1`);
                    const userRecord = user[0];

                    if (userRecord) {
                        const refundAmount = txn.amount;
                        await dbPatch('users', `?telegram_id=eq.${telegramId}`, {
                            balance_idr: userRecord.balance_idr + refundAmount
                        });
                    }

                    await dbPatch('transactions', `?id=eq.${txn.id}`, {
                        status: 'failed'
                    });

                    await sendTelegram(telegramId,
                        `❌ <b>Withdrawal Gagal!</b>\n\n` +
                        `🚀 <b>${usdtAmount} USDT</b> tidak berhasil dikirim\n` +
                        `📋 Order ID: ${orderId}\n` +
                        `❌ Reason: ${body.reason || 'Unknown error'}\n\n` +
                        `💰 Saldo kamu sudah dikembalikan. Coba lagi nanti 👇`
                    );
                }

                return res.status(200).send('SUCCESS');
            }
        }

        return res.status(200).send('OK');

    } catch (err) {
        console.error('payment/callback error:', err);
        return res.status(200).send('OK'); // selalu 200 ke payment gateway
    }
}
