// Bitácora intentos_login. Solo SQL parametrizado.
// Aquí NUNCA entra la contraseña enviada, ni en claro ni hasheada: la
// función ni siquiera la recibe como parámetro.
const { pool } = require('../config/db');

const LARGO_USERNAME = 50; // VARCHAR(50) en la tabla
const LARGO_MOTIVO = 80;   // VARCHAR(80)

async function registrar(usernameIntentado, ip, exitoso, motivo = null) {
  await pool.query(
    `INSERT INTO intentos_login (username_intentado, ip_origen, exitoso, motivo)
     VALUES ($1, $2::inet, $3, $4)`,
    [
      String(usernameIntentado ?? '').slice(0, LARGO_USERNAME),
      ip,
      Boolean(exitoso),
      motivo === null ? null : String(motivo).slice(0, LARGO_MOTIVO),
    ]
  );
}

// Últimos intentos, opcionalmente de un solo usuario. Para evidencia y pruebas.
async function listarRecientes(limite = 20, username = null) {
  const { rows } = await pool.query(
    `SELECT id, username_intentado, host(ip_origen) AS ip_origen, exitoso, motivo, ocurrido_en
       FROM intentos_login
      WHERE $2::varchar IS NULL OR username_intentado = $2
   ORDER BY ocurrido_en DESC, id DESC
      LIMIT $1`,
    [limite, username]
  );
  return rows;
}

module.exports = { registrar, listarRecientes };
