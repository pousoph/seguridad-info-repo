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

// Parseo de formularios (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: false }));

// Estáticos públicos. private/ NO se sirve desde aquí: irá detrás del guardián.
app.use(express.static(path.join(__dirname, '..', 'public')));

module.exports = app;
