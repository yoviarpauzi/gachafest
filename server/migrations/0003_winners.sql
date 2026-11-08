CREATE TABLE winners (
  id INTEGER PRIMARY KEY,
  prize_id INTEGER NOT NULL REFERENCES prizes(id) ON DELETE RESTRICT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  drawn_at TEXT NOT NULL,
  cancelled_at TEXT
);

-- Nobody wins the same prize twice, cancelled or not; the draw checks this too, the index backs it up.
CREATE UNIQUE INDEX winners_prize_participant ON winners (prize_id, participant_id);
CREATE INDEX winners_participant ON winners (participant_id);
