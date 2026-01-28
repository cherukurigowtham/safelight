CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_id INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
