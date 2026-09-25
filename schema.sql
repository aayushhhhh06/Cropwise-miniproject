CREATE TABLE IF NOT EXISTS crop_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop TEXT NOT NULL,
    area REAL NOT NULL CHECK (area > 0),
    temperature REAL NOT NULL,
    moisture REAL NOT NULL,
    ph REAL NOT NULL,
    organic REAL NOT NULL,
    nitrogen REAL NOT NULL,
    phosphorus REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crop_records_created_at ON crop_records (created_at DESC);
