// Consultas sobre la tabla usuarios.
// Solo SQL: no conoce bcrypt ni HTTP. Todas las consultas van parametrizadas.
const { pool } = require('../config/db');

// Devuelve el usuario con el nombre de su rol, o null si no existe.
// El estado de bloqueo se calcula con el reloj de la base (now()), no con
// el del proceso Node, para que no importe un desfase entre máquinas.
async function buscarPorUsername(username) {
  const { rows } = await pool.query(
    `SELECT u.id,
            u.username,
            u.password_hash,
            r.nombre AS rol,
            u.intentos_fallidos,
            u.bloqueado_hasta,
            COALESCE(u.bloqueado_hasta > now(), false) AS bloqueada,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM (u.bloqueado_hasta - now()))))::int AS segundos_bloqueo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE u.username = $1`,
    [username]
  );
  return rows[0] || null;
}

// Capa 2 del bloqueo: por cuenta. Un solo UPDATE atómico:
//  - suma 1 a intentos_fallidos;
//  - si con eso llega a maxIntentos, fija bloqueado_hasta = now() + cooldown
//    y devuelve el contador a 0.
// Devuelve el estado resultante.
async function registrarFallo(id, maxIntentos, cooldownMinutos) {
  const { rows } = await pool.query(
    `UPDATE usuarios
        SET intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0
                                     ELSE intentos_fallidos + 1 END,
            bloqueado_hasta   = CASE WHEN intentos_fallidos + 1 >= $2
                                     THEN now() + ($3::int * interval '1 minute')
                                     ELSE bloqueado_hasta END
      WHERE id = $1
  RETURNING intentos_fallidos, bloqueado_hasta`,
    [id, maxIntentos, cooldownMinutos]
  );
  return rows[0] || null;
}

// Login correcto: contador a cero y sin bloqueo.
async function reiniciarIntentos(id) {
  await pool.query(
    `UPDATE usuarios
        SET intentos_fallidos = 0,
            bloqueado_hasta   = NULL
      WHERE id = $1`,
    [id]
  );
}

// Alta de usuario. Recibe el hash ya calculado: este módulo no conoce bcrypt.
// Si el username existe, PostgreSQL lanza el error 23505 (unique_violation)
// y se deja subir tal cual para que el servicio lo traduzca.
async function crear(username, passwordHash, rolId) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (username, password_hash, rol_id)
     VALUES ($1, $2, $3)
  RETURNING id, username, rol_id`,
    [username, passwordHash, rolId]
  );
  return rows[0];
}

module.exports = { buscarPorUsername, registrarFallo, reiniciarIntentos, crear };
