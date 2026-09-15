const express = require('express');
const { body, validationResult } = require('express-validator');

const authService = require('../services/authService');
const { requiereSesion } = require('../middleware/requiereSesion');
const { verificarCsrf, rotarCsrf } = require('../middleware/csrf');
const fuerzaBruta = require('../middleware/proteccionFuerzaBruta');
const intentoRepo = require('../repositories/intentoRepo');

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

// Bitácora (regla 6.10): se anota TODO intento, con su resultado y motivo.
// Nunca recibe la contraseña. Si la base falla al escribir, se registra en
// el log del servidor y el login sigue: la auditoría no tumba la autenticación.
async function anotarIntento(req, username, exitoso, motivo = null) {
  try {
    await intentoRepo.registrar(username, req.ip, exitoso, motivo);
  } catch (err) {
    console.error('[bitacora] No se pudo registrar el intento:', err.message);
  }
}

// Nombre de usuario tal como lo escribió el cliente, recortado para la bitácora.
function usernameEnviado(req) {
  return typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 50) : '';
}

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
  fuerzaBruta.proteccionFuerzaBruta({
    alBloquear: (req) => anotarIntento(req, usernameEnviado(req), false, 'ip_bloqueada'),
  }),
  body('username').isString().trim().isLength({ min: 1, max: 50 }),
  body('password').isString().isLength({ min: 1, max: 200 }),
  async (req, res, next) => {
    const username = usernameEnviado(req);

    if (!validationResult(req).isEmpty()) {
      await anotarIntento(req, username, false, 'datos_invalidos');
      return renderLogin(res, { status: 400, error: 'Usuario y contraseña son obligatorios.', username });
    }

    try {
      const resultado = await authService.verificarCredenciales(username, req.body.password);

      if (!resultado.ok) {
        // El middleware no pudo contar este intento: se cuenta aquí, ya
        // sabiendo que falló. Al quinto, registrarFallo fija el cooldown y
        // el middleware rechazará el sexto con 429.
        fuerzaBruta.registrarFallo(req.ip);
        await anotarIntento(req, username, false, resultado.motivo);

        if (resultado.motivo === 'cuenta_bloqueada') {
          return responderBloqueo(res, resultado.segundosRestantes, username);
        }
        // Mismo mensaje para usuario inexistente y contraseña incorrecta.
        return renderLogin(res, { status: 401, error: resultado.mensaje, username });
      }

      // Login correcto: esta IP vuelve a empezar de cero.
      fuerzaBruta.limpiar(req.ip);
      await anotarIntento(req, username, true);

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
