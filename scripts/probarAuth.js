// Prueba del paso 2: bcrypt.compare contra los usuarios sembrados.
// Uso: node scripts/probarAuth.js
require('dotenv').config({ quiet: true });

const { pool, verificarConexion } = require('../src/config/db');
const authService = require('../src/services/authService');

const CASOS = [
  ['admin', 'Admin2026*', true],
  ['sophy', 'Sophy2026*', true],
  ['admin', 'contraseña-mala', false],
  ['sophy', 'Admin2026*', false],
  ['noexiste', 'loquesea', false],
];

async function main() {
  await verificarConexion();

  let fallos = 0;
  for (const [username, password, esperado] of CASOS) {
    const inicio = process.hrtime.bigint();
    const r = await authService.verificarCredenciales(username, password);
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;

    const correcto = r.ok === esperado;
    if (!correcto) fallos++;

    const detalle = r.ok
      ? `usuario #${r.usuario.id} rol=${r.usuario.rol}`
      : `motivo=${r.motivo} mensaje="${r.mensaje}"`;
    console.log(`${correcto ? 'OK ' : 'MAL'}  ${username.padEnd(9)} ${String(r.ok).padEnd(5)} ${ms.toFixed(0).padStart(4)} ms  ${detalle}`);
  }

  await pool.end();
  console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} caso(s) con resultado inesperado.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
