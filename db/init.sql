-- =====================================================================
-- Taller: Módulo de Inicio de Sesión Seguro
-- Seguridad de la Información — Periodo 2026-II
-- Universidad El Bosque — Sophy Valentina Guiza Valencia
--
-- Motor: PostgreSQL 14+
-- Uso:   psql -U seguridad_app -d seguridad_info -f init.sql
-- =====================================================================

-- Se eliminan en orden inverso a las dependencias para poder
-- reejecutar el script durante las pruebas.
DROP TABLE IF EXISTS intentos_login;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;

-- ---------------------------------------------------------------------
-- roles: control de acceso basado en roles (RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    id     SERIAL      PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- usuarios
--
-- password_hash guarda la cadena completa de BCrypt ($2b$10$salt+hash),
-- de 60 caracteres. No existe columna de salt porque BCrypt lo embebe
-- dentro de la misma cadena junto con el factor de costo.
--
-- intentos_fallidos y bloqueado_hasta implementan el bloqueo POR CUENTA,
-- que es una defensa distinta al bloqueo por IP del middleware.
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id                SERIAL       PRIMARY KEY,
    username          VARCHAR(50)  NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    rol_id            INTEGER      NOT NULL,
    intentos_fallidos INTEGER      NOT NULL DEFAULT 0,
    bloqueado_hasta   TIMESTAMPTZ  NULL,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_usuarios_rol
        FOREIGN KEY (rol_id) REFERENCES roles (id),

    -- El contador nunca debe quedar negativo por un error de lógica.
    CONSTRAINT chk_intentos_no_negativos
        CHECK (intentos_fallidos >= 0)
);

-- ---------------------------------------------------------------------
-- intentos_login: bitácora de auditoría
--
-- No la pide la guía, pero es la evidencia de la "prueba demostrativa"
-- del bloqueo tras 5 intentos fallidos: queda el registro consultable
-- de cada intento con su IP, su resultado y su hora exacta.
--
-- username_intentado es texto libre a propósito: se registra incluso
-- cuando el usuario no existe, y nunca guarda la contraseña enviada.
-- ---------------------------------------------------------------------
CREATE TABLE intentos_login (
    id                SERIAL      PRIMARY KEY,
    username_intentado VARCHAR(50) NOT NULL,
    ip_origen         INET        NOT NULL,
    exitoso           BOOLEAN     NOT NULL,
    motivo            VARCHAR(80) NULL,
    ocurrido_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para las consultas del middleware: "intentos de esta IP
-- en los últimos 15 minutos".
CREATE INDEX idx_intentos_ip_fecha
    ON intentos_login (ip_origen, ocurrido_en DESC);

-- =====================================================================
-- Datos iniciales
-- =====================================================================
INSERT INTO roles (nombre) VALUES
    ('Administrador'),
    ('Usuario');

-- Hashes BCrypt reales, factor de costo 10, generados con
-- scripts/generarHash.js. Las contraseñas en claro NO van en el repo:
-- se guardan en un gestor de contraseñas. En un entorno real el hash lo
-- genera la aplicación en el registro, nunca un script.
INSERT INTO usuarios (username, password_hash, rol_id) VALUES
    ('admin',
     '$2b$10$Tyk7yzP3xKCwIUW7ykYEKuwCK6HAlBYysFU3XNkSu/oAR4H39Z.4O',
     (SELECT id FROM roles WHERE nombre = 'Administrador')),
    ('sophy',
     '$2b$10$LB3SQe1sVVU0ZVSTCXvLIuezCDH67086zgkQqiNvjOH3JskuD12ce',
     (SELECT id FROM roles WHERE nombre = 'Usuario'));

-- =====================================================================
-- Verificación
-- =====================================================================
SELECT u.id,
       u.username,
       r.nombre AS rol,
       length(u.password_hash) AS largo_hash,
       left(u.password_hash, 7) AS prefijo,
       u.intentos_fallidos,
       u.bloqueado_hasta
FROM usuarios u
JOIN roles r ON r.id = u.rol_id
ORDER BY u.id;
