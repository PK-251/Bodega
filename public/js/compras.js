/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Módulo de Compras
 *  Ingreso de mercadería, pago a proveedores
 *  El stock sube y la caja paga (contado o crédito)
 * ════════════════════════════════════════════════
 */

// ─── Estado de la compra en edición ────────────
let compraItems = [];
let compraCondicion = 'CONTADO';
let compraMetodoPago = 'EFECTIVO';
let pagoMetodoSeleccionado = 'EFECTIVO';
let comprasDebounce = null;

// ─── Listado de compras ────────────────────────
document.getElementById('compras-buscar').addEventListener('input', () => {
    clearTimeout(comprasDebounce);
    comprasDebounce = setTimeout(() => cargarCompras(), 250);
});

document.getElementById('compras-estado').addEventListener('change', () => cargarCompras());

function cargarCompras() {
    const q = document.getElementById('compras-buscar').value.trim();
    const estado = document.getElementById('compras-estado').value;
    const tbody = document.getElementById('compras-tabla-body');

    try {
        renderResumenCompras();
        const compras = DB.getCompras(q, estado);

        if (compras.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem">
                        No hay compras registradas
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = compras.map(c => {
            const fecha = new Date(c.fecha).toLocaleDateString('es-PE', {
                day: '2-digit', month: '2-digit', year: '2-digit'
            });
            const unidades = c.items.reduce((s, i) => s + i.cantidad, 0);
            const doc = c.documento_numero
                ? `${etiquetaDocumento(c.documento_tipo)} ${c.documento_numero}`
                : etiquetaDocumento(c.documento_tipo);

            return `
                <tr ${c.anulada ? 'style="opacity:0.55"' : ''}>
                    <td>
                        <code style="font-size:0.78rem">${c.numero}</code>
                        <div style="font-size:0.72rem; color:var(--text-muted)">${fecha}</div>
                    </td>
                    <td><strong>${escaparHtml(c.proveedor)}</strong></td>
                    <td style="font-size:0.8rem">${escaparHtml(doc)}</td>
                    <td style="font-size:0.8rem">${c.items.length} prod. · ${formatCantidad(unidades)} und.</td>
                    <td><strong>${formatMoney(c.total)}</strong></td>
                    <td>${badgeEstadoCompra(c)}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon" onclick="verDetalleCompra(${c.id})" title="Ver detalle">👁</button>
                            ${!c.pagada && !c.anulada
                                ? `<button class="btn-icon" onclick="abrirPagoCompra(${c.id})" title="Registrar pago">💵</button>`
                                : ''}
                            ${!c.anulada
                                ? `<button class="btn-icon danger" onclick="abrirAnularCompra(${c.id})" title="Anular">🗑</button>`
                                : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:var(--danger); padding:2rem">
                    Error: ${err.message}
                </td>
            </tr>
        `;
    }
}

function renderResumenCompras() {
    const r = DB.getResumenCompras();

    document.getElementById('compras-hoy-total').textContent = formatMoney(r.hoy_total);
    document.getElementById('compras-hoy-cantidad').textContent =
        `${r.hoy_cantidad} ${r.hoy_cantidad === 1 ? 'compra' : 'compras'}`;
    document.getElementById('compras-hoy-efectivo').textContent = formatMoney(r.hoy_efectivo);
    document.getElementById('compras-pend-total').textContent = formatMoney(r.pendientes_total);
    document.getElementById('compras-pend-cantidad').textContent =
        `${r.pendientes_cantidad} ${r.pendientes_cantidad === 1 ? 'compra' : 'compras'}`;

    document.getElementById('card-pendientes').classList.toggle('alerta', r.pendientes_cantidad > 0);
}

function badgeEstadoCompra(c) {
    if (c.anulada) return '<span class="estado-badge anulada">Anulada</span>';
    if (c.pagada) return `<span class="estado-badge pagada">Pagada</span>`;
    return '<span class="estado-badge pendiente">Por pagar</span>';
}

function etiquetaDocumento(tipo) {
    return {
        FACTURA: 'Factura',
        BOLETA: 'Boleta',
        GUIA: 'Guía',
        SIN_DOC: 'Sin documento'
    }[tipo] || tipo;
}

function etiquetaMetodo(metodo) {
    return {
        EFECTIVO: '💵 Efectivo',
        YAPE_PLIN: '📱 Yape/Plin',
        TRANSFERENCIA: '🏦 Transferencia'
    }[metodo] || metodo || '—';
}

function formatCantidad(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto == null ? '' : texto;
    return div.innerHTML;
}

// ─── Nueva compra ──────────────────────────────
document.getElementById('btn-nueva-compra').addEventListener('click', () => {
    limpiarFormCompra();
    abrirModal('modal-compra');
});

function limpiarFormCompra() {
    compraItems = [];
    compraCondicion = 'CONTADO';
    compraMetodoPago = 'EFECTIVO';

    document.getElementById('compra-proveedor').value = '';
    document.getElementById('compra-doc-tipo').value = 'SIN_DOC';
    document.getElementById('compra-doc-numero').value = '';
    document.getElementById('compra-fecha-doc').value = new Date().toISOString().slice(0, 10);
    document.getElementById('compra-buscar-producto').value = '';
    document.getElementById('compra-resultados').innerHTML = '';
    document.getElementById('compra-actualizar-costo').checked = true;

    marcarSeleccion('compra-condicion', 'condicion', 'CONTADO');
    marcarSeleccion('compra-metodo', 'metodo', 'EFECTIVO');
    document.getElementById('compra-metodo-group').style.display = '';

    // Proveedores usados antes, para autocompletar
    document.getElementById('proveedores-list').innerHTML =
        DB.getProveedores().map(p => `<option value="${escaparHtml(p)}">`).join('');

    renderItemsCompra();
}

function marcarSeleccion(grupoId, dataAttr, valor) {
    document.querySelectorAll(`#${grupoId} [data-${dataAttr}]`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset[dataAttr] === valor);
    });
}

// ─── Búsqueda de productos para la compra ──────
const inputBuscarCompra = document.getElementById('compra-buscar-producto');
let buscarCompraDebounce = null;

inputBuscarCompra.addEventListener('input', () => {
    clearTimeout(buscarCompraDebounce);
    buscarCompraDebounce = setTimeout(() => {
        buscarProductosCompra(inputBuscarCompra.value.trim());
    }, 200);
});

// El escáner USB termina con Enter: buscar el código exacto
inputBuscarCompra.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    // Puede que el escáner haya empezado antes de que el campo tomara el foco
    const codigo = (tomarBufferPendiente() + inputBuscarCompra.value).trim();
    if (!codigo) return;

    if (DB.getProductoPorCodigo(codigo)) {
        agregarItemCompraPorCodigo(codigo);
    } else {
        buscarProductosCompra(codigo);
    }
});

