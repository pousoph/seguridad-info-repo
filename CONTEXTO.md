# Brief: módulo de inicio de sesión seguro

Contexto para construir el backend. Taller de Seguridad de la Información,
Universidad El Bosque, periodo 2026-II.

---

## 1. Qué existe hoy

El repositorio `seguridad-info-repo` es un sitio estático del taller anterior
sobre criptografía clásica:

```
index.html        Criptoanálisis: índice de coincidencia, frecuencias, ataques
cifrar.html       Cifrado César, Afín y Vigenère
styles/style.css  Sistema de diseño ya definido
js/alfabeto.js    Alfabeto español de 27 letras
js/cifrado.js     Implementación de los cifrados
js/analisis.js    Análisis de frecuencias
js/ataque.js      Ataques automáticos
js/app.js         Orquestación de la interfaz
db/init.sql       Esquema de la base (ya ejecutado en el servidor)
```

Ese CSS y esa tipografía (Bricolage Grotesque, IBM Plex Sans, IBM Plex Mono)
se reutilizan tal cual. Las pantallas nuevas deben verse continuas con el
sitio existente, no como un módulo pegado aparte.

La base de datos ya está creada y poblada. **No modificar `db/init.sql`
ni el esquema.**

---

## 2. Stack

- Node.js 20+ con Express
- PostgreSQL con el driver `pg` (pool de conexiones)
- `bcrypt` para el hashing (si falla la compilación nativa, `bcryptjs`)
- `ejs` como motor de plantillas
- `express-session` para la sesión
- `helmet`, `dotenv`, `express-validator`

Express sirve además los archivos estáticos, así que **no hay un frontend
separado**: un solo proceso, un solo origen, una sola cookie.

---

## 3. Estructura de carpetas

```
seguridad-info-repo/
├── public/                   estáticos públicos
│   ├── index.html            portada
│   ├── styles/style.css
│   └── js/                   (solo lo que puede ser público)
├── private/                  assets de las vistas protegidas
│   └── js/                   cifrado.js, analisis.js, ataque.js, app.js
├── db/
│   └── init.sql              NO TOCAR
├── src/
│   ├── config/
│   │   └── db.js             pool de PostgreSQL
│   ├── middleware/
│   │   ├── proteccionFuerzaBruta.js
│   │   └── requiereSesion.js
│   ├── services/
│   │   └── authService.js    bcrypt: hashear y verificar
│   ├── repositories/
│   │   ├── usuarioRepo.js    consultas de usuarios
│   │   └── intentoRepo.js    bitácora intentos_login
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── herramientasRoutes.js
│   ├── views/
│   │   ├── layout.ejs
│   │   ├── login.ejs
│   │   ├── panel.ejs
│   │   └── error.ejs
│   └── app.js                configuración de Express
├── .env.example
├── .gitignore
└── server.js                 punto de entrada
```

Regla de separación: `authService` no conoce HTTP, los repositorios no
conocen bcrypt, el middleware no consulta la base directamente. Cada módulo
debe poder leerse y explicarse solo, porque el middleware anti fuerza bruta
es un entregable independiente del taller.

---

## 4. Esquema de la base (ya existente)

```
roles
  id                 SERIAL PK
  nombre             VARCHAR(50) NOT NULL UNIQUE   -- 'Administrador', 'Usuario'

usuarios
  id                 SERIAL PK
  username           VARCHAR(50) NOT NULL UNIQUE
  password_hash      VARCHAR(255) NOT NULL          -- cadena BCrypt completa
  rol_id             INTEGER NOT NULL FK -> roles(id)
  intentos_fallidos  INTEGER NOT NULL DEFAULT 0
  bloqueado_hasta    TIMESTAMPTZ NULL
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()

intentos_login
  id                 SERIAL PK
  username_intentado VARCHAR(50) NOT NULL
  ip_origen          INET NOT NULL
  exitoso            BOOLEAN NOT NULL
  motivo             VARCHAR(80) NULL
  ocurrido_en        TIMESTAMPTZ NOT NULL DEFAULT now()
```

Usuarios sembrados para pruebas: `admin` (Administrador) y `sophy` (Usuario).
Sus contraseñas no están en el repositorio: se guardan en el gestor de
contraseñas. Para cambiarlas, `node scripts/generarHash.js '<clave>'` y
actualizar el hash en la base y en `db/init.sql`.

---

## 5. Rutas y control de acceso

| Ruta | Método | Acceso | Descripción |
|---|---|---|---|
| `/` | GET | Público | Portada |
| `/login` | GET | Público | Formulario |
| `/api/login` | POST | Público + middleware | Autenticación |
| `/logout` | POST | Con sesión | Destruye la sesión |
| `/panel` | GET | Con sesión | Panel según rol |
| `/herramientas/cifrar` | GET | Con sesión | Cifrado clásico |
| `/herramientas/analizar` | GET | Con sesión, rol Administrador | Criptoanálisis |

El formulario de login sigue el markup de la guía: POST, `autocomplete="username"`
y `autocomplete="current-password"`.

