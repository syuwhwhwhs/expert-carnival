# NovaMail — نسخه کامل

این پروژه شامل:
- ربات Telegram با Webhook
- Mini App زیبا و ریسپانسیو
- Mail.tm برای ساخت ایمیل واقعی
- Cloudflare Worker
- Cloudflare D1
- سکه و هزینه ساخت ایمیل
- سیستم دعوت و پاداش
- اجبار عضویت کانال
- انتخاب دامنه
- صندوق ورودی
- پنل مدیریت `/admin`
- تنظیمات قابل تغییر

## Secrets
در Cloudflare Worker این سه Secret را بساز:
- BOT_TOKEN
- ADMIN_PASSWORD
- WEBHOOK_SECRET

## D1
دیتابیس D1 بساز و فایل `migrations/0001_init.sql` را در SQL Console اجرا کن.
بعد `database_id` واقعی را در `wrangler.jsonc` قرار بده یا Binding را از داشبورد تنظیم کن.

## تنظیمات
در جدول settings:
- ADMIN_ID
- FORCE_CHANNEL
- FORCE_CHANNEL_URL
- MINIAPP_URL

برای پنل مدیریت:
`https://YOUR-WORKER.workers.dev/admin`

## Webhook
بعد از Deploy، Webhook ربات را روی مسیر زیر قرار بده:
`https://YOUR-WORKER.workers.dev/telegram/YOUR_WEBHOOK_SECRET`

## نکته
برای ساخت ایمیل واقعی، Mail.tm باید در دسترس باشد و شرایط استفاده آن رعایت شود.