function buscarProductosCompra(query) {
    const container = document.getElementById('compra-resultados');

    if (!query) {
        container.innerHTML = '';
        return;
    }

    const productos = DB.getProductos(query).slice(0, 8);

    if (productos.length === 0) {
        container.innerHTML = `
            <div class="compra-resultado-empty">
                Sin coincidencias. Crea el producto en Inventario primero.
            </div>
        `;
        return;
    }

    container.innerHTML = productos.map(p => `
        <div class="compra-resultado" onclick="agregarItemCompra(${p.id})">
            <div>
                <div class="prod-nombre">${escaparHtml(p.nombre)}</div>
                <div class="prod-meta">
                    <span class="codigo">${p.codigo_barras || '—'}</span>
                    <span>stock: ${p.stock} ${p.unidad}</span>
                </div>
            </div>
            <span class="prod-precio">costo ${formatMoney(p.precio_compra)}</span>
        </div>
    `).join('');
}

function agregarItemCompraPorCodigo(codigo) {
    const producto = DB.getProductoPorCodigo(codigo);
    if (!producto) {
        toast('❌ Producto no registrado — créalo en Inventario', 'error');
        return;
    }
    agregarItemCompra(producto.id);
}

function agregarItemCompra(productoId) {
    const producto = DB.getProductoById(productoId);
    if (!producto) return;

    const existente = compraItems.find(i => i.producto_id === productoId);
    if (existente) {
        existente.cantidad += 1;
        toast(`➕ ${producto.nombre} (${formatCantidad(existente.cantidad)})`, 'success', 1200);
    } else {
        compraItems.push({
            producto_id: producto.id,
            nombre: producto.nombre,
            unidad: producto.unidad,
            cantidad: 1,
            costo_unitario: producto.precio_compra || 0
        });
        toast(`✅ ${producto.nombre}`, 'success', 1200);
    }

    // Limpiar la búsqueda para el siguiente escaneo
    inputBuscarCompra.value = '';
    document.getElementById('compra-resultados').innerHTML = '';
    renderItemsCompra();
}

