// Prueba de autenticación: bcrypt.compare contra dos usuarios reales de la
// base, midiendo el tiempo de respuesta de cada caso. Las credenciales no
// van en el código: se pasan por argumentos o por variables de entorno.
//
// Uso:
//   node scripts/probarAuth.js <usuario1> <clave1> <usuario2> <clave2>
//   PRUEBA_USUARIO1=admin PRUEBA_CLAVE1='...' PRUEBA_USUARIO2=sophy PRUEBA_CLAVE2='...' \
//     node scripts/probarAuth.js
//
// Cinco casos: las dos contraseñas correctas, las dos incorrectas y un
// usuario inexistente. El tiempo del último debe ser del mismo orden que
// el de los demás (compare señuelo); si fuera mucho menor, se podría
// enumerar usuarios midiendo la respuesta.
//
// Ojo: pasar la contraseña por argumento la deja en el historial de la
// terminal; las variables de entorno evitan eso.
require('dotenv').config({ quiet: true });

const { pool, verificarConexion } = require('../src/config/db');
const authService = require('../src/services/authService');

const [usuario1, clave1, usuario2, clave2] = [
  process.argv[2] || process.env.PRUEBA_USUARIO1,
  process.argv[3] || process.env.PRUEBA_CLAVE1,
  process.argv[4] || process.env.PRUEBA_USUARIO2,
  process.argv[5] || process.env.PRUEBA_CLAVE2,
];

if (!usuario1 || !clave1 || !usuario2 || !clave2) {
  console.error('Faltan credenciales. Uso: node scripts/probarAuth.js <usuario1> <clave1> <usuario2> <clave2>');
  console.error('o variables PRUEBA_USUARIO1, PRUEBA_CLAVE1, PRUEBA_USUARIO2, PRUEBA_CLAVE2.');
  process.exit(1);
}

// La contraseña incorrecta se deriva de la correcta para no inventar nada
// que por casualidad coincida: misma longitud, contenido distinto.
const alterar = (clave) => clave.split('').reverse().join('') + '#';

const CASOS = [
  [usuario1, clave1, true, 'contraseña correcta'],
  [usuario2, clave2, true, 'contraseña correcta'],
  [usuario1, alterar(clave1), false, 'contraseña incorrecta'],
  [usuario2, alterar(clave2), false, 'contraseña incorrecta'],
  ['usuario-que-no-existe', clave1, false, 'usuario inexistente'],
];

async function main() {
  await verificarConexion();

  console.log('      usuario                 caso                    resultado  tiempo  detalle');
  let fallos = 0;
  for (const [username, password, esperado, caso] of CASOS) {
    const inicio = process.hrtime.bigint();
    const r = await authService.verificarCredenciales(username, password);
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;

    const correcto = r.ok === esperado;
    if (!correcto) fallos++;

    const detalle = r.ok
      ? `usuario #${r.usuario.id} rol=${r.usuario.rol}`
      : `motivo=${r.motivo}`;
    console.log(
      `${correcto ? 'OK ' : 'MAL'}  ${username.padEnd(22)}  ${caso.padEnd(22)}  ${String(r.ok).padEnd(9)}  ${ms.toFixed(0).padStart(4)} ms  ${detalle}`
    );
  }

  await pool.end();
  console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} caso(s) con resultado inesperado.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
