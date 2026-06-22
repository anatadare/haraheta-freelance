// ============================================================
// Vercel Serverless Function: /api/notify
// Kirim notifikasi Telegram ke user tertentu
// BOT_TOKEN disimpan di environment variable Vercel (aman)
// ============================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId, text, replyMarkup = null) {
    const body = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...(replyMarkup && { reply_markup: replyMarkup })
    };
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json();
}

export default async function handler(req, res) {
    // Hanya terima POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validasi token internal biar gak sembarang orang bisa panggil endpoint ini
    const authHeader = req.headers['x-internal-key'];
    if (authHeader !== process.env.INTERNAL_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type, data } = req.body;

    try {
        switch (type) {

            // Worker ambil job → notif ke client
            case 'job_claimed': {
                const { client_telegram_id, worker_username, job_title } = data;
                await sendMessage(
                    client_telegram_id,
                    `🔔 <b>Job kamu ada yang diambil!</b>\n\n` +
                    `📋 Job: <b>${job_title}</b>\n` +
                    `👷 Worker: @${worker_username || 'anonymous'}\n\n` +
                    `Pantau progress di tab <b>Monitor Live</b> 👀`
                );
                break;
            }

            // Worker submit bukti → notif ke client untuk review
            case 'proof_submitted': {
                const { client_telegram_id, worker_username, job_title, mini_app_url } = data;
                await sendMessage(
                    client_telegram_id,
                    `📸 <b>Bukti masuk, siap direview!</b>\n\n` +
                    `📋 Job: <b>${job_title}</b>\n` +
                    `👷 Worker: @${worker_username || 'anonymous'}\n\n` +
                    `Buka Mini App untuk review & setujui bukti 👇`,
                    {
                        inline_keyboard: [[
                            { text: '👀 Review Bukti', web_app: { url: mini_app_url } }
                        ]]
                    }
                );
                break;
            }

            // Client approve → notif ke worker
            case 'claim_approved': {
                const { worker_telegram_id, job_title, amount } = data;
                await sendMessage(
                    worker_telegram_id,
                    `✅ <b>Bukti kamu disetujui!</b>\n\n` +
                    `📋 Job: <b>${job_title}</b>\n` +
                    `💰 Pembayaran: <b>Rp ${Number(amount).toLocaleString('id-ID')}</b>\n\n` +
                    `Saldo kamu sudah bertambah. Cek di Dompet 💸`
                );
                break;
            }

            // Client reject → notif ke worker
            case 'claim_rejected': {
                const { worker_telegram_id, job_title, reason } = data;
                await sendMessage(
                    worker_telegram_id,
                    `❌ <b>Bukti kamu ditolak</b>\n\n` +
                    `📋 Job: <b>${job_title}</b>\n` +
                    `📝 Alasan: ${reason || 'Tidak sesuai instruksi'}\n\n` +
                    `Cek kembali instruksi job dan coba lagi.`
                );
                break;
            }

            // Anti-dup aktif → notif konfirmasi ke user
            case 'antidup_activated': {
                const { user_telegram_id } = data;
                await sendMessage(
                    user_telegram_id,
                    `🛡️ <b>Anti-Duplikat Worker Aktif!</b>\n\n` +
                    `Bot pengawas @satpamharaheta sekarang aktif di akun kamu.\n` +
                    `Worker yang sama tidak bisa klaim job kamu lebih dari sekali.\n\n` +
                    `Fitur ini berlaku selamanya — kamu tidak akan ditagih lagi.`
                );
                break;
            }

            // Job ditutup client → notif ke semua worker yang approved
            case 'job_closed': {
                const { worker_telegram_ids, job_title } = data;
                await Promise.all(worker_telegram_ids.map(id =>
                    sendMessage(id,
                        `🔒 <b>Job telah ditutup</b>\n\n` +
                        `📋 Job: <b>${job_title}</b>\n\n` +
                        `Terima kasih sudah berpartisipasi! 🙏`
                    )
                ));
                break;
            }

            default:
                return res.status(400).json({ error: `Unknown notification type: ${type}` });
        }

        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error('notify error:', err);
        return res.status(500).json({ error: err.message });
    }
}
