ALTER TABLE students ADD COLUMN monthly_payment_day INTEGER CHECK (monthly_payment_day BETWEEN 1 AND 31);

CREATE TABLE IF NOT EXISTS web_push_keys (
  id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  last_sent_date TEXT
);
