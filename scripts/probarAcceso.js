// Matriz de control de acceso: cada ruta protegida en tres escenarios
// (sin sesión, sesión de rol Usuario, sesión de rol Administrador).
//
// Uso:
//   PRUEBA_USUARIO1=admin PRUEBA_CLAVE1='...' PRUEBA_USUARIO2=sophy PRUEBA_CLAVE2='...' \
//     node scripts/probarAcceso.js
//   BASE_URL cambia el servidor (por defecto http://localhost:3000).
//
// USUARIO1 debe ser Administrador y USUARIO2 rol Usuario. Las peticiones
// van con redirect: 'manual' para que un 302 se vea como 302.
require('dotenv').config({ quiet: true });

const http = require('http');
const { baseUrl, iniciarSesion } = require('./comun');

const base = baseUrl();
const admin = { username: process.env.PRUEBA_USUARIO1, password: process.env.PRUEBA_CLAVE1 };
const normal = { username: process.env.PRUEBA_USUARIO2, password: process.env.PRUEBA_CLAVE2 };

if (!admin.username || !admin.password || !normal.username || !normal.password) {
  console.error('Faltan credenciales: PRUEBA_USUARIO1/PRUEBA_CLAVE1 (Administrador) y PRUEBA_USUARIO2/PRUEBA_CLAVE2 (Usuario).');
  process.exit(1);
}

// Ruta -> código esperado en [sin sesión, Usuario, Administrador].
const RUTAS = [
  ['/herramientas/cifrar',         [302, 200, 200]],
  ['/herramientas/analizar',       [302, 200, 200]],
  ['/herramientas/js/cifrado.js',  [302, 200, 200]],
  ['/herramientas/js/ataque.js',   [302, 200, 200]],
  ['/usuarios/nuevo',              [302, 403, 200]],
  ['/herramientas/js/../../.env',  [404, 404, 404]],
];

const ESCENARIOS = ['sin sesión', 'rol Usuario', 'rol Administrador'];

async function pedir(ruta, cookie) {
  const res = await fetch(base + ruta, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  return res.status;
}

// fetch normaliza "/../" antes de enviar (la petición anterior llega al
// servidor como /.env). Esta variante manda la ruta tal cual, byte a byte,
// para comprobar que el servidor tampoco la resuelve.
function pedirCruda(ruta, cookie) {
  return new Promise((resolve, reject) => {
    const u = new URL(base);
    const req = http.request(
      { host: u.hostname, port: u.port, path: ruta, method: 'GET', headers: cookie ? { cookie } : {} },
      (res) => { res.resume(); resolve(res.statusCode); }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const cookies = [
    '',
    await iniciarSesion(base, normal.username, normal.password),
    await iniciarSesion(base, admin.username, admin.password),
  ];

  const filas = [];
  for (const [ruta, esperados] of RUTAS) {
    const codigos = [];
    for (let i = 0; i < 3; i++) codigos.push(await pedir(ruta, cookies[i]));
    filas.push([ruta, esperados, codigos]);
  }

  // Misma ruta con "..", enviada sin normalizar.
  const cruda = RUTAS[RUTAS.length - 1];
  const codigosCrudos = [];
  for (let i = 0; i < 3; i++) codigosCrudos.push(await pedirCruda(cruda[0], cookies[i]));
  filas.push([cruda[0] + '  (sin normalizar)', cruda[1], codigosCrudos]);

  const ancho = Math.max(...filas.map((f) => f[0].length));
  console.log(`Servidor: ${base}   Usuario: ${normal.username}   Administrador: ${admin.username}\n`);
  console.log(`  ${'ruta'.padEnd(ancho)}  ${ESCENARIOS.map((e) => e.padStart(17)).join('  ')}`);

  let fallos = 0;
  for (const [ruta, esperados, codigos] of filas) {
    const celdas = codigos.map((c, i) => {
      const ok = c === esperados[i];
      if (!ok) fallos++;
      return `${ok ? ' ' : '!'}${c}`.padStart(17);
    });
    console.log(`  ${ruta.padEnd(ancho)}  ${celdas.join('  ')}`);
  }

  console.log(fallos === 0
    ? '\nCorrecto: la matriz de acceso coincide con lo esperado.'
    : `\n${fallos} celda(s) marcadas con ! no coinciden con lo esperado.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
