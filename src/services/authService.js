// Autenticación: hashear y verificar contraseñas con bcrypt.
// No conoce HTTP: recibe cadenas y devuelve resultados; quien lo llame
// decide qué responder al cliente.
const bcrypt = require('bcrypt');
const usuarioRepo = require('../repositories/usuarioRepo');

const COSTO = 10;

// Hash fijo contra el que se compara cuando el usuario NO existe.
// Sin esto la respuesta para un usuario inexistente sería mucho más rápida
// (no hay bcrypt.compare) y un atacante podría enumerar usuarios midiendo
// el tiempo. La comparación siempre falla: el texto original se descartó.
const HASH_SENUELO = '$2b$10$jG.jPM7zcc/2JmroZI2s.O8ERpPxBUC2aLjT.Ci6Nt5yK46O21jJm';

const MENSAJE_GENERICO = 'Usuario o contraseña incorrectos';

// Registro: devuelve la cadena completa "$2b$10$..." que se guarda tal cual.
function hashear(password) {
  return bcrypt.hash(password, COSTO);
}

// Verificación: bcrypt extrae el salt y el costo del propio hash.
function verificar(passwordIngresado, hashAlmacenado) {
  return bcrypt.compare(passwordIngresado, hashAlmacenado);
}

// Comprueba unas credenciales contra la base.
// Devuelve { ok: true, usuario } o { ok: false, motivo, mensaje }.
// `motivo` es para la bitácora interna; `mensaje` es el único texto que
// puede llegar al cliente y es el mismo para ambos fallos.
async function verificarCredenciales(username, password) {
  const usuario = await usuarioRepo.buscarPorUsername(username);

  if (!usuario) {
    await verificar(password, HASH_SENUELO);
    return { ok: false, motivo: 'usuario_inexistente', mensaje: MENSAJE_GENERICO };
  }

  const coincide = await verificar(password, usuario.password_hash);
  if (!coincide) {
    return { ok: false, motivo: 'password_incorrecta', mensaje: MENSAJE_GENERICO };
  }

  // Nunca se devuelve el hash hacia fuera del servicio.
  const { password_hash, ...datos } = usuario;
  return { ok: true, usuario: datos };
}

module.exports = { hashear, verificar, verificarCredenciales, MENSAJE_GENERICO };
