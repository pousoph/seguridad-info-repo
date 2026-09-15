// Guardianes de acceso. Leen SOLO la sesión del servidor: nunca un campo
// enviado por el cliente decide si alguien está autenticado o qué rol tiene.

// Exige sesión iniciada; si no la hay, manda al formulario de login.
function requiereSesion(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

// Exige además uno de los roles indicados. Se usa después de requiereSesion.
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (rolesPermitidos.includes(req.session.rol)) {
      return next();
    }
    res.status(403).renderVista('error', {
      titulo: 'Acceso denegado',
      codigo: 403,
      mensaje: 'Tu cuenta no tiene permiso para ver esta página.',
    });
  };
}

module.exports = { requiereSesion, requiereRol };
