-- Run this in the Neon SQL editor to set up the database schema.

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  passcode   TEXT,
  avatar     TEXT,
  provider   TEXT NOT NULL DEFAULT 'local',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id                   SERIAL PRIMARY KEY,
  user_email           TEXT NOT NULL,
  email_id             TEXT,
  order_number         TEXT,
  trade_id             TEXT,
  symbol               TEXT NOT NULL,
  order_type           TEXT NOT NULL,
  quantity             NUMERIC,
  gross_consideration  NUMERIC,
  processing_fee       NUMERIC,
  net_consideration    NUMERIC,
  price_per_share      NUMERIC,
  settlement_date      TEXT,
  execution_date       TEXT,
  status               TEXT,
  source               TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trades_user_email_idx   ON trades(user_email);
CREATE INDEX IF NOT EXISTS trades_trade_id_idx     ON trades(trade_id);
CREATE INDEX IF NOT EXISTS trades_order_number_idx ON trades(order_number);
CREATE INDEX IF NOT EXISTS trades_email_id_idx     ON trades(email_id);

-- Dedup constraints: one trade_id per user, one email_id per user (NULLs exempt).
-- The API bulk-insert already catches individual errors, so violations are silently skipped.
CREATE UNIQUE INDEX IF NOT EXISTS trades_trade_id_unique ON trades(user_email, trade_id) WHERE trade_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trades_email_id_unique ON trades(user_email, email_id) WHERE email_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_meta (
  user_email TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  PRIMARY KEY (user_email, key)
);

CREATE TABLE IF NOT EXISTS comments (
  id           SERIAL PRIMARY KEY,
  symbol       TEXT NOT NULL,
  user_email   TEXT NOT NULL,
  display_name TEXT NOT NULL,
  body         TEXT NOT NULL CHECK (char_length(body) <= 280),
  parent_id    INT REFERENCES comments(id) ON DELETE CASCADE,
  is_holder    BOOLEAN NOT NULL DEFAULT TRUE,
  flagged      BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_symbol_idx ON comments(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_id);
