/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Módulo de Inventario
 *  CRUD de productos, carga CSV
 *  Versión standalone (sin servidor)
 * ════════════════════════════════════════════════
 */

// ─── Cargar inventario ─────────────────────────
let invDebounce = null;

document.getElementById('inv-buscar').addEventListener('input', () => {
    clearTimeout(invDebounce);
    invDebounce = setTimeout(() => cargarInventario(), 250);
});

document.getElementById('inv-categoria').addEventListener('change', () => cargarInventario());

function cargarInventario() {
    const q = document.getElementById('inv-buscar').value.trim();
    const cat = document.getElementById('inv-categoria').value;
    const tbody = document.getElementById('inv-tabla-body');

    try {
        const productos = DB.getProductos(q, cat);

        if (productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem">
                        No se encontraron productos
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = productos.map(p => {
                const stockClass = p.stock <= 0 ? 'agotado' : p.stock <= p.stock_minimo ? 'bajo' : 'ok';
                return `
                    <tr>
                        <td><code style="font-size:0.78rem">${p.codigo_barras || '—'}</code></td>
                        <td><strong>${p.nombre}</strong></td>
                        <td>${p.categoria}</td>
                        <td>${formatMoney(p.precio_venta)}</td>
                        <td><span class="prod-stock ${stockClass}">${p.stock} ${p.unidad}</span></td>
                        <td>
                            <div class="table-actions">
                                <button class="btn-icon" onclick="editarProducto(${p.id})" title="Editar">✏️</button>
                                <button class="btn-icon danger" onclick="desactivarProducto(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')" title="Desactivar">🗑</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color:var(--danger); padding:2rem">
                    Error: ${err.message}
                </td>
            </tr>
        `;
    }

    cargarCategorias();
}

function cargarCategorias() {
    try {
        const categorias = DB.getCategorias();
        const select = document.getElementById('inv-categoria');
        const currentValue = select.value;

        let html = '<option value="">Todas las categorías</option>';
        categorias.forEach(cat => {
            html += `<option value="${cat}" ${cat === currentValue ? 'selected' : ''}>${cat}</option>`;
        });
        select.innerHTML = html;

        const datalist = document.getElementById('categorias-list');
        if (datalist) {
            datalist.innerHTML = categorias.map(c => `<option value="${c}">`).join('');
        }
    } catch { /* Silencioso */ }
}

// ─── Nuevo producto ────────────────────────────
document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
    limpiarFormProducto();
    document.getElementById('modal-producto-titulo').textContent = 'Nuevo Producto';
    abrirModal('modal-producto');
});

function limpiarFormProducto() {
    document.getElementById('prod-edit-id').value = '';
    document.getElementById('prod-codigo').value = '';
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-precio-venta').value = '';
    document.getElementById('prod-precio-compra').value = '';
    document.getElementById('prod-stock').value = '0';
    document.getElementById('prod-stock-min').value = '5';
    document.getElementById('prod-categoria').value = '';
    document.getElementById('prod-unidad').value = 'UND';
}

// ─── Código de barras en el formulario ─────
// El escáner USB escribe el código en el campo y
// termina con un Enter; la cámara llama directo a
// aplicarCodigoEnFormulario() desde barcode.js.
const inputProdCodigo = document.getElementById('prod-codigo');

inputProdCodigo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Se une lo capturado antes del foco con lo que entró al campo
    aplicarCodigoEnFormulario(tomarBufferPendiente() + inputProdCodigo.value);
});

function aplicarCodigoEnFormulario(codigo) {
    codigo = (codigo || '').trim();
    const anterior = inputProdCodigo.value.trim();
    if (!codigo) {
        inputProdCodigo.focus();
        return;
    }

    inputProdCodigo.value = codigo;

    const editId = document.getElementById('prod-edit-id').value;
    const existente = DB.getProductoPorCodigo(codigo);

    // Ese código ya pertenece a otro producto → ofrecer editarlo
    // (caso típico: escanear algo que ya está registrado para reponer stock)
    if (existente && String(existente.id) !== editId) {
        if (confirm(`"${existente.nombre}" ya está registrado con el código ${codigo}.

¿Deseas editar ese producto?`)) {
            editarProducto(existente.id);
            toast(`✏️ Editando ${existente.nombre}`, 'info');
            setTimeout(() => document.getElementById('prod-stock').focus(), 250);
            return;
        }
        toast('⚠️ Ese código ya está en uso', 'warning');
        // No dejamos un código que el guardado va a rechazar
        inputProdCodigo.value = anterior === codigo ? '' : anterior;
        inputProdCodigo.focus();
        return;
    }

    toast(`✅ Código ${codigo}`, 'success', 1500);
    document.getElementById('prod-nombre').focus();
}