function quitarItemCompra(productoId) {
    compraItems = compraItems.filter(i => i.producto_id !== productoId);
    renderItemsCompra();
}

function actualizarItemCompra(productoId, campo, valor) {
    const item = compraItems.find(i => i.producto_id === productoId);
    if (!item) return;

    const num = parseFloat(valor);
    item[campo] = isNaN(num) || num < 0 ? 0 : num;
    renderItemsCompra(true);
}

function renderItemsCompra(soloTotales = false) {
    const tbody = document.getElementById('compra-items-body');
    const vacio = document.getElementById('compra-items-empty');

    vacio.style.display = compraItems.length === 0 ? '' : 'none';

    // Al editar cantidades no reconstruimos las filas: se perdería el foco
    if (!soloTotales) {
        tbody.innerHTML = compraItems.map(i => `
            <tr>
                <td>
                    <div class="item-nombre">${escaparHtml(i.nombre)}</div>
                    <div class="item-unidad">${i.unidad}</div>
                </td>
                <td>
                    <input type="number" class="item-input" min="0" step="1" value="${i.cantidad}"
                           onchange="actualizarItemCompra(${i.producto_id}, 'cantidad', this.value)"
                           oninput="actualizarItemCompra(${i.producto_id}, 'cantidad', this.value)">
                </td>
                <td>
                    <input type="number" class="item-input" min="0" step="0.10" value="${i.costo_unitario}"
                           onchange="actualizarItemCompra(${i.producto_id}, 'costo_unitario', this.value)"
                           oninput="actualizarItemCompra(${i.producto_id}, 'costo_unitario', this.value)">
                </td>
                <td><strong id="subtotal-${i.producto_id}">${formatMoney(i.cantidad * i.costo_unitario)}</strong></td>
                <td>
                    <button type="button" class="btn-icon danger" onclick="quitarItemCompra(${i.producto_id})" title="Quitar">✕</button>
                </td>
            </tr>
        `).join('');
    } else {
        compraItems.forEach(i => {
            const el = document.getElementById(`subtotal-${i.producto_id}`);
            if (el) el.textContent = formatMoney(i.cantidad * i.costo_unitario);
        });
    }

    const total = compraItems.reduce((s, i) => s + (i.cantidad * i.costo_unitario), 0);
    document.getElementById('compra-total').textContent = formatMoney(total);
}

// ─── Condición y método de pago ────────────────
document.querySelectorAll('#compra-condicion [data-condicion]').forEach(btn => {
    btn.addEventListener('click', () => {
        compraCondicion = btn.dataset.condicion;
        marcarSeleccion('compra-condicion', 'condicion', compraCondicion);
        // Al crédito todavía no hay pago que registrar
        document.getElementById('compra-metodo-group').style.display =
            compraCondicion === 'CONTADO' ? '' : 'none';
    });
});

document.querySelectorAll('#compra-metodo [data-metodo]').forEach(btn => {
    btn.addEventListener('click', () => {
        compraMetodoPago = btn.dataset.metodo;
        marcarSeleccion('compra-metodo', 'metodo', compraMetodoPago);
    });
});

