// ============================================================
// POST /api/payment/create
// Generate invoice bayar.gg (QRIS) atau xRocket (USDT)
// Body: { method: 'qris' | 'xrocket', amount: number, telegram_id: number }
// ============================================================

const BAYARGG_API_KEY      = process.env.BAYARGG_API_KEY;
const BAYARGG_BASE_URL     = 'https://www.bayar.gg/api';
const XROCKET_TOKEN        = process.env.XROCKET_TOKEN;
const INTERNAL_KEY         = process.env.INTERNAL_KEY;
const SUPABASE_URL         = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const APP_URL              = 'https://haraheta-freelance.vercel.app';

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

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (req.headers['x-internal-key'] !== INTERNAL_KEY) return res.status(401).json({ error: 'Unauthorized' });

    const { method, amount, telegram_id } = req.body;

    if (!method || !amount || !telegram_id) {
        return res.status(400).json({ error: 'method, amount, telegram_id wajib diisi' });
    }
    if (amount < 10000) {
        return res.status(400).json({ error: 'Minimal deposit Rp10.000' });
    }

    try {
        // ── QRIS via bayar.gg ────────────────────────────────────
        if (method === 'qris') {
            const payload = {
                amount,
                description:     `Deposit Haraheta Freelance`,
                customer_name:   `User ${telegram_id}`,
                payment_method:  'qris',
                payment_url:     'https://www.bayar.gg/pay',  // default checkout URL bayar.gg
                callback_url:    `${APP_URL}/api/payment/callback`,
                redirect_url:    `${APP_URL}?deposit=success`
            };

            const bayarRes = await fetch(`${BAYARGG_BASE_URL}/create-payment.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': BAYARGG_API_KEY
                },
                body: JSON.stringify(payload)
            });
            const bayarData = await bayarRes.json();

            // Log response untuk debug
            console.log('bayar.gg response:', JSON.stringify(bayarData));

            if (!bayarData.success || !bayarData.data) {
                return res.status(500).json({
                    error: 'Gagal generate QRIS',
                    detail: bayarData
                });
            }

            const invoice = bayarData.data;

            // Catat transaksi pending (invoice_id buat matching di callback)
            await dbPost('transactions', {
                type:   'deposit',
                amount,
                method: 'qris',
                note:   invoice.invoice_id
            });

            // qris_string ada di response — tampilkan sebagai QR image
            // Kalau qris_string ada, generate QR image via bayar.gg qris-info
            let qrImageUrl = null;
            if (invoice.qris_string) {
                qrImageUrl = `https://www.bayar.gg/qris-info/api/qr.php?data=${encodeURIComponent(invoice.qris_string)}`;
            }

            // Pastikan payment_url selalu ada — fallback ke URL bayar.gg default
            const paymentUrl = invoice.payment_url
                || invoice.paymentUrl
                || `https://www.bayar.gg/pay/${invoice.invoice_id}`;

            return res.status(200).json({
                ok:           true,
                method:       'qris',
                invoice_id:   invoice.invoice_id,
                payment_url:  paymentUrl,
                final_amount: invoice.final_amount || amount,
                expires_at:   invoice.expires_at || null,
                amount
            });
        }

        // ── xRocket (USDT) ───────────────────────────────────────
        if (method === 'xrocket') {
            const usdtAmount = (amount / 16300).toFixed(2);

            const xrocketRes = await fetch('https://pay.xrocket.tg/tg-invoices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Rocket-Pay-Key': XROCKET_TOKEN
                },
                body: JSON.stringify({
                    currency:    'USDT',
                    amount:      usdtAmount,
                    description: `Deposit Haraheta Freelance (Rp${Number(amount).toLocaleString('id-ID')})`,
                    payload:     `${telegram_id}:DEP-${telegram_id}-${Date.now()}:${amount}`,
                    callbackUrl: `${APP_URL}/api/payment/callback`
                })
            });
            const xrocketData = await xrocketRes.json();

            console.log('xRocket response:', JSON.stringify(xrocketData));

            if (!xrocketData.result?.link) {
                return res.status(500).json({
                    error: 'Gagal generate invoice xRocket',
                    detail: xrocketData
                });
            }

            return res.status(200).json({
                ok:          true,
                method:      'xrocket',
                invoice_url: xrocketData.result.link,
                usdt_amount: usdtAmount,
                idr_amount:  amount
            });
        }

        return res.status(400).json({ error: `Method tidak dikenal: ${method}` });

    } catch (err) {
        console.error('payment/create error:', err);
        return res.status(500).json({ error: err.message });
    }
}