// ─── Editar producto ───────────────────────────
function editarProducto(id) {
    try {
        const p = DB.getProductoById(id);
        if (!p) throw new Error('Producto no encontrado');

        document.getElementById('prod-edit-id').value = p.id;
        document.getElementById('prod-codigo').value = p.codigo_barras || '';
        document.getElementById('prod-nombre').value = p.nombre;
        document.getElementById('prod-precio-venta').value = p.precio_venta;
        document.getElementById('prod-precio-compra').value = p.precio_compra;
        document.getElementById('prod-stock').value = p.stock;
        document.getElementById('prod-stock-min').value = p.stock_minimo;
        document.getElementById('prod-categoria').value = p.categoria;
        document.getElementById('prod-unidad').value = p.unidad;

        document.getElementById('modal-producto-titulo').textContent = 'Editar Producto';
        abrirModal('modal-producto');
    } catch (err) {
        toast(`❌ ${err.message}`, 'error');
    }
}

// ─── Guardar producto (crear o actualizar) ─────
document.getElementById('btn-guardar-producto').addEventListener('click', () => {
    const id = document.getElementById('prod-edit-id').value;
    const nombre = document.getElementById('prod-nombre').value.trim();
    const precioVenta = document.getElementById('prod-precio-venta').value;

    if (!nombre) {
        toast('⚠️ El nombre es requerido', 'warning');
        return;
    }
    if (!precioVenta || parseFloat(precioVenta) < 0) {
        toast('⚠️ El precio de venta es requerido', 'warning');
        return;
    }

    const data = {
        codigo_barras: document.getElementById('prod-codigo').value.trim() || null,
        nombre,
        precio_venta: parseFloat(precioVenta),
        precio_compra: parseFloat(document.getElementById('prod-precio-compra').value) || 0,
        stock: parseInt(document.getElementById('prod-stock').value) || 0,
        stock_minimo: parseInt(document.getElementById('prod-stock-min').value) || 5,
        categoria: document.getElementById('prod-categoria').value.trim() || 'General',
        unidad: document.getElementById('prod-unidad').value
    };

    try {
        if (id) {
            DB.actualizarProducto(parseInt(id), data);
            toast('✅ Producto actualizado', 'success');
        } else {
            DB.crearProducto(data);
            toast('✅ Producto creado', 'success');
        }

        cerrarModal('modal-producto');
        cargarInventario();
        // Actualizar búsqueda en ventas
        buscarProductos(document.getElementById('input-buscar').value.trim());
    } catch (err) {
        toast(`❌ ${err.message}`, 'error');
    }
});

// ─── Desactivar producto (Soft Delete) ─────────
function desactivarProducto(id, nombre) {
    if (!confirm(`¿Desactivar "${nombre}"?\n\nEl producto no se eliminará, solo se ocultará de la venta.`)) {
        return;
    }

    try {
        DB.desactivarProducto(id);
        toast('✅ Producto desactivado', 'success');
        cargarInventario();
        buscarProductos(document.getElementById('input-buscar').value.trim());
    } catch (err) {
        toast(`❌ ${err.message}`, 'error');
    }
}

// ─── Carga CSV (procesado en cliente) ──────────
document.getElementById('btn-csv-upload').addEventListener('click', () => {
    document.getElementById('csv-resultado').style.display = 'none';
    document.getElementById('csv-file-input').value = '';
    abrirModal('modal-csv');
});

document.getElementById('csv-upload-area').addEventListener('click', () => {
    document.getElementById('csv-file-input').click();
});

document.getElementById('csv-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const resultadoEl = document.getElementById('csv-resultado');
    resultadoEl.style.display = 'block';
    resultadoEl.innerHTML = '<p style="color:var(--text-muted)">Procesando archivo...</p>';

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const contenido = evt.target.result;
            const result = DB.procesarCSV(contenido);

            resultadoEl.innerHTML = `
                <div style="padding:1rem; border-radius:var(--radius); background:var(--success-light); color:var(--success)">
                    <strong>✅ Carga completada</strong><br>
                    Insertados: ${result.insertados} | Omitidos: ${result.omitidos} | Total procesados: ${result.total}
                </div>
            `;

            cargarInventario();
            buscarProductos(document.getElementById('input-buscar').value.trim());
        } catch (err) {
            resultadoEl.innerHTML = `
                <div style="padding:1rem; border-radius:var(--radius); background:var(--danger-light); color:var(--danger)">
                    <strong>❌ Error:</strong> ${err.message}
                </div>
            `;
        }
    };
    reader.readAsText(file, 'UTF-8');
});
