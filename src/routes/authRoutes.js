const express = require('express');

const router = express.Router();

// GET /login: formulario. Si ya hay sesión, no tiene sentido mostrarlo.
router.get('/login', (req, res) => {
  // Punto de enganche del paso 4: cuando exista express-session,
  // req.session.userId estará definido tras autenticar.
  if (req.session && req.session.userId) {
    return res.redirect('/panel');
  }

  res.renderVista('login', {
    titulo: 'Iniciar sesión',
    activa: '/login',
    error: null,
    username: '',
    csrfToken: '',
  });
});

module.exports = router;
