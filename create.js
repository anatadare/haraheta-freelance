// ============================================================
// POST /api/payment/create
// Generate QRIS (Duitku) atau invoice xRocket (USDT)
// Body: { method: 'qris' | 'xrocket', amount: number, telegram_id: number }
// ============================================================

const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE;
const DUITKU_API_KEY       = process.env.DUITKU_API_KEY;
const DUITKU_BASE_URL      = 'https://api-sandbox.duitku.com/api/merchant'; // ganti ke production: https://api-prod.duitku.com/api/merchant
const XROCKET_TOKEN        = process.env.XROCKET_TOKEN;
const INTERNAL_KEY         = process.env.INTERNAL_KEY;
const SUPABASE_URL         = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const APP_URL              = 'https://haraheta-freelance.vercel.app';

import crypto from 'crypto';

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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
    });
    return res.json();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers['x-internal-key'];
    if (authHeader !== INTERNAL_KEY) return res.status(401).json({ error: 'Unauthorized' });

    const { method, amount, telegram_id } = req.body;

    if (!method || !amount || !telegram_id) {
        return res.status(400).json({ error: 'method, amount, telegram_id wajib diisi' });
    }
    if (amount < 10000) {
        return res.status(400).json({ error: 'Minimal deposit Rp10.000' });
    }

    const merchantOrderId = `DEP-${telegram_id}-${Date.now()}`;

    try {
        // ── QRIS via Duitku ──────────────────────────────────────
        if (method === 'qris') {
            const timestamp    = Date.now();
            const signatureRaw = `${DUITKU_MERCHANT_CODE}${timestamp}${DUITKU_API_KEY}`;
            const signature    = crypto.createHash('sha256').update(signatureRaw).digest('hex');

            const payload = {
                merchantCode:    DUITKU_MERCHANT_CODE,
                paymentAmount:   amount,
                merchantOrderId,
                productDetails:  `Deposit Haraheta Freelance`,
                email:           `user${telegram_id}@haraheta.app`, // email dummy valid
                paymentMethod:   'SP',   // SP = QRIS di Duitku
                returnUrl:       `${APP_URL}?deposit=success`,
                callbackUrl:     `${APP_URL}/api/payment/callback`,
                signature,
                expiryPeriod:    10      // menit, QRIS expired dalam 10 menit
            };

            const duitkuRes = await fetch(`${DUITKU_BASE_URL}/v2/inquiry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-duitku-signature': signature, 'x-duitku-timestamp': String(timestamp), 'x-duitku-merchantcode': DUITKU_MERCHANT_CODE },
                body: JSON.stringify(payload)
            });
            const duitkuData = await duitkuRes.json();

            if (!duitkuData.paymentUrl && !duitkuData.qrString) {
                console.error('Duitku error:', duitkuData);
                return res.status(500).json({ error: 'Gagal generate QRIS', detail: duitkuData });
            }

            // Simpan transaksi pending ke Supabase
            await dbPost('transactions', {
                user_id:      null, // di-resolve dari telegram_id di callback
                type:         'deposit',
                amount:       amount,
                reference_id: null,
                method:       'qris',
                note:         merchantOrderId
            });

            return res.status(200).json({
                ok:              true,
                method:          'qris',
                merchantOrderId,
                qr_string:       duitkuData.qrString   || null,
                qr_url:          duitkuData.paymentUrl  || null,
                amount
            });
        }

        // ── xRocket (USDT) ───────────────────────────────────────
        if (method === 'xrocket') {
            // Konversi IDR → USDT (rate kasar, idealnya ambil dari API rate live)
            const usdtAmount = (amount / 16300).toFixed(2); // ~Rp16.300/USDT

            const xrocketRes = await fetch('https://pay.xrocket.tg/tg-invoices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Rocket-Pay-Key': XROCKET_TOKEN
                },
                body: JSON.stringify({
                    currency:    'USDT',
                    amount:      usdtAmount,
                    description: `Deposit Haraheta Freelance (Rp${amount.toLocaleString('id-ID')})`,
                    payload:     `${telegram_id}:${merchantOrderId}:${amount}`,  // buat tracking di callback
                    callbackUrl: `${APP_URL}/api/payment/callback`
                })
            });
            const xrocketData = await xrocketRes.json();

            if (!xrocketData.result?.link) {
                console.error('xRocket error:', xrocketData);
                return res.status(500).json({ error: 'Gagal generate invoice xRocket', detail: xrocketData });
            }

            return res.status(200).json({
                ok:              true,
                method:          'xrocket',
                merchantOrderId,
                invoice_url:     xrocketData.result.link,
                usdt_amount:     usdtAmount,
                idr_amount:      amount
            });
        }

        return res.status(400).json({ error: `Method tidak dikenal: ${method}` });

    } catch (err) {
        console.error('payment/create error:', err);
        return res.status(500).json({ error: err.message });
    }
}
