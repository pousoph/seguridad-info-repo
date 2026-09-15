// Capa 1 del bloqueo: por dirección IP, en memoria.
//
// Frena al script que martilla el login desde una sola dirección. La capa 2
// (por cuenta, en la base) frena el ataque distribuido; vive en authService
// y usuarioRepo, no aquí.
//
// El ejemplo de la guía tenía dos huecos que este módulo corrige:
//   1. El middleware corre ANTES del controlador, así que no sabe si las
//      credenciales eran válidas: no puede incrementar el contador. Quien
//      incrementa es el controlador, llamando a registrarFallo(ip) cuando
//      la verificación falla.
//   2. Al llegar a MAX_INTENTOS hay que fijar bloqueadoHasta y reiniciar
//      el contador; si no, nunca se bloquea nada.
//
// Este módulo no conoce la base ni bcrypt: solo IPs, contadores y tiempos.

const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;   // los intentos cuentan durante 15 min
const COOLDOWN_MS = 15 * 60 * 1000;  // bloqueo de 15 min al superar el máximo

// ip -> { conteo, primerIntento, bloqueadoHasta }
const registros = new Map();

function mensajeBloqueo(segundos) {
  const minutos = Math.ceil(segundos / 60);
  return minutos <= 1
    ? 'Demasiados intentos. Vuelve a intentarlo en un minuto.'
    : `Demasiados intentos. Vuelve a intentarlo en ${minutos} minutos.`;
}

// Segundos que faltan para que la IP pueda intentar de nuevo; 0 si no está bloqueada.
function segundosDeBloqueo(ip, ahora = Date.now()) {
  const registro = registros.get(ip);
  if (!registro || !registro.bloqueadoHasta) return 0;
  if (registro.bloqueadoHasta <= ahora) {
    registros.delete(ip); // el cooldown terminó: empieza de cero
    return 0;
  }
  return Math.ceil((registro.bloqueadoHasta - ahora) / 1000);
}

// Middleware: solo comprueba. Si la IP está en cooldown responde 429 con
// Retry-After y no deja pasar la petición al controlador.
function proteccionFuerzaBruta(req, res, next) {
  const segundos = segundosDeBloqueo(req.ip);
  if (segundos === 0) return next();

  res.set('Retry-After', String(segundos));
  res.status(429).renderVista('login', {
    titulo: 'Iniciar sesión',
    activa: '/login',
    error: mensajeBloqueo(segundos),
    username: '',
  });
}

// Lo llama el controlador cuando las credenciales NO fueron válidas.
// Devuelve el registro actualizado (útil para la bitácora y las pruebas).
function registrarFallo(ip, ahora = Date.now()) {
  let registro = registros.get(ip);

  // Sin registro, o con la ventana de 15 min ya vencida: se empieza de cero.
  if (!registro || ahora - registro.primerIntento > VENTANA_MS) {
    registro = { conteo: 0, primerIntento: ahora, bloqueadoHasta: null };
  }

  registro.conteo += 1;

  if (registro.conteo >= MAX_INTENTOS) {
    registro.bloqueadoHasta = ahora + COOLDOWN_MS;
    registro.conteo = 0;
    registro.primerIntento = ahora;
  }

  registros.set(ip, registro);
  return { ...registro };
}

// Lo llama el controlador cuando el login fue exitoso.
function limpiar(ip) {
  registros.delete(ip);
}

// Limpieza periódica: registros vencidos que nadie volvió a consultar.
// unref() para que el temporizador no impida cerrar el proceso.
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, r] of registros) {
    const vencido = r.bloqueadoHasta ? r.bloqueadoHasta <= ahora : ahora - r.primerIntento > VENTANA_MS;
    if (vencido) registros.delete(ip);
  }
}, VENTANA_MS).unref();

module.exports = {
  proteccionFuerzaBruta,
  registrarFallo,
  limpiar,
  segundosDeBloqueo,
  mensajeBloqueo,
  MAX_INTENTOS,
  VENTANA_MS,
  COOLDOWN_MS,
};
