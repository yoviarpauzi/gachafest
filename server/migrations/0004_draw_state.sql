-- What the big screen is showing right now, in one row. The winner is already saved when the phase becomes
-- 'reveal'; the animation is the clients' business, timed from revealed_at.
CREATE TABLE draw_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL DEFAULT 'idle' CHECK (phase IN ('idle', 'standby', 'reveal')),
  selected_prize_id INTEGER REFERENCES prizes(id) ON DELETE SET NULL,
  winner_id INTEGER REFERENCES winners(id) ON DELETE RESTRICT,
  revealed_at TEXT,
  skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1)),
  reel TEXT
);

INSERT INTO draw_state (id) VALUES (1);
