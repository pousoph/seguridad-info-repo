// Consultas sobre la tabla usuarios.
// Solo SQL: no conoce bcrypt ni HTTP. Todas las consultas van parametrizadas.
const { pool } = require('../config/db');

// Devuelve el usuario con el nombre de su rol, o null si no existe.
async function buscarPorUsername(username) {
  const { rows } = await pool.query(
    `SELECT u.id,
            u.username,
            u.password_hash,
            r.nombre AS rol,
            u.intentos_fallidos,
            u.bloqueado_hasta
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE u.username = $1`,
    [username]
  );
  return rows[0] || null;
}

module.exports = { buscarPorUsername };
