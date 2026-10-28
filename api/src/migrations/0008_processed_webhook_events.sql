-- Webhook PMH ID idempotent theo event_id: retry/replay không xử lý hai lần.
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);
