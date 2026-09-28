/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Módulo de Ventas (ventas.js)
 *  Lista de venta, cálculo de vuelto, cobro
 *  Versión standalone (sin servidor)
 * ════════════════════════════════════════════════
 */

// ─── Estado de la venta actual ─────────────────
let ventaActual = [];
let tipoComprobante = 'TICKET';
let metodoPago = 'EFECTIVO';
let debounceTimer = null;

// ─── Búsqueda de productos ─────────────────────
const inputBuscar = document.getElementById('input-buscar');

inputBuscar.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        buscarProductos(e.target.value.trim());
    }, 200);
});

// El escáner USB escribe el código en el buscador y termina
// con Enter. También vale teclear un nombre y confirmar.
inputBuscar.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    // El escáner pudo empezar a disparar antes de que el campo
    // tomara el foco: esa primera parte quedó en el buffer.
    const texto = (tomarBufferPendiente() + inputBuscar.value).trim();
    if (!texto) return;

    agregarDesdeBuscador(texto);
});

function agregarDesdeBuscador(texto) {
    // 1) Código de barras exacto: el caso del escáner
    const porCodigo = DB.getProductoPorCodigo(texto);
    if (porCodigo) {
        agregarProducto(porCodigo.id, porCodigo.nombre, porCodigo.precio_venta, porCodigo.stock);
        toast(`✅ ${porCodigo.nombre}`, 'success', 1500);
        limpiarBuscador();
        return;
    }

    // 2) Un solo resultado por nombre: lo agregamos sin hacer clic
    const coincidencias = DB.getProductos(texto);
    if (coincidencias.length === 1) {
        const p = coincidencias[0];
        agregarProducto(p.id, p.nombre, p.precio_venta, p.stock);
        toast(`✅ ${p.nombre}`, 'success', 1500);
        limpiarBuscador();
        return;
    }

    if (coincidencias.length === 0) {
        toast('❌ Producto no encontrado', 'error');
        return;
    }

    // 3) Varias opciones: que elija de la lista
    toast(`${coincidencias.length} coincidencias — elige de la lista`, 'info', 2000);
}

// Deja el buscador listo para el siguiente escaneo
function limpiarBuscador() {
    inputBuscar.value = '';
    buscarProductos('');
    inputBuscar.focus();
}

function buscarProductos(query) {
    const container = document.getElementById('resultados-lista');
    try {
        const productos = DB.getProductos(query);
        renderResultados(productos);
    } catch (err) {
        container.innerHTML = `
            <div class="resultados-empty">
                <div class="empty-icon">⚠️</div>
                <p>${err.message}</p>
            </div>
        `;
    }
}

function renderResultados(productos) {
    const container = document.getElementById('resultados-lista');

    if (productos.length === 0) {
        container.innerHTML = `
            <div class="resultados-empty">
                <div class="empty-icon">🔍</div>
                <p>No se encontraron productos</p>
            </div>
        `;
        return;
    }

    container.innerHTML = productos.map(p => {
        const stockClass = p.stock <= 0 ? 'agotado' : p.stock <= p.stock_minimo ? 'bajo' : 'ok';
        const stockText = p.stock <= 0 ? 'Agotado' : `${p.stock} ${p.unidad}`;

        return `
            <div class="resultado-item" onclick="agregarProducto(${p.id}, '${p.nombre.replace(/'/g, "\\'")}', ${p.precio_venta}, ${p.stock})" ${p.stock <= 0 ? 'style="opacity:0.5; pointer-events:none"' : ''}>
                <div class="prod-info">
                    <div class="prod-nombre">${p.nombre}</div>
                    <div class="prod-meta">
                        <span class="codigo">${p.codigo_barras || '—'}</span>
                        <span>${p.categoria}</span>
                    </div>
                </div>
                <span class="prod-precio">${formatMoney(p.precio_venta)}</span>
                <span class="prod-stock ${stockClass}">${stockText}</span>
            </div>
        `;
    }).join('');
}

// ─── Agregar producto a la venta ───────────────
function agregarProducto(id, nombre, precio, stockDisp) {
    const existente = ventaActual.find(item => item.producto_id === id);

    if (existente) {
        if (existente.cantidad >= stockDisp) {
            toast('⚠️ Stock insuficiente', 'warning');
            return;
        }
        existente.cantidad++;
    } else {
        ventaActual.push({
            producto_id: id,
            nombre: nombre,
            precio_unitario: precio,
            cantidad: 1,
            stock_disponible: stockDisp
        });
    }

    renderVenta();
    guardarVentaLocal();
}

// Agregar por código de barras (para scanner)
function agregarPorCodigo(codigo) {
    try {
        const producto = DB.getProductoPorCodigo(codigo);
        if (!producto) {
            toast('❌ Producto no encontrado', 'error');
            return;
        }
        agregarProducto(producto.id, producto.nombre, producto.precio_venta, producto.stock);
        toast(`✅ ${producto.nombre}`, 'success', 1500);
    } catch (e) {
        toast('❌ Producto no encontrado', 'error');
    }
}

