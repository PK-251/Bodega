/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Base de Datos (lowdb / JSON)
 *  Reemplaza better-sqlite3 con una BD JSON pura
 *  Archivo: data/bodega.json
 * ════════════════════════════════════════════════
 */

const { Low } = require('lowdb');
const { JSONFileSync } = require('lowdb/node');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'bodega.json');

// Crear directorio de datos si no existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Estructura inicial de la base de datos
const defaultData = {
    meta: {
        version: '1.0',
        ultima_actualizacion: new Date().toISOString()
    },
    secuencias: {
        productos: 0,
        ventas: 0,
        comprobantes: 0,
        movimientos: 0
    },
    productos: [],
    ventas: [],
    movimientos_caja: [],
    caja_estado: {
        abierta: false,
        apertura: null,
        saldo_sistema: 0,
        efectivo_en_caja: 0
    }
};

// Inicializar lowdb con adaptador JSON síncrono
const adapter = new JSONFileSync(DB_PATH);
const db = new Low(adapter, defaultData);

// Leer BD del disco
db.read();

// Si la BD está vacía, escribir estructura inicial
if (!db.data) {
    db.data = defaultData;
    db.write();
}

// Asegurar que todas las colecciones existen
if (!db.data.secuencias) db.data.secuencias = defaultData.secuencias;
if (!db.data.productos) db.data.productos = [];
if (!db.data.ventas) db.data.ventas = [];
if (!db.data.movimientos_caja) db.data.movimientos_caja = [];
if (!db.data.caja_estado) db.data.caja_estado = defaultData.caja_estado;

// ─── Helpers ─────────────────────────────────────

function nextId(coleccion) {
    db.data.secuencias[coleccion] = (db.data.secuencias[coleccion] || 0) + 1;
    db.write();
    return db.data.secuencias[coleccion];
}

// ─── Datos de demo ────────────────────────────────

function inicializarDemo() {
    if (db.data.productos.length > 0) return;

    const demo = [
        { codigo_barras: '7751530000001', nombre: 'Inca Kola 500ml', precio_venta: 3.00, precio_compra: 1.80, stock: 48, stock_minimo: 12, categoria: 'Bebidas', unidad: 'UND' },
        { codigo_barras: '7751530000002', nombre: 'Inca Kola 1.5L', precio_venta: 5.50, precio_compra: 3.20, stock: 24, stock_minimo: 6, categoria: 'Bebidas', unidad: 'UND' },
        { codigo_barras: '7751530000003', nombre: 'Coca Cola 500ml', precio_venta: 3.00, precio_compra: 1.80, stock: 36, stock_minimo: 12, categoria: 'Bebidas', unidad: 'UND' },
        { codigo_barras: '7751530000004', nombre: 'Agua San Luis 625ml', precio_venta: 1.50, precio_compra: 0.70, stock: 60, stock_minimo: 24, categoria: 'Bebidas', unidad: 'UND' },
        { codigo_barras: '7751530000005', nombre: 'Fanta Naranja 500ml', precio_venta: 3.00, precio_compra: 1.80, stock: 24, stock_minimo: 6, categoria: 'Bebidas', unidad: 'UND' },
        { codigo_barras: '7751530000010', nombre: 'Arroz Extra 1kg', precio_venta: 4.50, precio_compra: 3.00, stock: 30, stock_minimo: 10, categoria: 'Abarrotes', unidad: 'KG' },
        { codigo_barras: '7751530000011', nombre: 'Azúcar Rubia 1kg', precio_venta: 3.80, precio_compra: 2.60, stock: 20, stock_minimo: 8, categoria: 'Abarrotes', unidad: 'KG' },
        { codigo_barras: '7751530000012', nombre: 'Aceite Vegetal 1L', precio_venta: 9.00, precio_compra: 6.50, stock: 12, stock_minimo: 4, categoria: 'Abarrotes', unidad: 'LT' },
        { codigo_barras: '7751530000013', nombre: 'Sal Yodada 1kg', precio_venta: 1.20, precio_compra: 0.60, stock: 15, stock_minimo: 5, categoria: 'Abarrotes', unidad: 'KG' },
        { codigo_barras: '7751530000014', nombre: 'Fideos Tallarín 500g', precio_venta: 2.80, precio_compra: 1.80, stock: 24, stock_minimo: 8, categoria: 'Abarrotes', unidad: 'PAQ' },
        { codigo_barras: '7751530000020', nombre: 'Pan de Molde Grande', precio_venta: 8.00, precio_compra: 5.50, stock: 6, stock_minimo: 2, categoria: 'Panadería', unidad: 'UND' },
        { codigo_barras: '7751530000021', nombre: 'Galletas Oreo Paq.', precio_venta: 3.50, precio_compra: 2.00, stock: 20, stock_minimo: 8, categoria: 'Snacks', unidad: 'PAQ' },
        { codigo_barras: '7751530000022', nombre: 'Papas Lays 33g', precio_venta: 1.50, precio_compra: 0.80, stock: 30, stock_minimo: 10, categoria: 'Snacks', unidad: 'UND' },
        { codigo_barras: '7751530000030', nombre: 'Leche Gloria Evaporada', precio_venta: 4.20, precio_compra: 3.00, stock: 18, stock_minimo: 6, categoria: 'Lácteos', unidad: 'UND' },
        { codigo_barras: '7751530000031', nombre: 'Yogurt Gloria 200ml', precio_venta: 2.50, precio_compra: 1.50, stock: 12, stock_minimo: 4, categoria: 'Lácteos', unidad: 'UND' },
        { codigo_barras: '7751530000040', nombre: 'Detergente Ariel 500g', precio_venta: 7.50, precio_compra: 5.00, stock: 10, stock_minimo: 4, categoria: 'Limpieza', unidad: 'PAQ' },
        { codigo_barras: '7751530000041', nombre: 'Jabón Bolívar', precio_venta: 2.00, precio_compra: 1.10, stock: 3, stock_minimo: 5, categoria: 'Limpieza', unidad: 'UND' },
    ];

    demo.forEach(p => {
        db.data.productos.push({
            id: nextId('productos'),
            ...p,
            activo: true,
            fecha_creacion: new Date().toISOString()
        });
    });
    db.write();
    console.log(`✅ ${demo.length} productos de demo cargados`);
}

function initDatabase() {
    console.log(`✅ Base de datos inicializada: ${DB_PATH}`);
    inicializarDemo();
}

module.exports = { db, nextId, initDatabase };
