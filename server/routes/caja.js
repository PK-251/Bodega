const express = require('express');
const router = express.Router();
const { db, nextId } = require('../database');

// ─── GET /api/caja/estado ────────────────────
router.get('/estado', (req, res) => {
    const estado = db.data.caja_estado;
    const resumenHoy = getResumenHoy();

    if (!estado.abierta) {
        return res.json({ abierta: false, saldo: 0, mensaje: 'Caja cerrada' });
    }

    res.json({
        abierta: true,
        saldo_sistema: estado.saldo_sistema || 0,
        efectivo_en_caja: estado.efectivo_en_caja || 0,
        apertura: estado.apertura,
        fecha_apertura: estado.apertura?.fecha
    });
});

// ─── POST /api/caja/apertura ─────────────────
router.post('/apertura', (req, res) => {
    const { monto_inicial = 0 } = req.body;

    if (db.data.caja_estado.abierta) {
        return res.status(400).json({ error: 'Ya existe una caja abierta. Ciérrela primero.' });
    }

    const monto = parseFloat(monto_inicial) || 0;
    const movApertura = {
        id: nextId('movimientos'),
        tipo: 'APERTURA',
        monto,
        descripcion: 'Apertura de caja',
        metodo_pago: null,
        fecha: new Date().toISOString()
    };

    db.data.movimientos_caja.push(movApertura);
    db.data.caja_estado = {
        abierta: true,
        apertura: { monto, fecha: movApertura.fecha },
        saldo_sistema: monto,
        efectivo_en_caja: monto
    };
    db.write();

    res.status(201).json({ message: 'Caja abierta', monto_inicial: monto });
});

// ─── POST /api/caja/movimiento ───────────────
router.post('/movimiento', (req, res) => {
    const { tipo, monto, descripcion } = req.body;

    if (!tipo || !['INGRESO', 'EGRESO'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo debe ser INGRESO o EGRESO' });
    }
    if (!monto || monto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    if (!descripcion) {
        return res.status(400).json({ error: 'Debe indicar una descripción' });
    }
    if (!db.data.caja_estado.abierta) {
        return res.status(400).json({ error: 'La caja no está abierta' });
    }

    const montoFinal = tipo === 'EGRESO' ? -Math.abs(monto) : Math.abs(monto);

    db.data.movimientos_caja.push({
        id: nextId('movimientos'),
        tipo,
        monto: montoFinal,
        descripcion,
        metodo_pago: null,
        fecha: new Date().toISOString()
    });

    db.data.caja_estado.saldo_sistema = (db.data.caja_estado.saldo_sistema || 0) + montoFinal;
    db.data.caja_estado.efectivo_en_caja = (db.data.caja_estado.efectivo_en_caja || 0) + montoFinal;
    db.write();

    res.status(201).json({ message: `${tipo} registrado`, monto: montoFinal });
});

// ─── POST /api/caja/cierre ───────────────────
router.post('/cierre', (req, res) => {
    const { efectivo_contado = 0, observaciones = '' } = req.body;

    if (!db.data.caja_estado.abierta) {
        return res.status(400).json({ error: 'No hay caja abierta para cerrar' });
    }

    const resumen = getResumenHoy();
    const aperturaMonto = db.data.caja_estado.apertura?.monto || 0;
    const efectivoEsperado = aperturaMonto + resumen.total_efectivo + resumen.ingresos_egresos;
    const contado = parseFloat(efectivo_contado);
    const diferencia = Math.round((contado - efectivoEsperado) * 100) / 100;

    const desc = `Cierre | Esperado: S/ ${efectivoEsperado.toFixed(2)} | Contado: S/ ${contado.toFixed(2)} | Dif: S/ ${diferencia.toFixed(2)}${observaciones ? ' | ' + observaciones : ''}`;

    db.data.movimientos_caja.push({
        id: nextId('movimientos'),
        tipo: 'CIERRE',
        monto: 0,
        descripcion: desc,
        metodo_pago: null,
        fecha: new Date().toISOString()
    });

    db.data.caja_estado = {
        abierta: false,
        apertura: null,
        saldo_sistema: 0,
        efectivo_en_caja: 0
    };
    db.write();

    res.json({
        message: 'Caja cerrada',
        efectivo_esperado: Math.round(efectivoEsperado * 100) / 100,
        efectivo_contado: contado,
        diferencia,
        cuadra: Math.abs(diferencia) < 0.01
    });
});

// ─── GET /api/caja/movimientos ───────────────
router.get('/movimientos', (req, res) => {
    const hoy = new Date().toDateString();
    const movimientos = db.data.movimientos_caja
        .filter(m => new Date(m.fecha).toDateString() === hoy)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json(movimientos);
});

// ─── Helper interno ──────────────────────────
function getResumenHoy() {
    const hoy = new Date().toDateString();
    const ventas = db.data.ventas.filter(v => !v.anulada && new Date(v.fecha).toDateString() === hoy);
    const movs = db.data.movimientos_caja.filter(m =>
        ['INGRESO', 'EGRESO'].includes(m.tipo) && new Date(m.fecha).toDateString() === hoy
    );

    return {
        total_efectivo: ventas.filter(v => v.metodo_pago === 'EFECTIVO').reduce((s, v) => s + v.total, 0),
        total_yape: ventas.filter(v => v.metodo_pago === 'YAPE_PLIN').reduce((s, v) => s + v.total, 0),
        total_tarjeta: ventas.filter(v => v.metodo_pago === 'TARJETA').reduce((s, v) => s + v.total, 0),
        ingresos_egresos: movs.reduce((s, m) => s + m.monto, 0)
    };
}

module.exports = router;
