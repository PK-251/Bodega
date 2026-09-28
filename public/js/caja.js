/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Módulo de Caja (Arqueo)
 *  Apertura, cierre, ingresos/egresos manuales
 *  Versión standalone (sin servidor)
 * ════════════════════════════════════════════════
 */

// ─── Cargar estado de caja ─────────────────────
function cargarEstadoCaja() {
    try {
        const estado = DB.getCajaEstado();
        actualizarBadgeCaja(estado.abierta);
        renderEstadoCaja(estado);
        cargarMovimientosCaja();
    } catch (err) {
        toast(`❌ ${err.message}`, 'error');
    }
}

function renderEstadoCaja(estado) {
    document.getElementById('caja-est-estado').textContent = estado.abierta ? '✅ Abierta' : '🔒 Cerrada';
    document.getElementById('caja-est-estado').style.color = estado.abierta ? 'var(--success)' : 'var(--danger)';

    if (estado.abierta) {
        const aperturaMonto = estado.apertura ? estado.apertura.monto : 0;
        document.getElementById('caja-est-apertura').textContent = formatMoney(aperturaMonto);
        document.getElementById('caja-est-saldo').textContent = formatMoney(estado.saldo_sistema || 0);
    } else {
        document.getElementById('caja-est-apertura').textContent = 'S/ 0.00';
        document.getElementById('caja-est-efectivo').textContent = 'S/ 0.00';
        document.getElementById('caja-est-yape').textContent = 'S/ 0.00';
        document.getElementById('caja-est-saldo').textContent = 'S/ 0.00';
    }

    // Cargar resumen de ventas del día
    cargarResumenVentas();
}

function cargarResumenVentas() {
    try {
        const resumen = DB.getResumenHoy();
        document.getElementById('caja-est-efectivo').textContent = formatMoney(resumen.total_efectivo);
        document.getElementById('caja-est-yape').textContent = formatMoney(resumen.total_yape);
    } catch (e) { /* Silencioso */ }
}

function cargarMovimientosCaja() {
    try {
        const movimientos = DB.getMovimientosHoy();
        const container = document.getElementById('caja-movimientos');

        if (movimientos.length === 0) {
            container.innerHTML = `
                <p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:2rem 0">
                    No hay movimientos registrados hoy
                </p>
            `;
            return;
        }

        const tipoIcons = {
            'APERTURA': '🔓',
            'VENTA': '🛒',
            'INGRESO': '📥',
            'EGRESO': '📤',
            'COMPRA': '📥',
            'CIERRE': '🔒',
            'ANULACION': '⚠️'
        };

        container.innerHTML = movimientos.map(m => {
            const hora = new Date(m.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
            const montoClass = m.monto >= 0 ? 'positive' : 'negative';
            const montoPrefix = m.monto >= 0 ? '+' : '';

            return `
                <div class="stat-row">
                    <div>
                        <span style="font-size:0.82rem">${tipoIcons[m.tipo] || '•'} ${m.descripcion || m.tipo}</span>
                        <div style="font-size:0.72rem; color:var(--text-muted)">${hora}</div>
                    </div>
                    <span class="stat-value ${montoClass}">${montoPrefix}${formatMoney(m.monto)}</span>
                </div>
            `;
        }).join('');
    } catch (e) { /* Silencioso */ }
}

// ─── Abrir Caja ────────────────────────────────
document.getElementById('btn-abrir-caja').addEventListener('click', () => {
    document.getElementById('caja-monto-inicial').value = '100';
    abrirModal('modal-abrir-caja');
});

document.getElementById('btn-confirmar-abrir').addEventListener('click', () => {
    const monto = parseFloat(document.getElementById('caja-monto-inicial').value) || 0;

    try {
        DB.abrirCaja(monto);
        cerrarModal('modal-abrir-caja');
        toast('✅ Caja abierta', 'success');
        cargarEstadoCaja();
    } catch (err) {
        toast(`❌ ${err.message}`, 'error');
    }
});

// ─── Movimiento (Ingreso/Egreso) ───────────────
document.getElementById('btn-mov-caja').addEventListener('click', () => {
    document.getElementById('mov-tipo').value = 'INGRESO';
    document.getElementById('mov-monto').value = '';
    document.getElementById('mov-descripcion').value = '';
    abrirModal('modal-mov-caja');
});

document.getElementById('btn-confirmar-mov').addEventListener('click', () => {
    const tipo = document.getElementById('mov-tipo').value;
    const monto = parseFloat(document.getElementById('mov-monto').value);
    const descripcion = document.getElementById('mov-descripcion').value.trim();

    if (!monto || monto <= 0) {
        toast('⚠️ Ingrese un monto válido', 'warning');
        return;
    }
    if (!descripcion) {
        toast('⚠️ Ingrese una descripción', 'warning');
        return;
    }

    try {
        DB.registrarMovimientoCaja({
            tipo,
            monto: tipo === 'EGRESO' ? -Math.abs(monto) : Math.abs(monto),
            descripcion
        });

        cerrarModal('modal-mov-caja');
        toast(`✅ ${tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} registrado`, 'success');
        cargarEstadoCaja();
    } catch (err) {
        toast(`❌ ${err.message}`, 'error');
    }
});

// ─── Cerrar Caja ───────────────────────────────
document.getElementById('btn-cerrar-caja').addEventListener('click', () => {
    document.getElementById('cierre-efectivo').value = '';
    document.getElementById('cierre-obs').value = '';
    abrirModal('modal-cerrar-caja');
});

document.getElementById('btn-confirmar-cierre').addEventListener('click', () => {
    const efectivo = parseFloat(document.getElementById('cierre-efectivo').value);
    const obs = document.getElementById('cierre-obs').value.trim();

    if (isNaN(efectivo) || efectivo < 0) {
        toast('⚠️ Ingrese el efectivo contado', 'warning');
        return;
    }

    try {
        const result = DB.cerrarCaja(efectivo, obs);
        cerrarModal('modal-cerrar-caja');

        if (result.cuadra) {
            toast('✅ Caja cerrada — ¡Cuadre perfecto!', 'success', 5000);
        } else {
            toast(`⚠️ Caja cerrada — Diferencia: ${formatMoney(result.diferencia)}`, 'warning', 8000);
        }

        cargarEstadoCaja();
    } catch (err) {
        toast(`❌ ${err.message}`, 'error');
    }
});

// ─── Anulación de ventas ───────────────────────
document.getElementById('btn-confirmar-anular').addEventListener('click', () => {
    const ventaId = parseInt(document.getElementById('anular-venta-id').value);
    const motivo = document.getElementById('anular-motivo').value.trim();

    if (!motivo) {
        toast('⚠️ Indique el motivo de anulación', 'warning');
        return;
    }

    try {
        DB.anularVenta(ventaId, motivo);
        cerrarModal('modal-anular');
        toast('✅ Venta anulada — Stock restaurado', 'success');
        cargarEstadoCaja();
    } catch (err) {
        toast(`❌ ${err.message}`, 'error');
    }
});
