const { pool } = require('./config/db');
async function run() {
  try {
    const res = await pool.query(`
      SELECT 
        table_name, column_name, data_type, character_maximum_length, is_nullable
      FROM 
        information_schema.columns
      WHERE 
        table_name IN ('users', 'profiles');
    `);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
