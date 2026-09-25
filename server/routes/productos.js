const express = require('express');
const router = express.Router();
const { db, nextId } = require('../database');

// ─── GET /api/productos/categorias ───────────
router.get('/categorias', (req, res) => {
    const cats = [...new Set(
        db.data.productos
            .filter(p => p.activo !== false)
            .map(p => p.categoria)
            .filter(Boolean)
    )].sort();
    res.json(cats);
});

// ─── GET /api/productos/codigo/:codigo ───────
router.get('/codigo/:codigo', (req, res) => {
    const producto = db.data.productos.find(p =>
        p.activo !== false && p.codigo_barras === req.params.codigo
    );
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
});

// ─── GET /api/productos/:id ──────────────────
router.get('/:id', (req, res) => {
    const producto = db.data.productos.find(p => p.id === parseInt(req.params.id));
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
});

// ─── GET /api/productos ──────────────────────
router.get('/', (req, res) => {
    const { q, categoria } = req.query;
    let productos = db.data.productos.filter(p => p.activo !== false);

    if (q) {
        const qLow = q.toLowerCase();
        productos = productos.filter(p =>
            p.nombre.toLowerCase().includes(qLow) ||
            (p.codigo_barras && p.codigo_barras.includes(q))
        );
    }
    if (categoria) {
        productos = productos.filter(p => p.categoria === categoria);
    }

    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    res.json(productos.slice(0, 100));
});

// ─── POST /api/productos ─────────────────────
router.post('/', (req, res) => {
    const { codigo_barras, nombre, precio_venta, precio_compra, stock, stock_minimo, categoria, unidad } = req.body;

    if (!nombre || precio_venta === undefined) {
        return res.status(400).json({ error: 'Nombre y precio de venta son requeridos' });
    }

    // Verificar código único
    if (codigo_barras) {
        const existe = db.data.productos.find(p => p.codigo_barras === codigo_barras && p.activo !== false);
        if (existe) return res.status(409).json({ error: 'El código de barras ya existe' });
    }

    const nuevo = {
        id: nextId('productos'),
        codigo_barras: codigo_barras || null,
        nombre: nombre.trim(),
        precio_venta: parseFloat(precio_venta),
        precio_compra: parseFloat(precio_compra) || 0,
        stock: parseInt(stock) || 0,
        stock_minimo: parseInt(stock_minimo) || 5,
        categoria: categoria || 'General',
        unidad: unidad || 'UND',
        activo: true,
        fecha_creacion: new Date().toISOString()
    };

    db.data.productos.push(nuevo);
    db.write();
    res.status(201).json({ id: nuevo.id, message: 'Producto creado' });
});

// ─── PUT /api/productos/:id ──────────────────
router.put('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const idx = db.data.productos.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });

    const { codigo_barras, nombre, precio_venta, precio_compra, stock, stock_minimo, categoria, unidad } = req.body;
    const current = db.data.productos[idx];

    // Verificar código único (excluyendo el propio)
    if (codigo_barras) {
        const dup = db.data.productos.find(p => p.codigo_barras === codigo_barras && p.id !== id && p.activo !== false);
        if (dup) return res.status(409).json({ error: 'El código de barras ya existe' });
    }

    db.data.productos[idx] = {
        ...current,
        codigo_barras: codigo_barras !== undefined ? codigo_barras : current.codigo_barras,
        nombre: nombre !== undefined ? nombre.trim() : current.nombre,
        precio_venta: precio_venta !== undefined ? parseFloat(precio_venta) : current.precio_venta,
        precio_compra: precio_compra !== undefined ? parseFloat(precio_compra) : current.precio_compra,
        stock: stock !== undefined ? parseInt(stock) : current.stock,
        stock_minimo: stock_minimo !== undefined ? parseInt(stock_minimo) : current.stock_minimo,
        categoria: categoria !== undefined ? categoria : current.categoria,
        unidad: unidad !== undefined ? unidad : current.unidad,
        fecha_modificacion: new Date().toISOString()
    };
    db.write();
    res.json({ message: 'Producto actualizado' });
});

// ─── DELETE /api/productos/:id (Soft Delete) ─
router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const idx = db.data.productos.findIndex(p => p.id === id);
    if (idx !== -1) {
        db.data.productos[idx].activo = false;
        db.data.productos[idx].fecha_modificacion = new Date().toISOString();
        db.write();
    }
    res.json({ message: 'Producto desactivado' });
});

module.exports = router;
