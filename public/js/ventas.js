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

    actualizarBarraCobro();
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
    actualizarBotonQr();
    actualizarBotonCobrar();
});

// ─── QR de Yape / Plin para el cliente ──────
// Solo tiene sentido con Yape/Plin elegido y un QR cargado.
const btnMostrarQr = document.getElementById('btn-mostrar-qr');

function actualizarBotonQr() {
    const cfg = APP.config || DB.getConfig();
    const mostrar = metodoPago === 'YAPE_PLIN' && !!cfg.yape_qr;
    btnMostrarQr.classList.toggle('visible', mostrar);
}

btnMostrarQr.addEventListener('click', () => {
    const cfg = APP.config || DB.getConfig();
    if (!cfg.yape_qr) return;

    document.getElementById('qr-pago-monto').textContent = formatMoney(calcularTotal());
    document.getElementById('qr-pago-img').src = cfg.yape_qr;
    document.getElementById('qr-pago-nombre').textContent = cfg.yape_nombre || cfg.nombre;
    document.getElementById('qr-pago-numero').textContent = cfg.yape_numero || '';

    abrirModal('modal-qr-pago');
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

let ultimaVenta = null;
let ultimaVentaImagen = null;

function mostrarRecibo(result) {
    ultimaVenta = result;

    // Se dibuja de una vez: compartir más tarde debe ser
    // inmediato, o Android descarta el permiso del toque.
    ultimaVentaImagen = null;
    dibujarComprobante(result, (blob) => { ultimaVentaImagen = blob; });
    document.getElementById('recibo-telefono').value = '';
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

// ─── Barra de cobro flotante (celular) ──────
// El total y el botón Cobrar quedan fuera de pantalla
// mientras se eligen productos: esta barra los acerca.

const barraCobro = document.getElementById('barra-cobro');
let cobrarALaVista = true;

document.getElementById('barra-cobro-btn').addEventListener('click', () => {
    document.querySelector('.venta-footer').scrollIntoView({ behavior: 'smooth', block: 'end' });
});

// Si el botón Cobrar ya se ve, la barra sobra
if ('IntersectionObserver' in window) {
    new IntersectionObserver((entradas) => {
        cobrarALaVista = entradas[0].isIntersecting;
        actualizarBarraCobro();
    }, { threshold: 0.4 }).observe(document.getElementById('btn-cobrar'));
}

function actualizarBarraCobro() {
    const unidades = ventaActual.reduce((s, i) => s + i.cantidad, 0);
    const hayVenta = ventaActual.length > 0;

    document.getElementById('barra-cobro-items').textContent =
        `${unidades} ${unidades === 1 ? 'producto' : 'productos'}`;
    document.getElementById('barra-cobro-total').textContent = formatMoney(calcularTotal());

    const mostrar = hayVenta && !cobrarALaVista &&
                    APP.currentSection === 'ventas' && esMobile();
    barraCobro.classList.toggle('visible', mostrar);
    document.body.classList.toggle('con-barra-cobro', mostrar);
}

// ─── Enviar el comprobante por WhatsApp ──────
// Se abre WhatsApp con el mensaje ya escrito; el envío lo
// confirma la persona. No existe forma de mandarlo solo sin
// contratar la API de WhatsApp Business.

document.getElementById('btn-enviar-whatsapp').addEventListener('click', enviarComprobanteWhatsApp);

document.getElementById('recibo-telefono').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        enviarComprobanteWhatsApp();
    }
});

function enviarComprobanteWhatsApp() {
    if (!ultimaVenta) return;

    const telefono = normalizarTelefono(document.getElementById('recibo-telefono').value);
    if (telefono === null) {
        toast('⚠️ Número inválido. Usa 9 dígitos: 987654321', 'warning', 4000);
        document.getElementById('recibo-telefono').focus();
        return;
    }

    const texto = encodeURIComponent(textoComprobante(ultimaVenta));
    // Sin número, WhatsApp pide elegir el contacto
    const url = telefono
        ? `https://wa.me/${telefono}?text=${texto}`
        : `https://wa.me/?text=${texto}`;

    window.open(url, '_blank');
}

// Devuelve el número listo para wa.me, '' si no se escribió
// ninguno, o null si lo escrito no sirve.
function normalizarTelefono(valor) {
    const digitos = (valor || '').replace(/\D/g, '');
    if (!digitos) return '';

    // Celular peruano: 9 dígitos empezando en 9
    if (digitos.length === 9 && digitos.charAt(0) === '9') return '51' + digitos;

    // Ya trae el código de país
    if (digitos.length === 11 && digitos.indexOf('51') === 0) return digitos;

    // Otro país: se acepta tal cual si tiene largo razonable
    if (digitos.length >= 10 && digitos.length <= 15) return digitos;

    return null;
}

