const express = require('express');
const { body, validationResult } = require('express-validator');

const authService = require('../services/authService');
const { requiereSesion } = require('../middleware/requiereSesion');
const { verificarCsrf, rotarCsrf } = require('../middleware/csrf');
const fuerzaBruta = require('../middleware/proteccionFuerzaBruta');

const router = express.Router();

function renderLogin(res, { status = 200, error = null, username = '' } = {}) {
  res.status(status).renderVista('login', {
    titulo: 'Iniciar sesión',
    activa: '/login',
    error,
    username,
  });
}

// GET /login: formulario. Con sesión activa no tiene sentido mostrarlo.
router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/panel');
  }
  renderLogin(res);
});

// Respuesta de bloqueo. Es la MISMA para la capa por IP y la capa por
// cuenta: 429, Retry-After y el mismo texto, sin revelar si la cuenta existe.
function responderBloqueo(res, segundos, username) {
  res.set('Retry-After', String(segundos));
  renderLogin(res, { status: 429, error: fuerzaBruta.mensajeBloqueo(segundos), username });
}

// POST /api/login: autenticación. Todo se decide aquí, en el servidor.
// Orden: CSRF -> bloqueo por IP -> validación -> bloqueo por cuenta y bcrypt.
router.post(
  '/api/login',
  verificarCsrf,
  fuerzaBruta.proteccionFuerzaBruta,
  body('username').isString().trim().isLength({ min: 1, max: 50 }),
  body('password').isString().isLength({ min: 1, max: 200 }),
  async (req, res, next) => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';

    if (!validationResult(req).isEmpty()) {
      return renderLogin(res, { status: 400, error: 'Usuario y contraseña son obligatorios.', username });
    }

    try {
      const resultado = await authService.verificarCredenciales(username, req.body.password);

      if (!resultado.ok) {
        // El middleware no pudo contar este intento: se cuenta aquí, ya
        // sabiendo que falló. Al quinto, registrarFallo fija el cooldown y
        // el middleware rechazará el sexto con 429.
        fuerzaBruta.registrarFallo(req.ip);

        if (resultado.motivo === 'cuenta_bloqueada') {
          return responderBloqueo(res, resultado.segundosRestantes, username);
        }
        // Mismo mensaje para usuario inexistente y contraseña incorrecta.
        return renderLogin(res, { status: 401, error: resultado.mensaje, username });
      }

      // Login correcto: esta IP vuelve a empezar de cero.
      fuerzaBruta.limpiar(req.ip);

      // Sesión nueva al autenticar: la anterior (anónima) podía estar fijada
      // por un atacante. Solo después se guardan los datos del usuario.
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.userId = resultado.usuario.id;
        req.session.username = resultado.usuario.username;
        req.session.rol = resultado.usuario.rol;
        rotarCsrf(req);
        req.session.save((err2) => {
          if (err2) return next(err2);
          res.redirect('/panel');
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /logout: destruye la sesión en el servidor y borra la cookie.
router.post('/logout', requiereSesion, verificarCsrf, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');
    res.redirect('/');
  });
});

// GET /panel: contenido según el rol guardado en la sesión.
router.get('/panel', requiereSesion, (req, res) => {
  res.renderVista('panel', {
    titulo: 'Panel',
    activa: '/panel',
    esAdministrador: req.session.rol === 'Administrador',
  });
});

module.exports = router;
