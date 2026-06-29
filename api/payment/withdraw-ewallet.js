// ============================================================
// POST /api/payment/withdraw-ewallet
// Withdraw to e-wallet via bayar.gg payout
// Body: { method: 'dana'|'ovo'|'gopay'|'linkaja', amount: number, phone: string, telegram_id: number }
// ============================================================

const BAYARGG_API_KEY      = process.env.BAYARGG_API_KEY;
const BAYARGG_BASE_URL     = 'https://www.bayar.gg/api';
const INTERNAL_KEY         = process.env.INTERNAL_KEY;
const SUPABASE_URL         = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const APP_URL              = 'https://haraheta-freelance.vercel.app';
const BOT_TOKEN            = process.env.BOT_TOKEN;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// E-wallet fee mapping (biaya bayar.gg)
const EWALLET_FEES = {
    'dana': 10000,
    'ovo': 10000,
    'gopay': 10000,
    'linkaja': 10000
};

const EWALLET_LABELS = {
    'dana': '💜 DANA',
    'ovo': '🟣 OVO',
    'gopay': '🔵 GoPay',
    'linkaja': '🟡 LinkAja'
};

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

    const { method, amount, phone, telegram_id } = req.body;

    if (!method || !amount || !phone || !telegram_id) {
        return res.status(400).json({ error: 'method, amount, phone, telegram_id wajib diisi' });
    }

    if (!['dana', 'ovo', 'gopay', 'linkaja'].includes(method)) {
        return res.status(400).json({ error: 'Method e-wallet tidak valid' });
    }

    if (amount < 50000) {
        return res.status(400).json({ error: 'Minimal withdraw Rp 50.000' });
    }

    // Validasi nomor telepon (Indonesia format)
    const phoneRegex = /^(\+62|62|0)[0-9]{9,12}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Nomor telepon tidak valid' });
    }

    try {
        // ── Check user balance ────────────────────────────────────
        const users = await dbGet('users', `?telegram_id=eq.${telegram_id}&limit=1`);
        const user = users[0];

        if (!user) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        const fee = EWALLET_FEES[method];
        const totalAmount = amount + fee;

        if (user.balance_idr < totalAmount) {
            return res.status(400).json({ 
                error: 'Saldo tidak cukup', 
                available: user.balance_idr,
                required: totalAmount,
                fee: fee
            });
        }

        // ── E-Wallet Withdrawal via bayar.gg ───────────────────
        const orderId = `EW-${telegram_id}-${Date.now()}`;
        
        // Normalisasi nomor telepon (gunakan format 62)
        let normalizedPhone = phone.replace(/\s/g, '');
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '62' + normalizedPhone.substring(1);
        } else if (!normalizedPhone.startsWith('62')) {
            normalizedPhone = '62' + normalizedPhone;
        }

        const payoutPayload = {
            amount,
            method: method.toUpperCase(), // DANA, OVO, GOPAY, LINKAJA
            phone: normalizedPhone,
            description: `Withdraw Haraheta Freelance - ${orderId}`,
            callback_url: `${APP_URL}/api/payment/callback`,
            reference_id: orderId
        };

        console.log('bayar.gg payout request:', JSON.stringify(payoutPayload));

        const bayarRes = await fetch(`${BAYARGG_BASE_URL}/payout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': BAYARGG_API_KEY
            },
            body: JSON.stringify(payoutPayload)
        });

        const bayarData = await bayarRes.json();
        console.log('bayar.gg payout response:', JSON.stringify(bayarData));

        if (!bayarData.success || !bayarData.data?.payout_id) {
            console.error('bayar.gg payout error:', bayarData);
            return res.status(500).json({
                error: 'Gagal proses withdrawal e-wallet',
                detail: bayarData.message || 'Unknown error'
            });
        }

        // ── Kurangi balance user (amount + fee) ─────────────────
        const newBalance = user.balance_idr - totalAmount;
        await dbPatch('users', `?telegram_id=eq.${telegram_id}`, {
            balance_idr: newBalance
        });

        // ── Catat transaksi sebagai pending ────────────────────
        await dbPost('transactions', {
            user_id:     user.id,
            type:        'withdrawal',
            amount,
            method:      `ewallet_${method}`,
            status:      'pending',
            note:        `${orderId}|${method}|${phone}|${fee}`,
            metadata:    JSON.stringify({
                payout_id: bayarData.data.payout_id,
                phone,
                ewallet_method: method,
                fee
            })
        });

        // ── Notif ke user ────────────────────────────────────
        await sendTelegram(telegram_id,
            `⏳ <b>Withdrawal E-Wallet Sedang Diproses</b>\n\n` +
            `💸 <b>Rp ${amount.toLocaleString('id-ID')}</b>\n` +
            `📞 ${EWALLET_LABELS[method]} ${phone}\n` +
            `📋 ID: ${orderId}\n` +
            `💰 Biaya: Rp ${fee.toLocaleString('id-ID')}\n\n` +
            `Saldo kamu berkurang, tunggu konfirmasi dari bayar.gg...`
        );

        return res.status(200).json({
            ok:           true,
            method:       'ewallet',
            ewallet_type: method,
            order_id:     orderId,
            idr_amount:   amount,
            fee:          fee,
            total:        totalAmount,
            phone:        phone,
            status:       'pending',
            new_balance:  newBalance
        });

    } catch (err) {
        console.error('payment/withdraw-ewallet error:', err);
        return res.status(500).json({ error: err.message });
    }
}