// ─── Renderizar venta actual ───────────────────
function renderVenta() {
    const container = document.getElementById('venta-items');
    const countEl = document.getElementById('items-count');
    const totalEl = document.getElementById('total-amount');

    if (ventaActual.length === 0) {
        container.innerHTML = `
            <div class="venta-empty" id="venta-empty">
                <div class="empty-cart-icon">🛒</div>
                <p>Agrega productos para iniciar una venta</p>
            </div>
        `;
        countEl.textContent = '0';
        totalEl.textContent = 'S/ 0.00';
        actualizarVuelto();
        actualizarBotonCobrar();
        return;
    }

    const totalItems = ventaActual.reduce((s, i) => s + i.cantidad, 0);
    countEl.textContent = totalItems;

    container.innerHTML = ventaActual.map((item, idx) => {
        const subtotal = item.precio_unitario * item.cantidad;
        return `
            <div class="venta-item">
                <div>
                    <div class="item-nombre">${item.nombre}</div>
                    <div class="item-precio-unit">${formatMoney(item.precio_unitario)} c/u</div>
                </div>
                <div class="qty-control">
                    <button class="qty-btn" onclick="cambiarCantidad(${idx}, -1)">−</button>
                    <input type="number" class="qty-value" value="${item.cantidad}" min="1" max="${item.stock_disponible}" onchange="setCantidad(${idx}, this.value)">
                    <button class="qty-btn" onclick="cambiarCantidad(${idx}, 1)">+</button>
                </div>
                <span class="item-subtotal">${formatMoney(subtotal)}</span>
                <button class="item-remove" onclick="removerItem(${idx})" title="Quitar">✕</button>
            </div>
        `;
    }).join('');

    const total = calcularTotal();
    totalEl.textContent = formatMoney(total);
    actualizarVuelto();
    actualizarBotonCobrar();
}

function calcularTotal() {
    return ventaActual.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
}

// ─── Modificar cantidades ──────────────────────
function cambiarCantidad(idx, delta) {
    const item = ventaActual[idx];
    const nuevaCant = item.cantidad + delta;

    if (nuevaCant <= 0) {
        removerItem(idx);
        return;
    }
    if (nuevaCant > item.stock_disponible) {
        toast('⚠️ Stock insuficiente', 'warning');
        return;
    }

    item.cantidad = nuevaCant;
    renderVenta();
    guardarVentaLocal();
}

function setCantidad(idx, value) {
    const cant = parseInt(value) || 1;
    const item = ventaActual[idx];

    if (cant > item.stock_disponible) {
        toast('⚠️ Stock insuficiente', 'warning');
        item.cantidad = item.stock_disponible;
    } else if (cant < 1) {
        item.cantidad = 1;
    } else {
        item.cantidad = cant;
    }
    renderVenta();
    guardarVentaLocal();
}

function removerItem(idx) {
    ventaActual.splice(idx, 1);
    renderVenta();
    guardarVentaLocal();
}

function vaciarVenta() {
    if (ventaActual.length === 0) return;
    ventaActual = [];
    renderVenta();
    guardarVentaLocal();
    toast('🗑 Lista vaciada', 'info', 1500);
}

