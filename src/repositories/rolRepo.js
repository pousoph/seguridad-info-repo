// Consultas sobre la tabla roles.
const { pool } = require('../config/db');

async function listar() {
  const { rows } = await pool.query('SELECT id, nombre FROM roles ORDER BY id');
  return rows;
}

module.exports = { listar };
