CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  business_id INTEGER,
  text TEXT,
  is_from_business BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
