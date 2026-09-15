// Protección CSRF con token sincronizado: se genera en el servidor, se
// guarda en la sesión y viaja como campo oculto en cada formulario.
// Un sitio ajeno no puede leer el token (distinto origen), así que no
// puede fabricar un POST válido aunque el navegador adjunte la cookie.
const crypto = require('crypto');

// Genera el token si la sesión aún no tiene uno y lo expone a las vistas.
function inyectarCsrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

// Valida el token en peticiones que modifican estado (POST).
function verificarCsrf(req, res, next) {
  const esperado = req.session.csrfToken;
  const recibido = typeof req.body?._csrf === 'string' ? req.body._csrf : '';

  const valido =
    Boolean(esperado) &&
    recibido.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));

  if (!valido) {
    return res.status(403).renderVista('error', {
      titulo: 'Petición rechazada',
      codigo: 403,
      mensaje: 'El formulario caducó o no es válido. Vuelve a intentarlo.',
    });
  }
  next();
}

// Tras autenticar se cambia el token: el anterior podía ser conocido.
function rotarCsrf(req) {
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
}

module.exports = { inyectarCsrf, verificarCsrf, rotarCsrf };