function textoComprobante(venta) {
    const cfg = APP.config || DB.getConfig();

    const fecha = new Date(venta.fecha).toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const tipo = venta.tipo_comprobante === 'BOLETA' ? 'Boleta de Venta' : 'Ticket';
    const metodos = { EFECTIVO: 'Efectivo', YAPE_PLIN: 'Yape/Plin', TARJETA: 'Tarjeta' };

    // WhatsApp entiende *negrita* y los saltos de línea tal cual
    const lineas = [`*${cfg.nombre}*`];

    if (cfg.ruc) lineas.push(`RUC ${cfg.ruc}`);
    if (cfg.direccion) lineas.push(cfg.direccion);

    lineas.push('');
    lineas.push(`${tipo} ${venta.numero_comprobante}`);
    lineas.push(fecha);
    lineas.push('');

    venta.items.forEach(i => {
        lineas.push(`${i.cantidad} x ${i.nombre} — ${formatMoney(i.precio_unitario * i.cantidad)}`);
    });

    lineas.push('');
    lineas.push(`*TOTAL: ${formatMoney(venta.total)}*`);
    lineas.push(`Pago: ${metodos[venta.metodo_pago] || venta.metodo_pago}`);

    if (venta.metodo_pago === 'EFECTIVO' && venta.vuelto > 0) {
        lineas.push(`Pagó con: ${formatMoney(venta.monto_pagado)}`);
        lineas.push(`Vuelto: ${formatMoney(venta.vuelto)}`);
    }

    lineas.push('');
    lineas.push('¡Gracias por su compra!');

    if (cfg.telefono) {
        lineas.push(`Pedidos: ${cfg.telefono}`);
    }

    return lineas.join(String.fromCharCode(10));
}


// ─── Comprobante como imagen ───────────────────
// WhatsApp no deja adjuntar por enlace, pero el celular
// sí puede compartir un archivo con la hoja nativa de
// Android. Se dibuja el comprobante en un canvas y se
// comparte como PNG; en la PC se descarga.

const RECIBO_ANCHO = 520;
const RECIBO_ESCALA = 2;   // para que no se vea pixelado

