'use strict';

const migrations = [
  {
    version: 1,
    name: 'security_whitelist_users',
    sql: `CREATE TABLE IF NOT EXISTS security_whitelist_users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (guild_id, user_id)
    )`,
  },
  {
    version: 2,
    name: 'moderation_warnings',
    sql: `CREATE TABLE moderation_warnings (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      interaction_id TEXT NOT NULL UNIQUE
    );
    CREATE INDEX moderation_warnings_user_idx ON moderation_warnings (guild_id, user_id, created_at DESC, id DESC)`,
  },
];

async function migrate(pool) {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query('SELECT pg_advisory_xact_lock($1)', [1329340429]);
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const result = await connection.query('SELECT version FROM schema_migrations');
    const applied = new Set(result.rows.map((row) => row.version));
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      await connection.query(migration.sql);
      await connection.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
      console.log(`Đã áp dụng migration ${migration.version}: ${migration.name}`);
    }
    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { migrate };