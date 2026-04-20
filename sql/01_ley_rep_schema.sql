-- Base de datos normalizada para plataforma Ley REP
-- PostgreSQL / Render

DROP TABLE IF EXISTS auditoria_eventos CASCADE;
DROP TABLE IF EXISTS alertas_preventivas CASCADE;
DROP TABLE IF EXISTS validaciones_declaracion CASCADE;
DROP TABLE IF EXISTS reglas_validacion CASCADE;
DROP TABLE IF EXISTS declaraciones CASCADE;
DROP TABLE IF EXISTS metas_anuales CASCADE;
DROP TABLE IF EXISTS estados_declaracion CASCADE;
DROP TABLE IF EXISTS categorias_rep CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    id_rol INT NOT NULL REFERENCES roles(id_rol),
    password_hash VARCHAR(64) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categorias_rep (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(120) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE estados_declaracion (
    id_estado SERIAL PRIMARY KEY,
    nombre_estado VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE metas_anuales (
    id_meta SERIAL PRIMARY KEY,
    id_categoria INT NOT NULL REFERENCES categorias_rep(id_categoria),
    anio INT NOT NULL CHECK (anio >= 2020),
    porcentaje_meta DECIMAL(5,2) NOT NULL CHECK (porcentaje_meta >= 0 AND porcentaje_meta <= 100),
    UNIQUE (id_categoria, anio)
);

CREATE TABLE declaraciones (
    id_declaracion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario),
    id_categoria INT NOT NULL REFERENCES categorias_rep(id_categoria),
    id_estado INT NOT NULL REFERENCES estados_declaracion(id_estado),
    anio_periodo INT NOT NULL CHECK (anio_periodo >= 2020),
    mes_periodo INT NOT NULL CHECK (mes_periodo BETWEEN 1 AND 12),
    cantidad_kg DECIMAL(12,2) NOT NULL CHECK (cantidad_kg >= 0),
    fecha_declaracion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT,
    UNIQUE (id_usuario, id_categoria, anio_periodo, mes_periodo)
);

CREATE TABLE reglas_validacion (
    id_regla SERIAL PRIMARY KEY,
    codigo_regla VARCHAR(30) NOT NULL UNIQUE,
    nombre_regla VARCHAR(120) NOT NULL,
    descripcion TEXT NOT NULL,
    valor_min DECIMAL(12,2),
    valor_max DECIMAL(12,2),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE validaciones_declaracion (
    id_validacion SERIAL PRIMARY KEY,
    id_declaracion INT NOT NULL REFERENCES declaraciones(id_declaracion) ON DELETE CASCADE,
    id_regla INT NOT NULL REFERENCES reglas_validacion(id_regla),
    resultado VARCHAR(20) NOT NULL CHECK (resultado IN ('Cumple', 'No cumple', 'Observado')),
    detalle TEXT,
    fecha_validacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_declaracion, id_regla)
);

CREATE TABLE alertas_preventivas (
    id_alerta SERIAL PRIMARY KEY,
    id_validacion INT NOT NULL REFERENCES validaciones_declaracion(id_validacion) ON DELETE CASCADE,
    nivel_alerta VARCHAR(20) NOT NULL CHECK (nivel_alerta IN ('Baja', 'Media', 'Alta')),
    mensaje TEXT NOT NULL,
    atendida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_alerta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auditoria_eventos (
    id_evento SERIAL PRIMARY KEY,
    id_declaracion INT NOT NULL REFERENCES declaraciones(id_declaracion) ON DELETE CASCADE,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario),
    accion VARCHAR(80) NOT NULL,
    detalle TEXT,
    fecha_evento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_declaraciones_usuario ON declaraciones(id_usuario);
CREATE INDEX idx_declaraciones_categoria ON declaraciones(id_categoria);
CREATE INDEX idx_declaraciones_estado ON declaraciones(id_estado);
CREATE INDEX idx_validaciones_declaracion ON validaciones_declaracion(id_declaracion);
CREATE INDEX idx_alertas_validacion ON alertas_preventivas(id_validacion);
CREATE INDEX idx_auditoria_declaracion ON auditoria_eventos(id_declaracion);

INSERT INTO roles (nombre_rol) VALUES
('Administrador'),
('Gestor'),
('Productor');

INSERT INTO usuarios (nombre, email, id_rol, password_hash) VALUES
('Administrador Demo', 'admin@leyrep.cl', 1, '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'),
('Gestor Demo', 'gestor@leyrep.cl', 2, '18f2b94d784d03c222cb7c47148cdb8457f1ef3eaf3e317711f25d55747f6a35'),
('Productor Demo', 'productor@leyrep.cl', 3, 'ce76dad0440f6cf88aebb8dc6224f3f8505ec386b1cb0c81d5d7f97d2e09b9ee');

INSERT INTO categorias_rep (nombre_categoria, descripcion) VALUES
('Neumáticos', 'Gestión y trazabilidad de neumáticos fuera de uso'),
('Baterías y acumuladores', 'Control de residuos de baterías y acumuladores'),
('Aceites lubricantes', 'Registro y trazabilidad de aceites lubricantes usados');

INSERT INTO estados_declaracion (nombre_estado, descripcion) VALUES
('Pendiente', 'Declaración ingresada pendiente de revisión'),
('Validada', 'Declaración aprobada por el sistema o el gestor'),
('Rechazada', 'Declaración rechazada por incumplimiento');

INSERT INTO metas_anuales (id_categoria, anio, porcentaje_meta) VALUES
(1, 2026, 15.00),
(2, 2026, 12.50),
(3, 2026, 18.00);

INSERT INTO declaraciones (id_usuario, id_categoria, id_estado, anio_periodo, mes_periodo, cantidad_kg, observacion) VALUES
(3, 1, 1, 2026, 1, 1240.50, 'Declaración inicial de neumáticos'),
(3, 2, 2, 2026, 1, 350.00, 'Declaración validada de baterías'),
(3, 3, 1, 2026, 1, 480.25, 'Declaración en proceso de revisión');

INSERT INTO reglas_validacion (codigo_regla, nombre_regla, descripcion, valor_min, valor_max) VALUES
('RV-001', 'Cantidad no negativa', 'La cantidad declarada debe ser mayor o igual a cero', 0, NULL),
('RV-002', 'Meta anual existente', 'La categoría declarada debe tener meta anual parametrizada', NULL, NULL),
('RV-003', 'Periodo único', 'No debe existir más de una declaración por productor, categoría y periodo', NULL, NULL);

INSERT INTO validaciones_declaracion (id_declaracion, id_regla, resultado, detalle) VALUES
(1, 1, 'Cumple', 'Cantidad declarada dentro de rango permitido'),
(1, 2, 'Cumple', 'La categoría posee meta anual asociada'),
(2, 1, 'Cumple', 'Cantidad declarada dentro de rango permitido'),
(3, 2, 'Cumple', 'La categoría posee meta anual asociada');

INSERT INTO alertas_preventivas (id_validacion, nivel_alerta, mensaje) VALUES
(4, 'Media', 'La declaración sigue pendiente de validación final.');

INSERT INTO auditoria_eventos (id_declaracion, id_usuario, accion, detalle) VALUES
(1, 3, 'Registrar declaración', 'El productor registró una nueva declaración REP.'),
(2, 2, 'Validar declaración', 'El gestor validó la declaración de baterías.'),
(3, 2, 'Revisar declaración', 'El gestor inició la revisión de la declaración de aceites.');
