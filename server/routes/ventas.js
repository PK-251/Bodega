const express = require('express');
const router = express.Router();
const { db, nextId } = require('../database');

// ─── POST /api/ventas ────────────────────────
router.post('/', (req, res) => {
    const { items, tipo_comprobante = 'TICKET', metodo_pago, monto_pagado } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
    }
    if (!metodo_pago) {
        return res.status(400).json({ error: 'Debe especificar el método de pago' });
    }

    // Verificar caja abierta
    if (!db.data.caja_estado.abierta) {
        return res.status(400).json({ error: 'La caja no está abierta. Ábrela antes de vender.' });
    }

    try {
        // Calcular total
        const total = Math.round(
            items.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0) * 100
        ) / 100;

        const pagado = metodo_pago === 'EFECTIVO'
            ? parseFloat(monto_pagado) || total
            : total;
        const vuelto = metodo_pago === 'EFECTIVO'
            ? Math.round((pagado - total) * 100) / 100
            : 0;

        if (metodo_pago === 'EFECTIVO' && pagado < total) {
            return res.status(400).json({ error: `Monto insuficiente. Total: S/ ${total.toFixed(2)}` });
        }

        // Verificar stock
        for (const item of items) {
            const prod = db.data.productos.find(p => p.id === item.producto_id && p.activo !== false);
            if (!prod) return res.status(400).json({ error: `Producto ID ${item.producto_id} no encontrado` });
            if (prod.stock < item.cantidad) {
                return res.status(400).json({ error: `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}` });
            }
        }

        // Generar número de comprobante
        const seq = nextId('comprobantes');
        const fecha = new Date();
        const serie = tipo_comprobante === 'BOLETA' ? 'B001' : 'T001';
        const año = String(fecha.getFullYear()).slice(2);
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const numero = `${serie}-${año}${mes}-${String(seq).padStart(6, '0')}`;

        // Crear venta
        const venta = {
            id: nextId('ventas'),
            numero_comprobante: numero,
            fecha: new Date().toISOString(),
            items: items.map(item => ({
                producto_id: item.producto_id,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: Math.round(item.precio_unitario * item.cantidad * 100) / 100
            })),
            total,
            tipo_comprobante,
            metodo_pago,
            monto_pagado: pagado,
            vuelto,
            anulada: false
        };

        db.data.ventas.push(venta);

        // Descontar stock
        for (const item of items) {
            const idx = db.data.productos.findIndex(p => p.id === item.producto_id);
            if (idx !== -1) {
                db.data.productos[idx].stock = Math.max(0, db.data.productos[idx].stock - item.cantidad);
            }
        }

        // Registrar movimiento de caja
        const mov = {
            id: nextId('movimientos'),
            tipo: 'VENTA',
            monto: total,
            descripcion: `Venta ${numero} (${metodo_pago})`,
            metodo_pago,
            referencia_id: venta.id,
            fecha: new Date().toISOString()
        };
        db.data.movimientos_caja.push(mov);

        // Actualizar saldo de caja
        db.data.caja_estado.saldo_sistema = (db.data.caja_estado.saldo_sistema || 0) + total;
        if (metodo_pago === 'EFECTIVO') {
            db.data.caja_estado.efectivo_en_caja = (db.data.caja_estado.efectivo_en_caja || 0) + total;
        }

        db.write();

        res.status(201).json({
            ventaId: venta.id,
            numero_comprobante: numero,
            tipo_comprobante,
            total,
            metodo_pago,
            monto_pagado: pagado,
            vuelto,
            items: items.length
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ─── GET /api/ventas/resumen/hoy ─────────────
// IMPORTANTE: debe ir ANTES de /:id
router.get('/resumen/hoy', (req, res) => {
    const hoy = new Date().toDateString();
    const ventas = db.data.ventas.filter(v => !v.anulada && new Date(v.fecha).toDateString() === hoy);

    res.json({
        total_ventas: ventas.length,
        total_ingresos: ventas.reduce((s, v) => s + v.total, 0),
        total_efectivo: ventas.filter(v => v.metodo_pago === 'EFECTIVO').reduce((s, v) => s + v.total, 0),
        total_yape: ventas.filter(v => v.metodo_pago === 'YAPE_PLIN').reduce((s, v) => s + v.total, 0),
        total_tarjeta: ventas.filter(v => v.metodo_pago === 'TARJETA').reduce((s, v) => s + v.total, 0),
        ventas_anuladas: db.data.ventas.filter(v => v.anulada && new Date(v.fecha).toDateString() === hoy).length
    });
});

// ─── GET /api/ventas ─────────────────────────
router.get('/', (req, res) => {
    const { limit = 50 } = req.query;
    const ventas = [...db.data.ventas]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, parseInt(limit));
    res.json(ventas);
});

// ─── GET /api/ventas/:id ─────────────────────
router.get('/:id', (req, res) => {
    const venta = db.data.ventas.find(v => v.id === parseInt(req.params.id));
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(venta);
});

// ─── PUT /api/ventas/:id/anular ──────────────
router.put('/:id/anular', (req, res) => {
    const { motivo } = req.body;
    if (!motivo) return res.status(400).json({ error: 'Debe indicar el motivo de anulación' });

    const id = parseInt(req.params.id);
    const idx = db.data.ventas.findIndex(v => v.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Venta no encontrada' });

    const venta = db.data.ventas[idx];
    if (venta.anulada) return res.status(400).json({ error: 'La venta ya está anulada' });

    // Marcar como anulada
    db.data.ventas[idx].anulada = true;
    db.data.ventas[idx].motivo_anulacion = motivo;
    db.data.ventas[idx].fecha_anulacion = new Date().toISOString();

    // Restaurar stock
    for (const item of venta.items) {
        const pIdx = db.data.productos.findIndex(p => p.id === item.producto_id);
        if (pIdx !== -1) db.data.productos[pIdx].stock += item.cantidad;
    }

    // Registrar movimiento de anulación
    db.data.movimientos_caja.push({
        id: nextId('movimientos'),
        tipo: 'ANULACION',
        monto: -venta.total,
        descripcion: `Anulación ${venta.numero_comprobante}: ${motivo}`,
        metodo_pago: venta.metodo_pago,
        referencia_id: venta.id,
        fecha: new Date().toISOString()
    });

    // Actualizar saldo caja
    db.data.caja_estado.saldo_sistema = (db.data.caja_estado.saldo_sistema || 0) - venta.total;

    db.write();
    res.json({ message: 'Venta anulada correctamente', numero: venta.numero_comprobante });
});

module.exports = router;