// Pagar en efectivo más de lo que hay en el cajón deja
// la caja en negativo: avisamos, pero la decisión es del dueño
// (muchas veces se completa con plata del bolsillo).
function efectivoAlcanza(total) {
    const disponible = DB.efectivoEsperado();
    if (total <= disponible) return true;

    return confirm(
        `En caja hay ${formatMoney(disponible)} y el pago es ${formatMoney(total)}.

` +
        `¿Registrar igual? La caja quedará en negativo.`
    );
}

// ─── Guardar compra ────────────────────────────
document.getElementById('btn-guardar-compra').addEventListener('click', () => {
    const proveedor = document.getElementById('compra-proveedor').value.trim();

    if (!proveedor) {
        toast('⚠️ Indica el proveedor', 'warning');
        document.getElementById('compra-proveedor').focus();
        return;
    }
    if (compraItems.length === 0) {
        toast('⚠️ Agrega al menos un producto', 'warning');
        return;
    }
    if (compraItems.some(i => !(i.cantidad > 0))) {
        toast('⚠️ Hay productos con cantidad en cero', 'warning');
        return;
    }

    const total = compraItems.reduce((s, i) => s + (i.cantidad * i.costo_unitario), 0);
    if (compraCondicion === 'CONTADO' && compraMetodoPago === 'EFECTIVO' &&
        DB.getCajaEstado().abierta && !efectivoAlcanza(total)) {
        return;
    }

    try {
        const compra = DB.registrarCompra({
            proveedor,
            documento_tipo: document.getElementById('compra-doc-tipo').value,
            documento_numero: document.getElementById('compra-doc-numero').value,
            fecha_documento: document.getElementById('compra-fecha-doc').value || null,
            items: compraItems,
            condicion_pago: compraCondicion,
            metodo_pago: compraMetodoPago,
            actualizar_costo: document.getElementById('compra-actualizar-costo').checked
        });

        cerrarModal('modal-compra');
        toast(`✅ Compra ${compra.numero} registrada — stock actualizado`, 'success', 4000);

        avisarPreciosBajos(compra);

        cargarCompras();
        // Cambió el stock y quizá la caja: refrescar lo que dependa
        if (typeof cargarInventario === 'function') cargarInventario();
        if (typeof cargarEstadoCaja === 'function') cargarEstadoCaja();
        buscarProductos(document.getElementById('input-buscar').value.trim());
    } catch (err) {
        toast(`❌ ${err.message}`, 'error', 5000);
    }
});

// Si un producto quedó vendiéndose por debajo de su costo, avisar
function avisarPreciosBajos(compra) {
    const enRiesgo = compra.items
        .map(i => DB.getProductoById(i.producto_id))
        .filter(p => p && p.precio_venta <= p.precio_compra);

    if (enRiesgo.length > 0) {
        const nombres = enRiesgo.map(p => p.nombre).join(', ');
        toast(`⚠️ Precio de venta por debajo del costo: ${nombres}`, 'warning', 7000);
    }
}

