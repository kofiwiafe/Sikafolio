-- Migration: add server-side dedup constraints to the trades table.
-- Run once in the Neon SQL editor.
-- Safe to re-run (IF NOT EXISTS guards); no-op if constraints already exist.

-- Remove any accidental duplicates before creating the unique indexes.
-- This keeps the row with the lowest id for each (user_email, trade_id) pair.
DELETE FROM trades
WHERE id NOT IN (
  SELECT MIN(id) FROM trades WHERE trade_id IS NOT NULL GROUP BY user_email, trade_id
)
AND trade_id IS NOT NULL;

-- Same for email_id.
DELETE FROM trades
WHERE id NOT IN (
  SELECT MIN(id) FROM trades WHERE email_id IS NOT NULL GROUP BY user_email, email_id
)
AND email_id IS NOT NULL;

-- Now create the unique partial indexes (NULLs are always allowed).
CREATE UNIQUE INDEX IF NOT EXISTS trades_trade_id_unique ON trades(user_email, trade_id) WHERE trade_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trades_email_id_unique ON trades(user_email, email_id) WHERE email_id IS NOT NULL;
