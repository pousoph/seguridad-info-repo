// Pool de conexiones a PostgreSQL.
// Las credenciales salen únicamente de las variables de entorno (.env).
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Un error en un cliente inactivo no debe tumbar el proceso.
pool.on('error', (err) => {
  console.error('[db] Error en un cliente inactivo del pool:', err.message);
});

// Comprueba que la base responde. Lanza un error descriptivo si no conecta.
async function verificarConexion() {
  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    if (rows[0].ok !== 1) throw new Error('SELECT 1 devolvió un valor inesperado');
  } catch (err) {
    // Un ECONNREFUSED llega como AggregateError con message vacío.
    const detalle = err.message || err.code || (err.errors && err.errors[0] && err.errors[0].message) || String(err);
    throw new Error(
      `No se pudo conectar a PostgreSQL (${process.env.PGUSER}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}): ${detalle}`
    );
  }
}

module.exports = { pool, verificarConexion };
