require('dotenv').config({ quiet: true });

const app = require('./src/app');
const { verificarConexion } = require('./src/config/db');

const PORT = Number(process.env.PORT) || 3000;

async function arrancar() {
  try {
    await verificarConexion();
    console.log('[db] Conexión a PostgreSQL verificada (SELECT 1 OK)');
  } catch (err) {
    console.error('[db] ' + err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

arrancar();
