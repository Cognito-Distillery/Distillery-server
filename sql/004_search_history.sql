CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maltster_id UUID NOT NULL REFERENCES maltsters(id),
  query TEXT NOT NULL,
  mode TEXT NOT NULL,
  result_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX search_history_maltster_idx ON search_history(maltster_id, created_at);
