-- ============================================
-- BODEGA POS - Esquema de Base de Datos
-- Sistema para Bodega NRUS (Perú)
-- Soft Delete habilitado en todas las tablas
-- ============================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
-- PRODUCTOS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Productos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_barras   TEXT UNIQUE,
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    precio_venta    REAL NOT NULL CHECK(precio_venta >= 0),
    precio_compra   REAL DEFAULT 0 CHECK(precio_compra >= 0),
    stock           INTEGER DEFAULT 0,
    stock_minimo    INTEGER DEFAULT 5,
    categoria       TEXT DEFAULT 'General',
    unidad          TEXT DEFAULT 'UND',
    activo          INTEGER DEFAULT 1,
    fecha_creacion      TEXT DEFAULT (datetime('now','localtime')),
    fecha_modificacion  TEXT DEFAULT (datetime('now','localtime'))
);

-- ─────────────────────────────────────────────
-- VENTAS (Cabecera)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Ventas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_comprobante  TEXT NOT NULL,
    tipo_comprobante    TEXT NOT NULL DEFAULT 'TICKET'
                        CHECK(tipo_comprobante IN ('TICKET','BOLETA')),
    total               REAL NOT NULL CHECK(total >= 0),
    metodo_pago         TEXT NOT NULL
                        CHECK(metodo_pago IN ('EFECTIVO','YAPE_PLIN','TARJETA')),
    monto_pagado        REAL DEFAULT 0,
    vuelto              REAL DEFAULT 0,
    estado              TEXT DEFAULT 'COMPLETADA'
                        CHECK(estado IN ('COMPLETADA','ANULADA')),
    fecha_venta         TEXT DEFAULT (datetime('now','localtime')),
    motivo_anulacion    TEXT,
    fecha_anulacion     TEXT
);

-- ─────────────────────────────────────────────
-- DETALLE DE VENTAS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Detalle_Ventas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER NOT NULL,
    producto_id     INTEGER NOT NULL,
    nombre_producto TEXT NOT NULL,
    cantidad        REAL NOT NULL CHECK(cantidad > 0),
    precio_unitario REAL NOT NULL CHECK(precio_unitario >= 0),
    subtotal        REAL NOT NULL CHECK(subtotal >= 0),
    FOREIGN KEY (venta_id)    REFERENCES Ventas(id),
    FOREIGN KEY (producto_id) REFERENCES Productos(id)
);

-- ─────────────────────────────────────────────
-- MOVIMIENTOS DE CAJA (Arqueo)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Movimientos_Caja (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo                TEXT NOT NULL
                        CHECK(tipo IN ('APERTURA','INGRESO','EGRESO','VENTA','CIERRE','ANULACION')),
    monto               REAL NOT NULL,
    descripcion         TEXT,
    metodo_pago         TEXT,
    referencia_venta_id INTEGER,
    fecha               TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (referencia_venta_id) REFERENCES Ventas(id)
);

-- ─────────────────────────────────────────────
-- NUMERACIÓN DE COMPROBANTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Numeracion_Comprobantes (
    tipo        TEXT PRIMARY KEY,
    serie       TEXT NOT NULL,
    correlativo INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prod_codigo     ON Productos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_prod_nombre     ON Productos(nombre);
CREATE INDEX IF NOT EXISTS idx_prod_activo     ON Productos(activo);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha    ON Ventas(fecha_venta);
CREATE INDEX IF NOT EXISTS idx_ventas_estado   ON Ventas(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_venta   ON Detalle_Ventas(venta_id);
CREATE INDEX IF NOT EXISTS idx_caja_fecha      ON Movimientos_Caja(fecha);
CREATE INDEX IF NOT EXISTS idx_caja_tipo       ON Movimientos_Caja(tipo);

-- ─────────────────────────────────────────────
-- DATOS INICIALES
-- ─────────────────────────────────────────────
INSERT OR IGNORE INTO Numeracion_Comprobantes (tipo, serie, correlativo)
VALUES ('TICKET', 'T001', 0);
INSERT OR IGNORE INTO Numeracion_Comprobantes (tipo, serie, correlativo)
VALUES ('BOLETA', 'B001', 0);

-- Productos de ejemplo (bodega peruana típica)
INSERT OR IGNORE INTO Productos (codigo_barras, nombre, precio_venta, precio_compra, stock, categoria, unidad) VALUES
('7750100000123', 'Inca Kola 500ml',               2.50, 1.80, 48, 'Bebidas',    'UND'),
('7750100000456', 'Coca Cola 500ml',                2.50, 1.80, 36, 'Bebidas',    'UND'),
('7750100000789', 'Agua San Luis 625ml',            1.50, 0.90, 60, 'Bebidas',    'UND'),
('7751271000012', 'Galleta Casino Chocolate',       1.00, 0.70, 30, 'Galletas',   'UND'),
('7751271000029', 'Galleta Soda Field',             1.50, 1.00, 24, 'Galletas',   'UND'),
('7750243000018', 'Arroz Costeño 1kg',              4.50, 3.50, 20, 'Abarrotes',  'KG'),
('7750243000025', 'Azúcar Rubia 1kg',               4.00, 3.20, 15, 'Abarrotes',  'KG'),
('7750243000032', 'Aceite Primor 1L',               8.50, 7.00, 12, 'Abarrotes',  'UND'),
('7750243000049', 'Fideos Don Vittorio Spaghetti',  3.50, 2.60, 18, 'Abarrotes',  'UND'),
('7750243000056', 'Atún Florida 170g',              5.50, 4.20, 15, 'Conservas',  'UND'),
('7750243000063', 'Leche Gloria 400ml',             3.80, 3.00, 24, 'Lácteos',    'UND'),
('7750243000070', 'Pan de Molde Bimbo',             6.50, 5.00,  8, 'Panadería',  'UND'),
('7750243000087', 'Jabón Bolívar 230g',             3.00, 2.20, 20, 'Limpieza',   'UND'),
('7750243000094', 'Papel Higiénico Elite x4',       5.00, 3.80, 15, 'Limpieza',   'PAQ'),
('7750243000100', 'Cerveza Pilsen 620ml',           5.50, 4.00, 24, 'Bebidas',    'UND');
