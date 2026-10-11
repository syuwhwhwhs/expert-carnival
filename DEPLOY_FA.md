# آموزش خیلی ساده نصب NovaMail

1) ZIP را در GitHub آپلود کن.
2) Cloudflare → Workers & Pages → Create Worker.
3) Worker را به پروژه GitHub وصل کن یا فایل‌ها را Deploy کن.
4) در Cloudflare → D1 → Create database یک DB به نام `novamail-db` بساز.
5) فایل `migrations/0001_init.sql` را در D1 → Console اجرا کن.
6) در Worker → Settings → Bindings یک D1 Binding بساز:
   Variable name = DB
   Database = novamail-db
7) در Worker → Settings → Variables and Secrets این‌ها را اضافه کن:
   BOT_TOKEN = توکن BotFather
   ADMIN_PASSWORD = رمز پنل
   WEBHOOK_SECRET = یک عبارت تصادفی
8) مقدار MINIAPP_URL را در settings به آدرس Mini App خودت تغییر بده.
9) Worker را Deploy کن.
10) Webhook تلگرام را روی مسیر `/telegram/WEBHOOK_SECRET` تنظیم کن.
11) ربات باید برای بررسی عضویت، در کانال اجباری Admin باشد.
12) پنل مدیریت در `/admin` باز می‌شود.
