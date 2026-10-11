CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  coins INTEGER NOT NULL DEFAULT 20,
  ref_code TEXT UNIQUE,
  referred_by TEXT,
  referrals INTEGER NOT NULL DEFAULT 0,
  rewarded_referrals INTEGER NOT NULL DEFAULT 0,
  daily_claim TEXT,
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mailboxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id TEXT NOT NULL,
  address TEXT NOT NULL,
  password TEXT NOT NULL,
  token TEXT NOT NULL,
  domain TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS texts (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending (
  tg_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  tg_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  data TEXT
);

INSERT OR IGNORE INTO settings(key,value) VALUES
('APP_NAME','NovaMail'),
('FORCE_CHANNEL',''),
('FORCE_CHANNEL_URL',''),
('EXPIRY_HOURS','24'),
('CREATE_COST','2'),
('DAILY_COINS','5'),
('REF_EVERY','2'),
('REF_REWARD','10'),
('ADMIN_ID','');

INSERT OR IGNORE INTO texts(key,value) VALUES
('welcome','🌌 به NovaMail خوش آمدی!\nایمیل موقت خودت را سریع و ساده بساز.'),
('join_required','🔒 برای استفاده از ربات ابتدا عضو کانال شو، سپس روی «بررسی عضویت» بزن.'),
('mail_created','✅ ایمیل موقت ساخته شد\n\n📧 {email}\n⏳ اعتبار: {hours} ساعت'),
('no_mail','📭 هنوز ایمیل فعالی نداری.'),
('insufficient','🪙 سکه کافی نیست.'),
('referral','🎁 با دعوت دوستان سکه بگیر.'),
('help','ℹ️ از منوی اصلی برای ساخت ایمیل، صندوق ورودی، سکه و دعوت دوستان استفاده کن.');
