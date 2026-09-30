-- Shared SoraFiles star ratings (no written reviews): one row per (subject,
-- rater). A subject is a tool id (for example compress-pdf) or "sorafiles" for
-- the whole product. Web and desktop write to the same rows; source is kept
-- for analytics only and never splits an aggregate.
CREATE TABLE IF NOT EXISTS ratings (
  subject TEXT NOT NULL,
  rater TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  source TEXT NOT NULL CHECK (source IN ('web', 'desktop')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (subject, rater)
) WITHOUT ROWID;

-- Authoritative aggregates, maintained only by the triggers below so they can
-- never drift from the stored ratings (each upsert runs in one statement).
CREATE TABLE IF NOT EXISTS rating_totals (
  subject TEXT PRIMARY KEY,
  rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  rating_sum INTEGER NOT NULL DEFAULT 0 CHECK (rating_sum >= 0),
  stars_1 INTEGER NOT NULL DEFAULT 0 CHECK (stars_1 >= 0),
  stars_2 INTEGER NOT NULL DEFAULT 0 CHECK (stars_2 >= 0),
  stars_3 INTEGER NOT NULL DEFAULT 0 CHECK (stars_3 >= 0),
  stars_4 INTEGER NOT NULL DEFAULT 0 CHECK (stars_4 >= 0),
  stars_5 INTEGER NOT NULL DEFAULT 0 CHECK (stars_5 >= 0)
) WITHOUT ROWID;

CREATE TRIGGER IF NOT EXISTS ratings_after_insert AFTER INSERT ON ratings BEGIN
  INSERT INTO rating_totals (subject, rating_count, rating_sum, stars_1, stars_2, stars_3, stars_4, stars_5)
  VALUES (NEW.subject, 1, NEW.rating, NEW.rating = 1, NEW.rating = 2, NEW.rating = 3, NEW.rating = 4, NEW.rating = 5)
  ON CONFLICT (subject) DO UPDATE SET
    rating_count = rating_count + 1,
    rating_sum = rating_sum + NEW.rating,
    stars_1 = stars_1 + (NEW.rating = 1), stars_2 = stars_2 + (NEW.rating = 2), stars_3 = stars_3 + (NEW.rating = 3),
    stars_4 = stars_4 + (NEW.rating = 4), stars_5 = stars_5 + (NEW.rating = 5);
END;

CREATE TRIGGER IF NOT EXISTS ratings_after_update AFTER UPDATE OF rating ON ratings BEGIN
  UPDATE rating_totals SET
    rating_sum = rating_sum - OLD.rating + NEW.rating,
    stars_1 = stars_1 - (OLD.rating = 1) + (NEW.rating = 1), stars_2 = stars_2 - (OLD.rating = 2) + (NEW.rating = 2),
    stars_3 = stars_3 - (OLD.rating = 3) + (NEW.rating = 3), stars_4 = stars_4 - (OLD.rating = 4) + (NEW.rating = 4),
    stars_5 = stars_5 - (OLD.rating = 5) + (NEW.rating = 5)
  WHERE subject = NEW.subject;
END;

CREATE TRIGGER IF NOT EXISTS ratings_after_delete AFTER DELETE ON ratings BEGIN
  UPDATE rating_totals SET
    rating_count = rating_count - 1,
    rating_sum = rating_sum - OLD.rating,
    stars_1 = stars_1 - (OLD.rating = 1), stars_2 = stars_2 - (OLD.rating = 2), stars_3 = stars_3 - (OLD.rating = 3),
    stars_4 = stars_4 - (OLD.rating = 4), stars_5 = stars_5 - (OLD.rating = 5)
  WHERE subject = OLD.subject;
END;

-- Fixed-window write limits per hashed network address (no raw IPs stored).
CREATE TABLE IF NOT EXISTS rating_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  window_end INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS rating_limits_window_idx ON rating_limits(window_end);
