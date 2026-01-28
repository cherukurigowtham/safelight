CREATE TABLE IF NOT EXISTS captcha_challenges (
  id UUID PRIMARY KEY,
  answer_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
