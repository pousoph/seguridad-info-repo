// Autenticación: hashear y verificar contraseñas con bcrypt.
// No conoce HTTP: recibe cadenas y devuelve resultados; quien lo llame
// decide qué responder al cliente.
const bcrypt = require('bcrypt');
const usuarioRepo = require('../repositories/usuarioRepo');

const COSTO = 10;

// Capa 2 del bloqueo (por cuenta): mismos parámetros que la capa por IP.
const MAX_INTENTOS_CUENTA = 5;
const COOLDOWN_CUENTA_MIN = 15;

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

// Comprueba unas credenciales contra la base y mantiene el bloqueo por cuenta.
// Devuelve:
//   { ok: true,  usuario }
//   { ok: false, motivo, mensaje }                       credenciales inválidas
//   { ok: false, motivo: 'cuenta_bloqueada', segundosRestantes }
// `motivo` es para la bitácora interna; `mensaje` es el único texto que
// puede llegar al cliente y es el mismo para usuario inexistente y
// contraseña incorrecta. El caso bloqueado no trae mensaje: quien llama
// responde exactamente igual que en el bloqueo por IP, para que desde
// fuera no se distinga si la cuenta existe.
async function verificarCredenciales(username, password) {
  const usuario = await usuarioRepo.buscarPorUsername(username);

  if (!usuario) {
    await verificar(password, HASH_SENUELO);
    return { ok: false, motivo: 'usuario_inexistente', mensaje: MENSAJE_GENERICO };
  }

  // Cuenta en cooldown: se rechaza ANTES de comparar la contraseña, aunque
  // fuera la correcta. El compare señuelo mantiene el tiempo de respuesta.
  if (usuario.bloqueada) {
    await verificar(password, HASH_SENUELO);
    return { ok: false, motivo: 'cuenta_bloqueada', segundosRestantes: usuario.segundos_bloqueo };
  }

  const coincide = await verificar(password, usuario.password_hash);
  if (!coincide) {
    await usuarioRepo.registrarFallo(usuario.id, MAX_INTENTOS_CUENTA, COOLDOWN_CUENTA_MIN);
    return { ok: false, motivo: 'password_incorrecta', mensaje: MENSAJE_GENERICO };
  }

  await usuarioRepo.reiniciarIntentos(usuario.id);

  // Nunca se devuelve el hash hacia fuera del servicio.
  const { password_hash, ...datos } = usuario;
  return { ok: true, usuario: datos };
}

// Alta de usuario: hashea con costo 10 y guarda la cadena completa.
// Devuelve { ok: true, usuario } o { ok: false, motivo: 'username_duplicado' }.
async function registrarUsuario(username, password, rolId) {
  const passwordHash = await hashear(password);
  try {
    const usuario = await usuarioRepo.crear(username, passwordHash, rolId);
    return { ok: true, usuario };
  } catch (err) {
    if (err.code === '23505') {
      return { ok: false, motivo: 'username_duplicado' };
    }
    throw err;
  }
}

module.exports = {
  hashear,
  registrarUsuario,
  verificar,
  verificarCredenciales,
  MENSAJE_GENERICO,
  MAX_INTENTOS_CUENTA,
  COOLDOWN_CUENTA_MIN,
};
