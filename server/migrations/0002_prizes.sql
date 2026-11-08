CREATE TABLE prizes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  value INTEGER CHECK (value IS NULL OR value >= 1),
  winners INTEGER NOT NULL CHECK (winners >= 1),
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'premium')),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
