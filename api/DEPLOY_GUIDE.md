# Haraheta Freelance — Panduan Deploy ke Vercel

## Langkah 1: Upload ke GitHub
1. Buat repo baru di github.com (nama: haraheta-freelance)
2. Upload 2 file ini: index.html + vercel.json
3. Commit & push

## Langkah 2: Connect ke Vercel
1. Buka vercel.com → New Project
2. Import repo GitHub tadi
3. Framework Preset: pilih "Other"
4. Klik Deploy

## Langkah 3: Environment Variables di Vercel
Setelah deploy, buka Settings → Environment Variables, tambahkan:

| Name            | Value                    |
|-----------------|--------------------------|
| BOT_TOKEN       | (token baru dari BotFather) |
| SUPABASE_URL    | https://uhsotknuawggqbykbxug.supabase.co |
| SUPABASE_ANON   | (anon key yang sudah dipasang di HTML) |

## Langkah 4: Set Mini App di BotFather
1. Buka @BotFather → /mybots → @harahetajobbot
2. Bot Settings → Menu Button → Configure Menu Button
3. Masukkan URL Vercel kamu: https://nama-project.vercel.app
4. Atau pakai /newapp untuk buat Mini App resmi

## Langkah 5: Setup Webhook Bot
Setelah dapat domain Vercel, jalankan ini di browser:
https://api.telegram.org/bot{BOT_TOKEN}/setWebhook?url=https://nama-project.vercel.app/api/webhook

## Langkah 6: Jalankan Schema Supabase
1. Buka: https://supabase.com/dashboard/project/uhsotknuawggqbykbxug/sql/new
2. Upload/paste file haraheta_schema.sql
3. Klik Run

## Langkah 7: Aktifkan pg_cron (hapus foto otomatis tiap minggu)
1. Dashboard Supabase → Database → Extensions
2. Cari "pg_cron" → Enable
3. Balik ke SQL Editor, uncomment bagian cron.schedule di schema
4. Run lagi
