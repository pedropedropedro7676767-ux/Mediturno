-- MediTurno · Esquema de la base de datos (MySQL 8 / MariaDB 10.4+)
-- Para crearla:  mysql -u root -p < database/esquema.sql

CREATE DATABASE IF NOT EXISTS mediturno CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mediturno;

-- (El servidor también ejecuta este archivo solo al arrancar: no hace falta importarlo a mano.)

-- Todas las personas del sistema. El campo "rol" define su rango: admin > doctor > paciente.
CREATE TABLE IF NOT EXISTS usuarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  rol         ENUM('admin','doctor','paciente') NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(120) NOT NULL UNIQUE,              -- UNIQUE evita correos duplicados
  contrasena  VARCHAR(200) NULL,                         -- hash (nunca la contraseña real); el admin no usa
  telefono    VARCHAR(15)  NOT NULL DEFAULT '',
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  creado      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Datos extra de los usuarios con rol doctor (relación 1 a 1 con usuarios).
CREATE TABLE IF NOT EXISTS doctores (
  usuario_id    INT PRIMARY KEY,
  especialidad  VARCHAR(80) NOT NULL,
  precio        INT NOT NULL DEFAULT 500,
  agenda        TEXT NOT NULL,                           -- horario semanal y días bloqueados (JSON)
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS citas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id  INT NOT NULL,
  doctor_id    INT NOT NULL,
  fecha        DATE NOT NULL,
  hora         TIME NOT NULL,
  motivo       VARCHAR(500) NOT NULL,
  telefono     VARCHAR(15)  NOT NULL DEFAULT '',
  estado       ENUM('pendiente','aprobada','rechazada','cancelada','atendida') NOT NULL DEFAULT 'pendiente',
  nota         VARCHAR(300) NOT NULL DEFAULT '',
  activa       TINYINT NULL DEFAULT 1,                   -- 1 mientras la cita ocupa el horario; NULL cuando lo libera
  recordada    TINYINT(1) NOT NULL DEFAULT 0,
  creada       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Impide DOS citas activas del mismo doctor a la misma hora (los NULL no cuentan como repetidos)
  UNIQUE KEY uq_horario (doctor_id, fecha, hora, activa),
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id),
  FOREIGN KEY (doctor_id)   REFERENCES doctores(usuario_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificaciones (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  texto       VARCHAR(600) NOT NULL,
  leida       TINYINT(1) NOT NULL DEFAULT 0,
  creada      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS solicitudes_doctor (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  especialidad  VARCHAR(80)  NOT NULL,
  telefono      VARCHAR(15)  NOT NULL DEFAULT '',
  contrasena    VARCHAR(200) NULL,                       -- hash de la contraseña que eligió el doctor al registrarse
  estado        ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente'
) ENGINE=InnoDB;

-- Códigos de un solo uso para el acceso del administrador.
CREATE TABLE IF NOT EXISTS codigos_admin (
  email      VARCHAR(120) PRIMARY KEY,
  codigo     VARCHAR(200) NOT NULL,                      -- también guardado como hash
  expira     BIGINT NOT NULL,
  intentos   INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bitacora (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  fecha   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  quien   VARCHAR(100) NOT NULL,
  texto   VARCHAR(300) NOT NULL
) ENGINE=InnoDB;

-- Datos editables de la clínica (nombre, dirección, teléfono...).
CREATE TABLE IF NOT EXISTS config (
  clave  VARCHAR(40) PRIMARY KEY,
  valor  VARCHAR(200) NOT NULL
) ENGINE=InnoDB;
