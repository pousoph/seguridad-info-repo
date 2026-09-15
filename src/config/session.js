// Configuración de express-session.
// La sesión vive en el servidor; al navegador solo viaja el id en la cookie.
const session = require('express-session');

if (!process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en el entorno (.env)');
}

module.exports = session({
  name: 'sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,               // el JS del cliente no puede leerla
    sameSite: 'lax',              // no viaja en POST desde otros orígenes
    secure: process.env.COOKIE_SECURE === 'true', // hoy HTTP: false
    maxAge: 30 * 60 * 1000,       // 30 minutos de inactividad
  },
});
