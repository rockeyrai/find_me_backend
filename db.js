const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Helper for RLS transactions
const withUserTransaction = async (userId, callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      // Inject user ID for RLS policies
      await client.query('SET LOCAL app.current_user = $1', [userId]);
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { pool, withUserTransaction };