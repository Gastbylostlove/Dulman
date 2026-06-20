/**
 * Removes data created by integration tests using the provided login-id prefix.
 *
 * @param {import('pg').Pool} pool
 * @param {string} prefix
 * @returns {Promise<void>}
 */
export async function cleanupTestData(pool, prefix) {
  const like = `${prefix}%`;
  await pool.query(
    `DELETE FROM chat_reset_log
     WHERE chat_id IN (
       SELECT id FROM chat
       WHERE user_a_id LIKE $1 OR user_b_id LIKE $1 OR ended_by_user_id LIKE $1
     )`,
    [like],
  );
  await pool.query(
    `DELETE FROM media
     WHERE message_id IN (
       SELECT id FROM message
       WHERE chat_id IN (
         SELECT id FROM chat
         WHERE user_a_id LIKE $1 OR user_b_id LIKE $1 OR ended_by_user_id LIKE $1
       )
     )`,
    [like],
  );
  await pool.query(
    `DELETE FROM message
     WHERE chat_id IN (
       SELECT id FROM chat
       WHERE user_a_id LIKE $1 OR user_b_id LIKE $1 OR ended_by_user_id LIKE $1
     )`,
    [like],
  );
  await pool.query(
    `DELETE FROM chat
     WHERE user_a_id LIKE $1 OR user_b_id LIKE $1 OR ended_by_user_id LIKE $1 OR invite_code LIKE $1`,
    [like],
  );
  await pool.query(
    `DELETE FROM user_account
     WHERE login_id LIKE $1`,
    [like],
  );
}
