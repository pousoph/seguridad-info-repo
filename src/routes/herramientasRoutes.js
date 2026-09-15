// Herramientas del taller anterior, ahora detrás del guardián.
// Las páginas Y sus scripts pasan por requiereSesion / requiereRol: si
// analizar exige Administrador pero ataque.js se pudiera descargar desde
// public/, la protección sería decorativa.
const path = require('path');
const express = require('express');

const { requiereSesion, requiereRol } = require('../middleware/requiereSesion');

const router = express.Router();

const DIR_JS = path.join(__dirname, '..', '..', 'private', 'js');

// Scripts por nivel de acceso. Lista cerrada: solo se sirve lo que está aquí.
const JS_SESION = ['alfabeto.js', 'cifrado.js', 'app.js'];
const JS_ADMIN = ['analisis.js', 'ataque.js'];

// Orden de carga original: app.js va el último porque orquesta al resto.
const SCRIPTS_CIFRAR = ['alfabeto.js', 'cifrado.js', 'app.js'];
const SCRIPTS_ANALIZAR = ['alfabeto.js', 'cifrado.js', 'analisis.js', 'ataque.js', 'app.js'];

const rutaJs = (archivo) => `/herramientas/js/${archivo}`;

// Cifrado: cualquier usuario autenticado.
router.get('/herramientas/cifrar', requiereSesion, (req, res) => {
  res.renderVista('herramientas/cifrar', {
    titulo: 'Cifrar',
    scripts: SCRIPTS_CIFRAR.map(rutaJs),
  });
});

// Criptoanálisis: solo Administrador.
router.get('/herramientas/analizar', requiereSesion, requiereRol('Administrador'), (req, res) => {
  res.renderVista('herramientas/analizar', {
    titulo: 'Analizar',
    scripts: SCRIPTS_ANALIZAR.map(rutaJs),
  });
});

// Entrega un script de private/js. El nombre sale de la lista cerrada de
// arriba (nunca de un parámetro libre), así que no hay recorrido de rutas.
function servirJs(req, res, next) {
  res.sendFile(path.basename(req.path), {
    root: DIR_JS,
    headers: { 'Cache-Control': 'private, no-store' },
  }, (err) => { if (err) next(err); });
}

router.get(JS_SESION.map(rutaJs), requiereSesion, servirJs);
router.get(JS_ADMIN.map(rutaJs), requiereSesion, requiereRol('Administrador'), servirJs);

module.exports = router;
