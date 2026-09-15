// Prueba del paso 5: seis intentos fallidos seguidos contra un servidor en
// marcha. Los cinco primeros deben responder 401 y el sexto 429 con
// Retry-After. Se repite el sexto para comprobar que el bloqueo persiste.
//
// Uso:  node scripts/probarBloqueo.js [usuario] [url]
//       usuario por defecto: "atacante" (inexistente: solo actúa la capa IP)
//       con un usuario real (p. ej. sophy) actúa también la capa por cuenta
//       y la cuenta queda bloqueada 15 min en la base.
//
// Nota: el bloqueo por IP vive en memoria; para repetir la prueba hay que
// reiniciar el servidor o esperar 15 minutos.

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
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
