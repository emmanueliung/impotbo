-- ============================================================
-- Esquema de base de datos - impuestos-bo (MVP RC-IVA)
-- ============================================================

-- Usuarios (por ahora: el particular. El contador vendrá luego)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    nit             VARCHAR(20),
    rol             VARCHAR(20) DEFAULT 'particular',   -- 'particular' | 'contador'
    salario_bruto   NUMERIC(12,2),
    created_at      TIMESTAMP DEFAULT now()
);

-- Parámetros fiscales configurables (NO codificar en duro)
-- Permite cambiar SMN / tasas sin tocar el código.
CREATE TABLE IF NOT EXISTS parametros_fiscales (
    id              SERIAL PRIMARY KEY,
    clave           VARCHAR(50) UNIQUE NOT NULL,
    valor           NUMERIC(12,4) NOT NULL,
    descripcion     TEXT,
    vigente_desde   DATE DEFAULT now()
);

-- Periodos fiscales (RC-IVA dependiente = mensual)
CREATE TABLE IF NOT EXISTS periodos (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    anio            INTEGER NOT NULL,
    mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    salario_mes     NUMERIC(12,2),
    estado          VARCHAR(20) DEFAULT 'abierto',   -- 'abierto' | 'cerrado'
    UNIQUE (user_id, anio, mes)
);

-- Facturas (entrada manual, 4 campos esenciales)
CREATE TABLE IF NOT EXISTS facturas (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    periodo_id          INTEGER REFERENCES periodos(id) ON DELETE CASCADE,
    nit_proveedor       VARCHAR(20)   NOT NULL,
    nro_factura         VARCHAR(30)   NOT NULL,
    fecha               DATE          NOT NULL,
    importe             NUMERIC(12,2) NOT NULL CHECK (importe > 0),
    codigo_autorizacion VARCHAR(60),
    created_at          TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facturas_periodo ON facturas(periodo_id);
CREATE INDEX IF NOT EXISTS idx_facturas_user ON facturas(user_id);

-- Registro de auditoría (trazabilidad fiscal)
CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER,
    accion      VARCHAR(50),
    detalle     JSONB,
    created_at  TIMESTAMP DEFAULT now()
);

-- Relación contador <-> cliente (delegación de acceso)
-- Siempre: un contador accede a los datos de un cliente.
CREATE TABLE IF NOT EXISTS memberships (
    id                SERIAL PRIMARY KEY,
    contador_user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
    cliente_user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
    estado            VARCHAR(20) DEFAULT 'activo',   -- 'activo' | 'revocado'
    permisos          JSONB DEFAULT '{"ver":true,"editar":true}',
    created_at        TIMESTAMP DEFAULT now(),
    UNIQUE (contador_user_id, cliente_user_id)
);

-- Invitaciones (pueden venir del particular o del contador)
CREATE TABLE IF NOT EXISTS invitations (
    id                  SERIAL PRIMARY KEY,
    emisor_user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emisor_rol          VARCHAR(20) NOT NULL,         -- rol de quien invita
    destinatario_email  VARCHAR(150) NOT NULL,
    token               VARCHAR(80) UNIQUE NOT NULL,
    estado              VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente'|'aceptada'|'rechazada'
    created_at          TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_dest ON invitations(destinatario_email);

-- Mensajes entre el cliente y su(s) contador(es)
-- Un hilo por cliente (cliente_user_id). Lo ven el cliente y sus contadores.
CREATE TABLE IF NOT EXISTS mensajes (
    id              SERIAL PRIMARY KEY,
    cliente_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    autor_user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
    texto           TEXT NOT NULL,
    factura_id      INTEGER REFERENCES facturas(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_cliente ON mensajes(cliente_user_id);

-- ------------------------------------------------------------
-- Valores iniciales de parámetros (¡CONFIRMAR con contador!)
-- ------------------------------------------------------------
INSERT INTO parametros_fiscales (clave, valor, descripcion) VALUES
    ('tasa_rciva', 0.13,    'Tasa RC-IVA / IVA (13%)'),
    ('tasa_afp',   0.1271,  'Cotización AFP a deducir del salario bruto'),
    ('smn',        2500.00, 'Salario Mínimo Nacional - VERIFICAR valor del año')
ON CONFLICT (clave) DO NOTHING;
