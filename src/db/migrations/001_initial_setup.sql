CREATE TABLE IF NOT EXISTS chat_configs
(
    chat_id            TEXT PRIMARY KEY,
    api_key_encrypted  TEXT NOT NULL,
    updated_by_user_id TEXT NOT NULL,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);
