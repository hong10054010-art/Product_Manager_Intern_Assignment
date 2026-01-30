-- Raw feedback table (stored in D1, also backed up to R2)
CREATE TABLE IF NOT EXISTS raw_feedback (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL, -- support_ticket, github_issue, community_discord, email_feedback, twitter
  user_type TEXT,
  country TEXT,
  product_area TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Enriched feedback table (processed by Workers AI, stored in D1)
CREATE TABLE IF NOT EXISTS enriched_feedback (
  id TEXT PRIMARY KEY,
  theme TEXT,
  sentiment TEXT, -- positive, neutral, negative
  urgency TEXT, -- low, medium, high, critical
  value TEXT, -- low, medium, high
  summary TEXT,
  keywords TEXT, -- JSON array of keywords
  processed_at TEXT NOT NULL,
  FOREIGN KEY (id) REFERENCES raw_feedback(id)
);

-- Add missing columns if table exists but is missing columns (for existing databases)
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll handle this in application code if needed

-- Indexes for better query performance
-- Drop indexes first if they exist (to avoid conflicts)
DROP INDEX IF EXISTS idx_raw_feedback_source;
DROP INDEX IF EXISTS idx_raw_feedback_product;
DROP INDEX IF EXISTS idx_raw_feedback_country;
DROP INDEX IF EXISTS idx_raw_feedback_created_at;
DROP INDEX IF EXISTS idx_enriched_feedback_theme;
DROP INDEX IF EXISTS idx_enriched_feedback_sentiment;
DROP INDEX IF EXISTS idx_enriched_feedback_urgency;
DROP INDEX IF EXISTS idx_enriched_feedback_value;

-- Create indexes
CREATE INDEX idx_raw_feedback_source ON raw_feedback(source);
CREATE INDEX idx_raw_feedback_product ON raw_feedback(product_area);
CREATE INDEX idx_raw_feedback_country ON raw_feedback(country);
CREATE INDEX idx_raw_feedback_created_at ON raw_feedback(created_at);
CREATE INDEX idx_enriched_feedback_theme ON enriched_feedback(theme);
CREATE INDEX idx_enriched_feedback_sentiment ON enriched_feedback(sentiment);
CREATE INDEX idx_enriched_feedback_urgency ON enriched_feedback(urgency);
CREATE INDEX idx_enriched_feedback_value ON enriched_feedback(value);
