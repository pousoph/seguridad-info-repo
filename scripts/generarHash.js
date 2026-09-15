// Genera el hash BCrypt (costo 10) de una contraseña, para actualizar el
// seed de db/init.sql o crear usuarios a mano.
//
// Uso:  node scripts/generarHash.js 'MiContraseña*2026'
//
// Ojo: la contraseña queda en el historial de la terminal. Para evitarlo,
// antepón un espacio al comando (en zsh con HIST_IGNORE_SPACE) o bórrala
// del historial después.
const authService = require('../src/services/authService');

const password = process.argv[2];

if (!password) {
  console.error('Uso: node scripts/generarHash.js <contraseña>');
  process.exit(1);
}

authService
  .hashear(password)
  .then(async (hash) => {
    // Se comprueba que el hash recién generado verifica la contraseña.
    const ok = await authService.verificar(password, hash);
    console.log(hash);
    if (!ok) {
      console.error('El hash generado no verifica la contraseña (no debería pasar).');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
