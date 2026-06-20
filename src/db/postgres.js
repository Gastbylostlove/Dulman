import fs from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;

/**
 * Creates a Postgres-backed repository.
 *
 * @param {object} options
 * @param {string} options.connectionString
 * @param {boolean} [options.ssl=false]
 * @returns {Promise<object>}
 */
export async function createPostgresRepository({ connectionString, ssl = false } = {}) {
  if (!connectionString) {
    throw new Error("connectionString is required");
  }

  const pool = new Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : false,
  });

  const authFailures = new Map();
  const inviteFailures = new Map();

  const repository = createRepository((sql, params) => pool.query(sql, params), authFailures, inviteFailures);

  return {
    pool,
    authFailures,
    inviteFailures,
    ...repository,
    async withTransaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txRepository = createRepository((sql, params) => client.query(sql, params), authFailures, inviteFailures);
        const result = await work(txRepository);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async migrate() {
      const schemaPath = new URL("../../db/schema.sql", import.meta.url);
      const sql = await fs.readFile(schemaPath, "utf8");
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

function createRepository(query, authFailures, inviteFailures) {
  return {
    authFailures,
    inviteFailures,
    async findUser(loginId) {
      const { rows } = await query(
        `SELECT login_id, password_hash, current_device_id, current_refresh_token, created_at
         FROM user_account
         WHERE login_id = $1`,
        [loginId],
      );
      return rows[0] ? normalizeUserRow(rows[0]) : null;
    },
    async insertUser(record) {
      const { rows } = await query(
        `INSERT INTO user_account (
           login_id, password_hash, current_device_id, current_refresh_token, created_at
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING login_id, password_hash, current_device_id, current_refresh_token, created_at`,
        [
          record.login_id,
          record.password_hash,
          record.current_device_id,
          record.current_refresh_token,
          record.created_at,
        ],
      );
      return rows[0] ? normalizeUserRow(rows[0]) : null;
    },
    async updateUser(loginId, patch) {
      return updateOne(
        query,
        "user_account",
        "login_id",
        loginId,
        patch,
        "login_id, password_hash, current_device_id, current_refresh_token, created_at",
      );
    },
    async findChatById(chatId) {
      const { rows } = await query(
        `SELECT id, user_a_id, user_b_id, status, invite_code, last_reset_at, created_at, ended_at, ended_by_user_id
         FROM chat
         WHERE id = $1`,
        [chatId],
      );
      return rows[0] ? normalizeChatRow(rows[0]) : null;
    },
    async findChatByInviteCode(inviteCode) {
      const { rows } = await query(
        `SELECT id, user_a_id, user_b_id, status, invite_code, last_reset_at, created_at, ended_at, ended_by_user_id
         FROM chat
         WHERE invite_code = $1`,
        [inviteCode],
      );
      return rows[0] ? normalizeChatRow(rows[0]) : null;
    },
    async findActiveChatByParticipant(loginId) {
      const { rows } = await query(
        `SELECT id, user_a_id, user_b_id, status, invite_code, last_reset_at, created_at, ended_at, ended_by_user_id
         FROM chat
         WHERE status = 'active' AND (user_a_id = $1 OR user_b_id = $1)
         ORDER BY id ASC
         LIMIT 1`,
        [loginId],
      );
      return rows[0] ? normalizeChatRow(rows[0]) : null;
    },
    async insertChat(record) {
      const { rows } = await query(
        `INSERT INTO chat (
           user_a_id, user_b_id, status, invite_code, last_reset_at, created_at, ended_at, ended_by_user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, user_a_id, user_b_id, status, invite_code, last_reset_at, created_at, ended_at, ended_by_user_id`,
        [
          record.user_a_id,
          record.user_b_id,
          record.status,
          record.invite_code,
          record.last_reset_at,
          record.created_at,
          record.ended_at,
          record.ended_by_user_id,
        ],
      );
      return rows[0] ? normalizeChatRow(rows[0]) : null;
    },
    async updateChat(chatId, patch) {
      return updateOne(
        query,
        "chat",
        "id",
        chatId,
        patch,
        "id, user_a_id, user_b_id, status, invite_code, last_reset_at, created_at, ended_at, ended_by_user_id",
      );
    },
    async listMessagesByChatId(chatId) {
      const { rows } = await query(
        `SELECT id, chat_id, sender_id, type, text_content, permission_type, view_count, created_at
         FROM message
         WHERE chat_id = $1
         ORDER BY id ASC`,
        [chatId],
      );
      return rows.map(normalizeMessageRow);
    },
    async findMessageById(messageId) {
      const { rows } = await query(
        `SELECT id, chat_id, sender_id, type, text_content, permission_type, view_count, created_at
         FROM message
         WHERE id = $1`,
        [messageId],
      );
      return rows[0] ? normalizeMessageRow(rows[0]) : null;
    },
    async insertMessage(record) {
      const { rows } = await query(
        `INSERT INTO message (
           chat_id, sender_id, type, text_content, permission_type, view_count, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, chat_id, sender_id, type, text_content, permission_type, view_count, created_at`,
        [
          record.chat_id,
          record.sender_id,
          record.type,
          record.text_content,
          record.permission_type,
          record.view_count,
          record.created_at,
        ],
      );
      return rows[0] ? normalizeMessageRow(rows[0]) : null;
    },
    async updateMessage(messageId, patch) {
      return updateOne(
        query,
        "message",
        "id",
        messageId,
        patch,
        "id, chat_id, sender_id, type, text_content, permission_type, view_count, created_at",
      );
    },
    async listMediaByMessageId(messageId) {
      const { rows } = await query(
        `SELECT id, message_id, url, mime_type, created_at
         FROM media
         WHERE message_id = $1
         ORDER BY id ASC`,
        [messageId],
      );
      return rows.map(normalizeMediaRow);
    },
    async insertMedia(record) {
      const { rows } = await query(
        `INSERT INTO media (message_id, url, mime_type, created_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, message_id, url, mime_type, created_at`,
        [record.message_id, record.url, record.mime_type, record.created_at],
      );
      return rows[0] ? normalizeMediaRow(rows[0]) : null;
    },
    async insertResetLog(record) {
      const { rows } = await query(
        `INSERT INTO chat_reset_log (chat_id, reset_by_user_id, reset_at)
         VALUES ($1, $2, $3)
         RETURNING id, chat_id, reset_by_user_id, reset_at`,
        [record.chat_id, record.reset_by_user_id, record.reset_at],
      );
      return rows[0] ? normalizeResetLogRow(rows[0]) : null;
    },
  };
}

async function updateOne(query, table, keyColumn, keyValue, patch, returningClause) {
  const entries = Object.entries(patch);
  if (entries.length === 0) {
    return null;
  }

  const sets = [];
  const values = [];
  let index = 1;
  for (const [key, value] of entries) {
    sets.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  }
  values.push(keyValue);

  const { rows } = await query(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE ${keyColumn} = $${index} RETURNING ${returningClause}`,
    values,
  );
  if (!rows[0]) return null;
  if (table === "user_account") return normalizeUserRow(rows[0]);
  if (table === "chat") return normalizeChatRow(rows[0]);
  if (table === "message") return normalizeMessageRow(rows[0]);
  return rows[0];
}

function normalizeUserRow(row) {
  return { ...row };
}

function normalizeChatRow(row) {
  return {
    ...row,
    id: toNumber(row.id),
  };
}

function normalizeMessageRow(row) {
  return {
    ...row,
    id: toNumber(row.id),
    chat_id: toNumber(row.chat_id),
    view_count: toNumber(row.view_count),
  };
}

function normalizeMediaRow(row) {
  return {
    ...row,
    id: toNumber(row.id),
    message_id: toNumber(row.message_id),
  };
}

function normalizeResetLogRow(row) {
  return {
    ...row,
    id: toNumber(row.id),
    chat_id: toNumber(row.chat_id),
  };
}

function toNumber(value) {
  return typeof value === "string" ? Number(value) : value;
}