// ─── Detalle de compra ─────────────────────────
function verDetalleCompra(id) {
    const c = DB.getCompraById(id);
    if (!c) return;

    const fecha = new Date(c.fecha).toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    document.getElementById('compra-detalle-titulo').textContent = `Compra ${c.numero}`;

    const filas = c.items.map(i => `
        <div class="stat-row">
            <div>
                <span style="font-size:0.85rem">${escaparHtml(i.nombre)}</span>
                <div style="font-size:0.72rem; color:var(--text-muted)">
                    ${formatCantidad(i.cantidad)} ${i.unidad} × ${formatMoney(i.costo_unitario)}
                </div>
            </div>
            <span class="stat-value">${formatMoney(i.subtotal)}</span>
        </div>
    `).join('');

    document.getElementById('compra-detalle-body').innerHTML = `
        <div class="stat-row">
            <span class="stat-label">Proveedor</span>
            <span class="stat-value">${escaparHtml(c.proveedor)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Registrada</span>
            <span class="stat-value">${fecha}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Documento</span>
            <span class="stat-value">${escaparHtml(etiquetaDocumento(c.documento_tipo))} ${escaparHtml(c.documento_numero || '')}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Condición</span>
            <span class="stat-value">${c.condicion_pago === 'CONTADO' ? 'Contado' : 'Crédito'}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Estado</span>
            <span class="stat-value">${badgeEstadoCompra(c)} ${c.pagada ? etiquetaMetodo(c.metodo_pago) : ''}</span>
        </div>
        ${c.anulada ? `
            <div class="stat-row">
                <span class="stat-label">Motivo anulación</span>
                <span class="stat-value">${escaparHtml(c.motivo_anulacion || '')}</span>
            </div>` : ''}

        <h4 style="margin:var(--space-lg) 0 var(--space-sm); font-size:0.85rem">Productos</h4>
        ${filas}

        <div class="compra-total-row" style="margin-top:var(--space-md)">
            <span>Total</span>
            <span class="compra-total">${formatMoney(c.total)}</span>
        </div>
    `;

    abrirModal('modal-compra-detalle');
}

// ─── Registrar pago de una compra al crédito ───
function abrirPagoCompra(id) {
    const c = DB.getCompraById(id);
    if (!c) return;

    pagoMetodoSeleccionado = 'EFECTIVO';
    marcarSeleccion('pago-metodo', 'metodo', 'EFECTIVO');

    document.getElementById('pago-compra-id').value = c.id;
    document.getElementById('pago-compra-proveedor').textContent = `${c.numero} — ${c.proveedor}`;
    document.getElementById('pago-compra-total').textContent = formatMoney(c.total);

    abrirModal('modal-pagar-compra');
}

document.querySelectorAll('#pago-metodo [data-metodo]').forEach(btn => {
    btn.addEventListener('click', () => {
        pagoMetodoSeleccionado = btn.dataset.metodo;
        marcarSeleccion('pago-metodo', 'metodo', pagoMetodoSeleccionado);
    });
});

document.getElementById('btn-confirmar-pago').addEventListener('click', () => {
    const id = parseInt(document.getElementById('pago-compra-id').value);
    const compra = DB.getCompraById(id);

    if (compra && pagoMetodoSeleccionado === 'EFECTIVO' &&
        DB.getCajaEstado().abierta && !efectivoAlcanza(compra.total)) {
        return;
    }

    try {
        DB.pagarCompra(id, pagoMetodoSeleccionado);
        cerrarModal('modal-pagar-compra');
        toast('✅ Pago registrado', 'success');
        cargarCompras();
        if (typeof cargarEstadoCaja === 'function') cargarEstadoCaja();
    } catch (err) {
        toast(`❌ ${err.message}`, 'error', 5000);
    }
});

// ─── Anular compra ─────────────────────────────
function abrirAnularCompra(id) {
    document.getElementById('anular-compra-id').value = id;
    document.getElementById('anular-compra-motivo').value = '';
    abrirModal('modal-anular-compra');
}

document.getElementById('btn-confirmar-anular-compra').addEventListener('click', () => {
    const id = parseInt(document.getElementById('anular-compra-id').value);
    const motivo = document.getElementById('anular-compra-motivo').value.trim();

    if (!motivo) {
        toast('⚠️ Indica el motivo de la anulación', 'warning');
        return;
    }

    try {
        DB.anularCompra(id, motivo);
        cerrarModal('modal-anular-compra');
        toast('✅ Compra anulada — stock y caja revertidos', 'success', 4000);

        cargarCompras();
        if (typeof cargarInventario === 'function') cargarInventario();
        if (typeof cargarEstadoCaja === 'function') cargarEstadoCaja();
        buscarProductos(document.getElementById('input-buscar').value.trim());
    } catch (err) {
        toast(`❌ ${err.message}`, 'error', 5000);
    }
});