function dibujarComprobante(venta, callback) {
    const cfg = APP.config || DB.getConfig();

    const fecha = new Date(venta.fecha).toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    const tipo = venta.tipo_comprobante === 'BOLETA' ? 'BOLETA DE VENTA' : 'TICKET';
    const metodos = { EFECTIVO: 'Efectivo', YAPE_PLIN: 'Yape/Plin' };

    // Altura variable según cuántos productos lleve
    const alturaBase = 430;
    const alturaItems = venta.items.length * 30;
    const alturaExtra = (venta.metodo_pago === 'EFECTIVO' && venta.vuelto > 0) ? 56 : 0;
    const alto = alturaBase + alturaItems + alturaExtra;

    const canvas = document.createElement('canvas');
    canvas.width = RECIBO_ANCHO * RECIBO_ESCALA;
    canvas.height = alto * RECIBO_ESCALA;
    const ctx = canvas.getContext('2d');
    ctx.scale(RECIBO_ESCALA, RECIBO_ESCALA);

    const M = 36;                    // margen
    const DER = RECIBO_ANCHO - M;    // borde derecho del texto
    let y = 0;

    // Fondo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, RECIBO_ANCHO, alto);

    // Franja superior
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, RECIBO_ANCHO, 8);

    const fuente = (peso, tam) => `${peso} ${tam}px Inter, -apple-system, Segoe UI, sans-serif`;

    function linea(yy) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(M, yy);
        ctx.lineTo(DER, yy);
        ctx.stroke();
    }

    function terminar() {
        canvas.toBlob((blob) => callback(blob), 'image/png');
    }

    function pintarTexto() {
        // Nombre del negocio
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0f172a';
        ctx.font = fuente(800, 26);
        ctx.fillText(cfg.nombre, RECIBO_ANCHO / 2, y);
        y += 24;

        ctx.font = fuente(400, 13);
        ctx.fillStyle = '#64748b';
        if (cfg.ruc) { ctx.fillText('RUC ' + cfg.ruc, RECIBO_ANCHO / 2, y); y += 18; }
        if (cfg.direccion) { ctx.fillText(cfg.direccion, RECIBO_ANCHO / 2, y); y += 18; }

        y += 10;
        linea(y);
        y += 28;

        // Tipo y número
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a';
        ctx.font = fuente(700, 14);
        ctx.fillText(tipo, M, y);
        ctx.textAlign = 'right';
        ctx.font = fuente(600, 14);
        ctx.fillText(venta.numero_comprobante, DER, y);
        y += 20;

        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = fuente(400, 12);
        ctx.fillText(fecha, DER, y);
        y += 18;

        linea(y);
        y += 28;

        // Productos
        venta.items.forEach((item) => {
            const importe = formatMoney(item.precio_unitario * item.cantidad);

            ctx.textAlign = 'right';
            ctx.fillStyle = '#0f172a';
            ctx.font = fuente(600, 14);
            ctx.fillText(importe, DER, y);

            ctx.textAlign = 'left';
            ctx.font = fuente(400, 14);
            const anchoImporte = ctx.measureText(importe).width + 24;
            const etiqueta = `${item.cantidad} x ${item.nombre}`;
            ctx.fillText(recortar(ctx, etiqueta, DER - M - anchoImporte), M, y);

            y += 30;
        });

        y += 2;
        linea(y);
        y += 34;

        // Total
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.font = fuente(600, 14);
        ctx.fillText('TOTAL', M, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f172a';
        ctx.font = fuente(800, 30);
        ctx.fillText(formatMoney(venta.total), DER, y + 6);
        y += 40;

        // Pago
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.font = fuente(400, 13);
        ctx.fillText('Pago: ' + (metodos[venta.metodo_pago] || venta.metodo_pago), M, y);
        y += 22;

        if (venta.metodo_pago === 'EFECTIVO' && venta.vuelto > 0) {
            ctx.fillText('Pagó con: ' + formatMoney(venta.monto_pagado), M, y);
            y += 20;
            ctx.fillStyle = '#059669';
            ctx.font = fuente(700, 14);
            ctx.fillText('Vuelto: ' + formatMoney(venta.vuelto), M, y);
            y += 24;
        }

        y += 12;
        linea(y);
        y += 30;

        // Pie
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0f172a';
        ctx.font = fuente(700, 15);
        ctx.fillText('¡Gracias por su compra!', RECIBO_ANCHO / 2, y);
        y += 22;

        if (cfg.telefono) {
            ctx.fillStyle = '#64748b';
            ctx.font = fuente(400, 13);
            ctx.fillText('Pedidos: ' + cfg.telefono, RECIBO_ANCHO / 2, y);
        }

        terminar();
    }

    // La foto del negocio encabeza el comprobante
    if (cfg.foto) {
        const logo = new Image();
        logo.onload = () => {
            const lado = 64;
            const x = (RECIBO_ANCHO - lado) / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(RECIBO_ANCHO / 2, 40 + lado / 2, lado / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(logo, x, 40, lado, lado);
            ctx.restore();
            y = 40 + lado + 34;
            pintarTexto();
        };
        logo.onerror = () => { y = 60; pintarTexto(); };
        logo.src = cfg.foto;
    } else {
        y = 60;
        pintarTexto();
    }
}

// Corta el nombre con puntos suspensivos si no entra
function recortar(ctx, texto, anchoMax) {
    if (ctx.measureText(texto).width <= anchoMax) return texto;

    let corto = texto;
    while (corto.length > 4 && ctx.measureText(corto + '…').width > anchoMax) {
        corto = corto.slice(0, -1);
    }
    return corto + '…';
}

function enviarComprobanteImagen() {
    if (!ultimaVenta) return;

    // Si ya está lista se comparte sin pasos intermedios:
    // así el navegador sigue viendo el toque del usuario.
    if (ultimaVentaImagen) {
        compartirImagen(ultimaVentaImagen);
        return;
    }

    const btn = document.getElementById('btn-enviar-imagen');
    btn.disabled = true;

    dibujarComprobante(ultimaVenta, (blob) => {
        btn.disabled = false;
        if (!blob) {
            toast('❌ No se pudo generar la imagen', 'error');
            return;
        }
        compartirImagen(blob);
    });
}

function compartirImagen(blob) {
    const nombre = `comprobante-${ultimaVenta.numero_comprobante}.png`;
    const archivo = new File([blob], nombre, { type: 'image/png' });

    // En el celular: hoja nativa para elegir WhatsApp
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        navigator.share({
            files: [archivo],
            text: textoComprobante(ultimaVenta)
        }).catch(() => { /* el usuario canceló */ });
        return;
    }

    // En la PC: se descarga para adjuntarla a mano
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('📥 Imagen descargada — adjúntala en WhatsApp', 'info', 5000);
}

document.getElementById('btn-enviar-imagen').addEventListener('click', enviarComprobanteImagen);

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
