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

CREATE INDEX IF NOT EXISTS trades_user_email_idx  ON trades(user_email);
CREATE INDEX IF NOT EXISTS trades_trade_id_idx    ON trades(trade_id);
CREATE INDEX IF NOT EXISTS trades_order_number_idx ON trades(order_number);
CREATE INDEX IF NOT EXISTS trades_email_id_idx    ON trades(email_id);

CREATE TABLE IF NOT EXISTS sync_meta (
  user_email TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  PRIMARY KEY (user_email, key)
);
