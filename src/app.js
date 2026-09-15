const path = require('path');
const express = require('express');
const helmet = require('helmet');

const app = express();

// nginx hace proxy hacia Node: sin esto req.ip sería 127.0.0.1 para todos.
app.set('trust proxy', 1);

// El sitio corre sobre HTTP mientras no haya certificado; con
// upgrade-insecure-requests el navegador intentaría cargar todo por HTTPS.
const cookieSecure = process.env.COOKIE_SECURE === 'true';
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        ...(cookieSecure ? {} : { 'upgrade-insecure-requests': null }),
      },
    },
  })
);

// Motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// EJS no tiene herencia de plantillas: res.renderVista renderiza la vista y
// mete el HTML resultante en layout.ejs como `cuerpo`. Toda página pasa por
// aquí, así que la cabecera, la navegación y el pie viven en un solo sitio.
const ENLACES_PUBLICOS = [{ href: '/login', texto: 'Iniciar sesión' }];
app.use((req, res, next) => {
  res.renderVista = (vista, datos = {}) => {
    const locales = { activa: req.path, enlaces: ENLACES_PUBLICOS, ...datos };
    res.render(vista, locales, (err, html) => {
      if (err) return next(err);
      res.render('layout', { ...locales, cuerpo: html });
    });
  };
  next();
});

// Parseo de formularios (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: false }));

// Estáticos públicos. private/ NO se sirve desde aquí: irá detrás del guardián.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas
app.use(require('./routes/authRoutes'));

// 404
app.use((req, res) => {
  res.status(404).renderVista('error', {
    titulo: 'No encontrado',
    codigo: 404,
    mensaje: 'La página que buscas no existe.',
  });
});

// 500: se registra el detalle en el servidor; al cliente nunca llega
// el stack trace ni el error de la base (regla 6.5).
app.use((err, req, res, next) => {
  console.error('[app]', err);
  res.status(500).renderVista('error', {
    titulo: 'Error',
    codigo: 500,
    mensaje: 'Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.',
  });
});

module.exports = app;
