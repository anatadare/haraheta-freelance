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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase error: ${err}`);
    }
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
        // ── QRIS via bayar.gg ────────────────────────────────────
        if (method === 'qris') {
            const payload = {
                amount,
                description:   `Deposit Haraheta Freelance`,
                customer_name: `User ${telegram_id}`,
                payment_method: 'qris',           // QRIS Admin, limit Rp500rb
                payment_url:   'https://www.bayar.gg/pay',
                callback_url:  `${APP_URL}/api/payment/callback`,
                redirect_url:  `${APP_URL}?deposit=success`
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

            if (!bayarData.success || !bayarData.data) {
                console.error('bayar.gg error:', bayarData);
                return res.status(500).json({ error: 'Gagal generate QRIS', detail: bayarData });
            }

            const invoice = bayarData.data;

            // Catat transaksi pending ke Supabase (invoice_id sebagai note buat matching di callback)
            await dbPost('transactions', {
                type:   'deposit',
                amount,
                method: 'qris',
                note:   invoice.invoice_id
            });

            return res.status(200).json({
                ok:           true,
                method:       'qris',
                invoice_id:   invoice.invoice_id,
                payment_url:  invoice.payment_url,
                qr_string:    invoice.qris_string || null,
                final_amount: invoice.final_amount,
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
                    description: `Deposit Haraheta Freelance (Rp${amount.toLocaleString('id-ID')})`,
                    payload:     `${telegram_id}:${merchantOrderId}:${amount}`,
                    callbackUrl: `${APP_URL}/api/payment/callback`
                })
            });
            const xrocketData = await xrocketRes.json();

            if (!xrocketData.result?.link) {
                console.error('xRocket error:', xrocketData);
                return res.status(500).json({ error: 'Gagal generate invoice xRocket', detail: xrocketData });
            }

            return res.status(200).json({
                ok:           true,
                method:       'xrocket',
                invoice_url:  xrocketData.result.link,
                usdt_amount:  usdtAmount,
                idr_amount:   amount
            });
        }

        return res.status(400).json({ error: `Method tidak dikenal: ${method}` });

    } catch (err) {
        console.error('payment/create error:', err);
        return res.status(500).json({ error: err.message });
    }
}