Los archivos JS de las vistas protegidas se sirven detrás del mismo guardián,
no desde `public/`. Si `/herramientas/analizar` exige rol Administrador pero
`ataque.js` cuelga en la carpeta pública, la protección es decorativa.

---

## 6. Reglas de seguridad obligatorias

### 6.1 Todo en el servidor

Ninguna decisión de autenticación, autorización ni conteo de intentos puede
depender del navegador. El JavaScript del cliente solo mejora la experiencia
(mostrar/ocultar contraseña, contador visual). Nada de bcrypt en el navegador.

### 6.2 Hashing

- Factor de costo 10.
- Registro: `bcrypt.hash(password, 10)`, guardar la cadena completa.
- Verificación: `bcrypt.compare(passwordIngresado, hashAlmacenado)`.
- No existe columna de salt: BCrypt lo embebe en la cadena `$2b$10$...`.

### 6.3 El middleware anti fuerza bruta

El ejemplo de la guía (Sección 3.3) tiene dos huecos. **Copiarlo tal cual
no bloquea nada.** Hay que corregir:

1. **Nunca incrementa `conteo`.** El middleware corre antes del controlador,
   así que todavía no sabe si las credenciales eran válidas. El incremento
   debe ocurrir en el controlador de login cuando la verificación falla.
2. **Nunca asigna `bloqueadoHasta`.** Al llegar a `MAX_INTENTOS` hay que
   fijar `bloqueadoHasta = Date.now() + COOLDOWN` y reiniciar el conteo.

Parámetros: 5 intentos, ventana de 15 minutos, cooldown de 15 minutos.
Respuesta al bloquear: HTTP 429 con cabecera `Retry-After` en segundos.

Un login exitoso limpia el registro de esa IP.

### 6.4 Dos capas de bloqueo

- **Por IP**, en memoria (`Map`), en el middleware. Frena al script que
  martilla desde una sola dirección.
- **Por cuenta**, en las columnas `intentos_fallidos` y `bloqueado_hasta`
  de `usuarios`. Frena el ataque distribuido desde muchas IP contra un
  mismo usuario.

Ambas se verifican antes de comparar la contraseña. Un login exitoso
reinicia el contador de la cuenta y limpia `bloqueado_hasta`.

### 6.5 No filtrar información

- Un único mensaje genérico para usuario inexistente y contraseña
  incorrecta: "Usuario o contraseña incorrectos".
- Cuando el usuario no existe, ejecutar igualmente un `bcrypt.compare`
  contra un hash señuelo fijo. Sin esto, la respuesta es notablemente más
  rápida y un atacante puede enumerar usuarios midiendo el tiempo.
- Nada de stack traces ni errores de base de datos hacia el cliente.

### 6.6 IP real detrás del proxy

En producción, nginx hace proxy hacia Node, así que `req.ip` devuelve
`127.0.0.1` para todas las peticiones y el bloqueo por IP bloquearía a
todo el mundo a la vez.

- En Express: `app.set('trust proxy', 1)`.
- En nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
  y `proxy_set_header X-Real-IP $remote_addr;`.

### 6.7 Sesión

Cookie con `httpOnly: true`, `sameSite: 'lax'`, y `secure` leído desde una
variable de entorno (hoy el sitio corre sobre HTTP, así que `secure: true`
rompería el login; el certificado se agrega en otro taller).

`req.session.regenerate()` al autenticar, para evitar fijación de sesión.
La sesión guarda `userId`, `username` y `rol`. El rol se lee siempre de la
sesión del servidor, nunca de un campo enviado por el cliente.

### 6.8 CSRF

Token generado en el servidor, inyectado como campo oculto en el formulario
y validado en el POST.

### 6.9 Base de datos

- Consultas siempre parametrizadas (`$1`, `$2`), nunca concatenación de
  cadenas. Prevención de inyección SQL.
- Credenciales en `.env`, fuera del repositorio. El `.gitignore` debe
  incluir `.env`, y el repo lleva un `.env.example` con valores vacíos.
- La aplicación se conecta como `seguridad_app`, nunca como `postgres`.

### 6.10 Bitácora

Cada intento se registra en `intentos_login` con el usuario intentado, la
IP, si fue exitoso y el motivo del rechazo. **Nunca guardar la contraseña
enviada**, ni siquiera hasheada.

---

## 7. Variables de entorno

```
PGHOST=localhost
PGPORT=5432          # 5433 en desarrollo local, vía túnel SSH
PGDATABASE=seguridad_info
PGUSER=seguridad_app
PGPASSWORD=
SESSION_SECRET=
COOKIE_SECURE=false
PORT=3000
```

---

## 8. Orden de trabajo sugerido

1. `server.js`, `src/app.js` y la conexión a la base. Verificar que arranca
   y consulta.
2. `usuarioRepo` y `authService` con bcrypt. Probar `compare` contra los
   usuarios sembrados.
3. Ruta de login y plantilla EJS reutilizando `style.css`.
4. Sesión, `requiereSesion` y el panel por rol.
5. Middleware anti fuerza bruta con las dos capas.
6. Mover las herramientas de cifrado detrás del guardián.
7. Bitácora y pruebas del bloqueo.

Commits pequeños y descriptivos, uno por paso.
