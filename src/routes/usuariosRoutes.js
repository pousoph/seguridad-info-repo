// Alta de usuarios. Solo Administrador; el rol se comprueba en la sesión.
const express = require('express');
const { body, validationResult } = require('express-validator');

const authService = require('../services/authService');
const rolRepo = require('../repositories/rolRepo');
const { requiereSesion, requiereRol } = require('../middleware/requiereSesion');
const { verificarCsrf } = require('../middleware/csrf');

const router = express.Router();

const USERNAME_MIN = 3;
const USERNAME_MAX = 50;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 200;

const soloAdmin = [requiereSesion, requiereRol('Administrador')];

async function renderFormulario(res, { status = 200, error = null, exito = null, valores = {} } = {}) {
  const roles = await rolRepo.listar();
  res.status(status).renderVista('usuarios/nuevo', {
    titulo: 'Nuevo usuario',
    activa: '/usuarios/nuevo',
    roles,
    error,
    exito,
    valores: { username: '', rol_id: '', ...valores },
    limites: { USERNAME_MIN, USERNAME_MAX, PASSWORD_MIN },
  });
}

router.get('/usuarios/nuevo', ...soloAdmin, async (req, res, next) => {
  try {
    await renderFormulario(res);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/usuarios',
  ...soloAdmin,
  verificarCsrf,
  body('username')
    .isString().withMessage('El nombre de usuario es obligatorio.')
    .trim()
    .isLength({ min: USERNAME_MIN, max: USERNAME_MAX })
    .withMessage(`El nombre de usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`)
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('El nombre de usuario solo admite letras, números, punto, guion y guion bajo.'),
  body('password')
    .isString().withMessage('La contraseña es obligatoria.')
    .isLength({ min: PASSWORD_MIN, max: PASSWORD_MAX })
    .withMessage(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`),
  body('rol_id')
    .isInt({ min: 1 }).withMessage('Elige un rol.')
    .toInt(),
  async (req, res, next) => {
    const valores = {
      username: typeof req.body.username === 'string' ? req.body.username.trim() : '',
      rol_id: req.body.rol_id,
    };

    try {
      const errores = validationResult(req);
      if (!errores.isEmpty()) {
        return await renderFormulario(res, { status: 400, error: errores.array()[0].msg, valores });
      }

      // El rol debe ser uno de la tabla, no cualquier entero.
      const roles = await rolRepo.listar();
      const rol = roles.find((r) => r.id === valores.rol_id);
      if (!rol) {
        return await renderFormulario(res, { status: 400, error: 'Elige un rol.', valores });
      }

      const resultado = await authService.registrarUsuario(valores.username, req.body.password, rol.id);

      if (!resultado.ok) {
        return await renderFormulario(res, {
          status: 409,
          error: `Ya existe un usuario llamado "${valores.username}". Elige otro nombre.`,
          valores,
        });
      }

      await renderFormulario(res, {
        exito: `Usuario "${resultado.usuario.username}" creado con el rol ${rol.nombre}.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
