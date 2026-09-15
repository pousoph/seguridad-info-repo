// Utilidades compartidas por los scripts de prueba: cookie de sesión,
// token CSRF e inicio de sesión contra un servidor en marcha.

function baseUrl(explicita) {
  return (explicita || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// La cookie "sid" que devuelve el servidor, lista para reenviar.
function extraerCookie(res) {
  const set = res.headers.get('set-cookie') || '';
  const m = set.match(/(?:^|,\s*)(sid=[^;]+)/);
  return m ? m[1] : '';
}

function extraerToken(html) {
  return (html.match(/name="_csrf" value="([^"]+)"/) || [])[1] || '';
}

function extraerAviso(html) {
  const m = html.match(/role="alert">([^<]*)</);
  return m ? m[1] : '';
}

// Sesión anónima: GET /login entrega cookie y token CSRF. Sin ellos,
// cualquier POST devuelve 403.
async function sesionAnonima(base) {
  const res = await fetch(`${base}/login`);
  const cookie = extraerCookie(res);
  const token = extraerToken(await res.text());
  if (!cookie || !token) {
    throw new Error(`No se pudo obtener cookie y token CSRF de ${base}/login (¿está el servidor en marcha?)`);
  }
  return { cookie, token };
}

// Inicia sesión y devuelve la cookie de la sesión autenticada (la que
// entrega el servidor tras regenerate). Lanza error si el login falla.
async function iniciarSesion(base, username, password) {
  const { cookie, token } = await sesionAnonima(base);
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ _csrf: token, username, password }),
    redirect: 'manual',
  });
  if (res.status !== 302) {
    const aviso = extraerAviso(await res.text());
    throw new Error(`Login de "${username}" falló: ${res.status}${aviso ? ` (${aviso})` : ''}`);
  }
  const nueva = extraerCookie(res);
  if (!nueva) throw new Error(`Login de "${username}" no devolvió cookie de sesión`);
  return nueva;
}

module.exports = { baseUrl, extraerCookie, extraerToken, extraerAviso, sesionAnonima, iniciarSesion };
