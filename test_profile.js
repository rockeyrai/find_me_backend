const { pool } = require('./config/db');

async function test() {
  try {
    const userResult = await pool.query("SELECT id FROM users LIMIT 1");
    if (!userResult.rows.length) { console.log("No users"); return; }
    const userId = userResult.rows[0].id;

    console.log("Testing insert into profiles for user:", userId);
    await pool.query(`
      INSERT INTO profiles (user_id, full_name, updated_at) 
      VALUES ($1, 'Test Name', NOW()) 
      ON CONFLICT (user_id) DO UPDATE SET full_name = 'Test Name 2', updated_at = NOW()
    `, [userId]);
    console.log("Profile insert/update success!");
  } catch(e) {
    console.error("DB Error on profiles:", e.message);
  } finally {
    pool.end();
  }
}
test();
