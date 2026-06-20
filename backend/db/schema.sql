CREATE TABLE IF NOT EXISTS user_account (
  login_id varchar(64) PRIMARY KEY,
  password_hash varchar(255) NOT NULL,
  current_device_id varchar(128),
  current_refresh_token varchar(512),
  created_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS chat (
  id bigserial PRIMARY KEY,
  user_a_id varchar(64) NOT NULL,
  user_b_id varchar(64),
  status varchar(16) NOT NULL CHECK (status IN ('waiting', 'active', 'ended')),
  invite_code varchar(32) NOT NULL UNIQUE,
  last_reset_at timestamp,
  created_at timestamp NOT NULL,
  ended_at timestamp,
  ended_by_user_id varchar(64)
);

CREATE TABLE IF NOT EXISTS message (
  id bigserial PRIMARY KEY,
  chat_id bigint NOT NULL,
  sender_id varchar(64) NOT NULL,
  type varchar(16) NOT NULL CHECK (type IN ('text', 'media')),
  text_content text,
  permission_type varchar(32) CHECK (permission_type IN ('once', 'replay_once', 'keep')),
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
  id bigserial PRIMARY KEY,
  message_id bigint NOT NULL,
  url text NOT NULL,
  mime_type varchar(128) NOT NULL,
  created_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_reset_log (
  id bigserial PRIMARY KEY,
  chat_id bigint NOT NULL,
  reset_by_user_id varchar(64) NOT NULL,
  reset_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_user_a_status ON chat (user_a_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_user_b_status ON chat (user_b_id, status);
CREATE INDEX IF NOT EXISTS idx_message_chat_id_id ON message (chat_id, id);
CREATE INDEX IF NOT EXISTS idx_media_message_id ON media (message_id, id);
