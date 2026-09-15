// Prueba del bloqueo: siete intentos fallidos seguidos contra un servidor
// en marcha. Los cinco primeros deben responder 401 y del sexto en adelante
// 429 con Retry-After. Al final consulta la bitácora intentos_login y
// muestra las filas que dejó la prueba.
//
// Uso:  node scripts/probarBloqueo.js [usuario] [url]
//       usuario por defecto: "atacante" (inexistente: solo actúa la capa IP)
//       con un usuario real (p. ej. sophy) actúa también la capa por cuenta
//       y la cuenta queda bloqueada 15 min en la base.
//
// Nota: el bloqueo por IP vive en memoria; para repetir la prueba hay que
// reiniciar el servidor o esperar 15 minutos.

require('dotenv').config({ quiet: true });

const { pool } = require('../src/config/db');
const intentoRepo = require('../src/repositories/intentoRepo');

const username = process.argv[2] || 'atacante';
const base = (process.argv[3] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// Cookie de sesión y token CSRF: sin ellos el POST devuelve 403.
function extraerCookie(res) {
  const set = res.headers.get('set-cookie') || '';
  const m = set.match(/(?:^|,\s*)(sid=[^;]+)/);
  return m ? m[1] : '';
}

function extraerAviso(html) {
  const m = html.match(/role="alert">([^<]*)</);
  return m ? m[1] : '';
}

async function main() {
  const inicial = await fetch(`${base}/login`);
  const cookie = extraerCookie(inicial);
  const html = await inicial.text();
  const token = (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];

  if (!cookie || !token) {
    throw new Error(`No se pudo obtener cookie y token CSRF de ${base}/login (¿está el servidor en marcha?)`);
  }

  console.log(`Servidor: ${base}   usuario: ${username}\n`);
  console.log('  #  código  Retry-After  mensaje');

  let fallos = 0;
  for (let i = 1; i <= 7; i++) {
    const res = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
      body: new URLSearchParams({ _csrf: token, username, password: `incorrecta-${i}` }),
      redirect: 'manual',
    });
    const retry = res.headers.get('retry-after') || '-';
    const aviso = extraerAviso(await res.text());

    const esperado = i <= 5 ? 401 : 429;
    const ok = res.status === esperado && (i <= 5 || retry !== '-');
    if (!ok) fallos++;

    console.log(`${ok ? ' ' : '!'} ${String(i).padStart(2)}  ${res.status}     ${retry.padEnd(11)}  ${aviso}`);
  }

  console.log(fallos === 0
    ? '\nCorrecto: 5 x 401 y después 429 con Retry-After.'
    : `\n${fallos} respuesta(s) distintas de lo esperado.`);

  await mostrarBitacora();
  process.exit(fallos === 0 ? 0 : 1);
}

// Evidencia: las filas que la prueba dejó en intentos_login.
async function mostrarBitacora() {
  const filas = await intentoRepo.listarRecientes(7, username);
  await pool.end();

  console.log(`\nBitácora intentos_login (últimos ${filas.length} de "${username}"):\n`);
  console.log('  hora      usuario    ip          resultado  motivo');
  for (const f of filas.reverse()) {
    const hora = new Date(f.ocurrido_en).toLocaleTimeString('es-CO', { hour12: false });
    console.log(`  ${hora}  ${f.username_intentado.padEnd(9)}  ${f.ip_origen.padEnd(10)}  ${(f.exitoso ? 'éxito' : 'fallo').padEnd(9)}  ${f.motivo ?? ''}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
