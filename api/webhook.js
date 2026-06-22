// ============================================================
// Vercel Serverless Function: /api/webhook
// Terima update dari Telegram Bot API
// ============================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = 'https://uhsotknuawggqbykbxug.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key (bukan anon)

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId, text, replyMarkup = null) {
    const body = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...(replyMarkup && { reply_markup: replyMarkup })
    };
    await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function dbGet(table, query = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    return res.json();
}

async function dbUpsert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(data)
    });
    return res.json();
}

const MINI_APP_URL = 'https://haraheta-freelance.vercel.app';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).json({ ok: true });

    const update = req.body;
    const message = update.message || update.callback_query?.message;
    const chatId = message?.chat?.id;
    const text = message?.text || '';
    const tgUser = update.message?.from || update.callback_query?.from;

    if (!chatId || !tgUser) return res.status(200).json({ ok: true });

    try {
        // Upsert user ke Supabase setiap ada interaksi
        await dbUpsert('users', {
            telegram_id: tgUser.id,
            username: tgUser.username || null,
            full_name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim()
        });

        // Handle /start
        if (text.startsWith('/start')) {
            const param = text.split(' ')[1] || '';

            // Referral tracking
            if (param.startsWith('ref')) {
                const refCode = param.replace('ref', '');
                // TODO: catat referral ke DB
            }

            await sendMessage(chatId,
                `👋 <b>Selamat datang di Haraheta Freelance!</b>\n\n` +
                `Platform micro-job untuk komunitas Telegram & Social Media.\n\n` +
                `🎯 <b>Sebagai Worker:</b> Ambil tugas, kerjakan, dapat bayaran\n` +
                `📋 <b>Sebagai Client:</b> Deploy job, bayar worker, pantau progress\n\n` +
                `Klik tombol di bawah untuk mulai 👇`,
                {
                    inline_keyboard: [[
                        { text: '🚀 Buka Haraheta Freelance', web_app: { url: MINI_APP_URL } }
                    ]]
                }
            );
        }

        // Handle /saldo
        else if (text === '/saldo') {
            const users = await dbGet('users', `?telegram_id=eq.${tgUser.id}&limit=1`);
            const user = users[0];
            if (user) {
                await sendMessage(chatId,
                    `💰 <b>Saldo kamu</b>\n\n` +
                    `Rp ${Number(user.balance_idr || 0).toLocaleString('id-ID')}\n\n` +
                    `Deposit atau withdraw lewat menu Dompet di Mini App.`
                );
            }
        }

        // Handle /help
        else if (text === '/help') {
            await sendMessage(chatId,
                `📚 <b>Panduan Haraheta Freelance</b>\n\n` +
                `<b>Perintah bot:</b>\n` +
                `/start — Buka Mini App\n` +
                `/saldo — Cek saldo kamu\n` +
                `/help — Tampilkan panduan ini\n\n` +
                `<b>Ada masalah?</b>\n` +
                `Hubungi admin: @satpamharaheta`
            );
        }

    } catch (err) {
        console.error('webhook error:', err);
    }

    // Telegram butuh response 200 dalam 10 detik
    return res.status(200).json({ ok: true });
}