// ─── Tipo de comprobante ───────────────────────
document.getElementById('tipo-comprobante').addEventListener('click', (e) => {
    const btn = e.target.closest('.tipo-comprobante-btn');
    if (!btn) return;

    document.querySelectorAll('.tipo-comprobante-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tipoComprobante = btn.dataset.tipo;
});

// ─── Método de pago ────────────────────────────
document.getElementById('metodo-pago').addEventListener('click', (e) => {
    const btn = e.target.closest('.metodo-pago-btn');
    if (!btn) return;

    document.querySelectorAll('.metodo-pago-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    metodoPago = btn.dataset.metodo;

    const vueltoSection = document.getElementById('vuelto-section');
    if (metodoPago === 'EFECTIVO') {
        vueltoSection.classList.add('visible');
    } else {
        vueltoSection.classList.remove('visible');
    }
    actualizarBotonCobrar();
});

// ─── Calculadora de Vuelto ─────────────────────
const inputPagaCon = document.getElementById('input-paga-con');
inputPagaCon.addEventListener('input', actualizarVuelto);

document.getElementById('vuelto-rapido').addEventListener('click', (e) => {
    const btn = e.target.closest('.vuelto-rapido-btn');
    if (!btn) return;

    const monto = btn.dataset.monto;
    if (monto === 'exact') {
        inputPagaCon.value = calcularTotal().toFixed(2);
    } else {
        inputPagaCon.value = parseFloat(monto).toFixed(2);
    }
    actualizarVuelto();
});

function actualizarVuelto() {
    const total = calcularTotal();
    const pagaCon = parseFloat(inputPagaCon.value) || 0;
    const vuelto = pagaCon - total;

    const vueltoEl = document.getElementById('vuelto-amount');
    if (pagaCon === 0 || ventaActual.length === 0) {
        vueltoEl.textContent = 'S/ 0.00';
        vueltoEl.classList.remove('negativo');
    } else if (vuelto < 0) {
        vueltoEl.textContent = `- ${formatMoney(Math.abs(vuelto))}`;
        vueltoEl.classList.add('negativo');
    } else {
        vueltoEl.textContent = formatMoney(vuelto);
        vueltoEl.classList.remove('negativo');
    }

    actualizarBotonCobrar();
}

// ─── Habilitar/deshabilitar botón Cobrar ───────
function actualizarBotonCobrar() {
    const btn = document.getElementById('btn-cobrar');
    const total = calcularTotal();

    if (ventaActual.length === 0 || total <= 0) {
        btn.disabled = true;
        return;
    }

    if (metodoPago === 'EFECTIVO') {
        const pagaCon = parseFloat(inputPagaCon.value) || 0;
        btn.disabled = pagaCon < total;
    } else {
        btn.disabled = false;
    }
}

// ─── Vaciar venta ──────────────────────────────
document.getElementById('btn-vaciar').addEventListener('click', vaciarVenta);

// ─── Cobrar ────────────────────────────────────
document.getElementById('btn-cobrar').addEventListener('click', realizarCobro);

function realizarCobro() {
    if (ventaActual.length === 0) return;

    const total = calcularTotal();
    const pagaCon = metodoPago === 'EFECTIVO'
        ? parseFloat(inputPagaCon.value) || total
        : total;

    if (metodoPago === 'EFECTIVO' && pagaCon < total) {
        toast('⚠️ Monto insuficiente', 'warning');
        return;
    }

    const btnCobrar = document.getElementById('btn-cobrar');
    btnCobrar.disabled = true;
    btnCobrar.textContent = 'Procesando...';

    try {
        const result = DB.registrarVenta({
            items: ventaActual.map(item => ({
                producto_id: item.producto_id,
                nombre: item.nombre,
                precio_unitario: item.precio_unitario,
                cantidad: item.cantidad
            })),
            tipo_comprobante: tipoComprobante,
            metodo_pago: metodoPago,
            monto_pagado: pagaCon
        });

        // Mostrar recibo
        mostrarRecibo(result);

        // Limpiar venta
        ventaActual = [];
        renderVenta();
        guardarVentaLocal();
        inputPagaCon.value = '';
        actualizarVuelto();

        // Actualizar badge de caja
        const estado = DB.getCajaEstado();
        actualizarBadgeCaja(estado.abierta);

        // Refrescar búsqueda para actualizar stocks
        buscarProductos(inputBuscar.value.trim());

    } catch (err) {
        toast(`❌ ${err.message}`, 'error', 5000);
    } finally {
        btnCobrar.disabled = false;
        btnCobrar.innerHTML = '✅ Cobrar <span class="shortcut">(F2)</span>';
        actualizarBotonCobrar();
    }
}

function mostrarRecibo(result) {
    document.getElementById('recibo-numero').textContent = result.numero_comprobante;
    document.getElementById('recibo-total').textContent = formatMoney(result.total);

    const metodoLabels = {
        'EFECTIVO': 'Efectivo',
        'YAPE_PLIN': 'Yape/Plin',
        'TARJETA': 'Tarjeta'
    };

    let detalleHTML = `
        <div class="rd-row"><span>Tipo:</span><span>${result.tipo_comprobante === 'TICKET' ? 'Ticket Simple' : 'Boleta de Venta'}</span></div>
        <div class="rd-row"><span>Método:</span><span>${metodoLabels[result.metodo_pago]}</span></div>
    `;

    if (result.metodo_pago === 'EFECTIVO' && result.vuelto > 0) {
        detalleHTML += `
            <div class="rd-row"><span>Pagó con:</span><span>${formatMoney(result.monto_pagado)}</span></div>
            <div class="rd-row" style="color:var(--success); font-weight:700"><span>Vuelto:</span><span>${formatMoney(result.vuelto)}</span></div>
        `;
    }

    document.getElementById('recibo-detalle').innerHTML = detalleHTML;
    abrirModal('modal-venta-ok');
}

// ─── LocalStorage: Contingencia ────────────────
function guardarVentaLocal() {
    try {
        localStorage.setItem('bodega_venta_temp', JSON.stringify(ventaActual));
    } catch (e) { /* Silencioso */ }
}

function restaurarVentaLocal() {
    try {
        const data = localStorage.getItem('bodega_venta_temp');
        if (data) {
            const items = JSON.parse(data);
            if (Array.isArray(items) && items.length > 0) {
                ventaActual = items;
                renderVenta();
                toast('ℹ️ Venta anterior restaurada', 'info');
            }
        }
    } catch (e) { /* Silencioso */ }
}
