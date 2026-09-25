/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Base de Datos (LocalStorage)
 *  Reemplaza al servidor Node.js/SQLite
 *  Todos los datos persisten en el navegador
 * ════════════════════════════════════════════════
 */

const DB = {
    // ─── Claves en LocalStorage ────────────────
    KEYS: {
        productos: 'bodega_productos',
        ventas: 'bodega_ventas',
        movimientos: 'bodega_movimientos',
        compras: 'bodega_compras',
        caja: 'bodega_caja_estado',
        secuencias: 'bodega_secuencias'
    },

    // ─── Leer colección ────────────────────────
    get(key) {
        try {
            return JSON.parse(localStorage.getItem(this.KEYS[key]) || '[]');
        } catch { return []; }
    },

    // ─── Escribir colección ────────────────────
    set(key, data) {
        try {
            if (key === 'caja') {
                localStorage.setItem(this.KEYS[key], JSON.stringify(data));
            } else {
                localStorage.setItem(this.KEYS[key], JSON.stringify(data));
            }
        } catch (e) {
            console.error('Error guardando en localStorage:', e);
        }
    },

    // ─── Obtener siguiente ID autoincremental ──
    nextId(coleccion) {
        let seqs = {};
        try { seqs = JSON.parse(localStorage.getItem(this.KEYS.secuencias) || '{}'); } catch {}
        seqs[coleccion] = (seqs[coleccion] || 0) + 1;
        localStorage.setItem(this.KEYS.secuencias, JSON.stringify(seqs));
        return seqs[coleccion];
    },

    // ═══════════════════════════════════════════
    //  PRODUCTOS
    // ═══════════════════════════════════════════

    getProductos(q = '', categoria = '') {
        let productos = this.get('productos').filter(p => p.activo !== false);
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
        return productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    },

    getProductoById(id) {
        return this.get('productos').find(p => p.id === id) || null;
    },

    getProductoPorCodigo(codigo) {
        return this.get('productos').find(p =>
            p.activo !== false && p.codigo_barras === codigo
        ) || null;
    },

    getCategorias() {
        const productos = this.get('productos').filter(p => p.activo !== false);
        return [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort();
    },

    crearProducto(data) {
        const productos = this.get('productos');
        // Verificar código duplicado
        if (data.codigo_barras && productos.some(p => p.codigo_barras === data.codigo_barras && p.activo !== false)) {
            throw new Error('Ya existe un producto con ese código de barras');
        }
        const producto = {
            id: this.nextId('productos'),
            codigo_barras: data.codigo_barras || null,
            nombre: data.nombre,
            precio_venta: parseFloat(data.precio_venta),
            precio_compra: parseFloat(data.precio_compra) || 0,
            stock: parseInt(data.stock) || 0,
            stock_minimo: parseInt(data.stock_minimo) || 5,
            categoria: data.categoria || 'General',
            unidad: data.unidad || 'UND',
            activo: true,
            fecha_creacion: new Date().toISOString()
        };
        productos.push(producto);
        this.set('productos', productos);
        return producto;
    },

    actualizarProducto(id, data) {
        const productos = this.get('productos');
        const idx = productos.findIndex(p => p.id === id);
        if (idx === -1) throw new Error('Producto no encontrado');

        // Verificar código duplicado (excluyendo el propio)
        if (data.codigo_barras) {
            const dup = productos.find(p => p.codigo_barras === data.codigo_barras && p.id !== id && p.activo !== false);
            if (dup) throw new Error('Ya existe un producto con ese código de barras');
        }

        productos[idx] = {
            ...productos[idx],
            codigo_barras: data.codigo_barras || null,
            nombre: data.nombre,
            precio_venta: parseFloat(data.precio_venta),
            precio_compra: parseFloat(data.precio_compra) || 0,
            stock: parseInt(data.stock),
            stock_minimo: parseInt(data.stock_minimo) || 5,
            categoria: data.categoria || 'General',
            unidad: data.unidad || 'UND',
            fecha_modificacion: new Date().toISOString()
        };
        this.set('productos', productos);
        return productos[idx];
    },

    desactivarProducto(id) {
        const productos = this.get('productos');
        const idx = productos.findIndex(p => p.id === id);
        if (idx === -1) throw new Error('Producto no encontrado');
        productos[idx].activo = false;
        this.set('productos', productos);
    },

    descontarStock(productoId, cantidad) {
        const productos = this.get('productos');
        const idx = productos.findIndex(p => p.id === productoId);
        if (idx !== -1) {
            productos[idx].stock = Math.max(0, productos[idx].stock - cantidad);
            this.set('productos', productos);
        }
    },

    restaurarStock(productoId, cantidad) {
        const productos = this.get('productos');
        const idx = productos.findIndex(p => p.id === productoId);
        if (idx !== -1) {
            productos[idx].stock += cantidad;
            this.set('productos', productos);
        }
    },

    // ═══════════════════════════════════════════
    //  VENTAS
    // ═══════════════════════════════════════════

    generarNumeroComprobante(tipo) {
        const fecha = new Date();
        const año = fecha.getFullYear().toString().slice(2);
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const prefijo = tipo === 'BOLETA' ? 'B001' : 'T001';
        const num = this.nextId('comprobantes');
        return `${prefijo}-${año}${mes}-${String(num).padStart(6, '0')}`;
    },

    registrarVenta(data) {
        const caja = this.getCajaEstado();
        if (!caja.abierta) throw new Error('La caja no está abierta. Abre la caja antes de vender.');

        // Verificar stock
        for (const item of data.items) {
            const prod = this.getProductoById(item.producto_id);
            if (!prod) throw new Error(`Producto #${item.producto_id} no encontrado`);
            if (prod.stock < item.cantidad) {
                throw new Error(`Stock insuficiente para "${prod.nombre}" (disponible: ${prod.stock})`);
            }
        }

        const total = data.items.reduce((s, i) => s + (i.precio_unitario * i.cantidad), 0);
        const vuelto = data.metodo_pago === 'EFECTIVO' ? Math.max(0, data.monto_pagado - total) : 0;
        const numero = this.generarNumeroComprobante(data.tipo_comprobante);

        const venta = {
            id: this.nextId('ventas'),
            numero_comprobante: numero,
            fecha: new Date().toISOString(),
            items: data.items,
            total,
            tipo_comprobante: data.tipo_comprobante,
            metodo_pago: data.metodo_pago,
            monto_pagado: data.monto_pagado,
            vuelto,
            anulada: false
        };

        const ventas = this.get('ventas');
        ventas.push(venta);
        this.set('ventas', ventas);

        // Descontar stock
        for (const item of data.items) {
            this.descontarStock(item.producto_id, item.cantidad);
        }

        // Registrar movimiento en caja
        this.registrarMovimientoCaja({
            tipo: 'VENTA',
            monto: total,
            descripcion: `Venta ${numero} (${data.metodo_pago})`,
            metodo_pago: data.metodo_pago,
            referencia_id: venta.id
        });

        return venta;
    },

    anularVenta(ventaId, motivo) {
        const ventas = this.get('ventas');
        const idx = ventas.findIndex(v => v.id === ventaId);
        if (idx === -1) throw new Error('Venta no encontrada');
        if (ventas[idx].anulada) throw new Error('La venta ya está anulada');

        ventas[idx].anulada = true;
        ventas[idx].motivo_anulacion = motivo;
        ventas[idx].fecha_anulacion = new Date().toISOString();
        this.set('ventas', ventas);

        // Restaurar stock
        for (const item of ventas[idx].items) {
            this.restaurarStock(item.producto_id, item.cantidad);
        }

        // Registrar movimiento negativo en caja
        this.registrarMovimientoCaja({
            tipo: 'ANULACION',
            monto: -ventas[idx].total,
            descripcion: `Anulación ${ventas[idx].numero_comprobante}: ${motivo}`,
            metodo_pago: ventas[idx].metodo_pago,
            referencia_id: ventas[idx].id
        });
    },

    getResumenHoy() {
        const hoy = new Date().toDateString();
        const ventas = this.get('ventas').filter(v =>
            !v.anulada && new Date(v.fecha).toDateString() === hoy
        );

        return {
            total_ventas: ventas.length,
            total_efectivo: ventas.filter(v => v.metodo_pago === 'EFECTIVO').reduce((s, v) => s + v.total, 0),
            total_yape: ventas.filter(v => v.metodo_pago === 'YAPE_PLIN').reduce((s, v) => s + v.total, 0),
            total_tarjeta: ventas.filter(v => v.metodo_pago === 'TARJETA').reduce((s, v) => s + v.total, 0),
        };
    },

    // ═══════════════════════════════════════════
    //  CAJA
    // ═══════════════════════════════════════════

    getCajaEstado() {
        try {
            return JSON.parse(localStorage.getItem(this.KEYS.caja) || 'null') || {
                abierta: false,
                apertura: null,
                saldo_sistema: 0,
                efectivo_en_caja: 0
            };
        } catch { return { abierta: false, apertura: null, saldo_sistema: 0, efectivo_en_caja: 0 }; }
    },

    setCajaEstado(estado) {
        localStorage.setItem(this.KEYS.caja, JSON.stringify(estado));
    },

    abrirCaja(montoInicial) {
        const estado = this.getCajaEstado();
        if (estado.abierta) throw new Error('La caja ya está abierta');

        const nuevaApertura = {
            id: this.nextId('movimientos'),
            tipo: 'APERTURA',
            monto: montoInicial,
            descripcion: 'Apertura de caja',
            fecha: new Date().toISOString()
        };

        const movimientos = this.get('movimientos');
        movimientos.push(nuevaApertura);
        this.set('movimientos', movimientos);

        this.setCajaEstado({
            abierta: true,
            apertura: { monto: montoInicial, fecha: nuevaApertura.fecha },
            saldo_sistema: montoInicial,
            efectivo_en_caja: montoInicial
        });
    },

    cerrarCaja(efectivoContado, observaciones) {
        const estado = this.getCajaEstado();
        if (!estado.abierta) throw new Error('La caja no está abierta');

        const efectivoEsperado = this.efectivoEsperado();
        const diferencia = +(efectivoContado - efectivoEsperado).toFixed(2);

        const movCierre = {
            id: this.nextId('movimientos'),
            tipo: 'CIERRE',
            monto: efectivoContado,
            descripcion: `Cierre de caja. Observaciones: ${observaciones || 'Ninguna'}`,
            fecha: new Date().toISOString()
        };

        const movimientos = this.get('movimientos');
        movimientos.push(movCierre);
        this.set('movimientos', movimientos);

        this.setCajaEstado({
            abierta: false,
            apertura: null,
            saldo_sistema: 0,
            efectivo_en_caja: 0
        });

        return {
            efectivo_esperado: efectivoEsperado,
            efectivo_contado: efectivoContado,
            diferencia,
            cuadra: Math.abs(diferencia) < 0.01
        };
    },

    // ¿Este movimiento mueve billetes del cajón?
    afectaEfectivo(mov) {
        if (mov.metodo_pago) return mov.metodo_pago === 'EFECTIVO';
        return mov.tipo === 'INGRESO' || mov.tipo === 'EGRESO';
    },

    // Efectivo que debería haber en el cajón: apertura más todo
    // movimiento en efectivo registrado desde entonces (ventas,
    // compras, ingresos y egresos manuales).
    efectivoEsperado() {
        const estado = this.getCajaEstado();
        if (!estado.abierta || !estado.apertura) return 0;

        const desde = new Date(estado.apertura.fecha);
        const movimientos = this.get('movimientos').filter(m =>
            new Date(m.fecha) >= desde &&
            m.tipo !== 'APERTURA' &&
            m.tipo !== 'CIERRE' &&
            this.afectaEfectivo(m)
        );

        const suma = movimientos.reduce((s, m) => s + m.monto, 0);
        return +(estado.apertura.monto + suma).toFixed(2);
    },

    registrarMovimientoCaja(data) {
        const movimientos = this.get('movimientos');
        movimientos.push({
            id: this.nextId('movimientos'),
            tipo: data.tipo,
            monto: data.monto,
            descripcion: data.descripcion || '',
            metodo_pago: data.metodo_pago || null,
            referencia_id: data.referencia_id || null,
            fecha: new Date().toISOString()
        });
        this.set('movimientos', movimientos);

        // Actualizar saldo en estado de caja
        const estado = this.getCajaEstado();
        if (estado.abierta) {
            estado.saldo_sistema = (estado.saldo_sistema || 0) + data.monto;
            if (this.afectaEfectivo(data)) {
                estado.efectivo_en_caja = (estado.efectivo_en_caja || 0) + data.monto;
            }
            this.setCajaEstado(estado);
        }
    },

    getMovimientosHoy() {
        const hoy = new Date().toDateString();
        return this.get('movimientos')
            .filter(m => new Date(m.fecha).toDateString() === hoy)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    },

    // ═══════════════════════════════════════════
    //  COMPRAS (ingreso de mercadería)
    // ═══════════════════════════════════════════

    generarNumeroCompra() {
        const fecha = new Date();
        const año = fecha.getFullYear().toString().slice(2);
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const num = this.nextId('compras_numero');
        return `C001-${año}${mes}-${String(num).padStart(6, '0')}`;
    },

    getCompras(q = '', estado = '') {
        let compras = this.get('compras');

        if (q) {
            const qLow = q.toLowerCase();
            compras = compras.filter(c =>
                (c.proveedor || '').toLowerCase().includes(qLow) ||
                (c.numero || '').toLowerCase().includes(qLow) ||
                (c.documento_numero || '').toLowerCase().includes(qLow)
            );
        }

        if (estado === 'PENDIENTE') compras = compras.filter(c => !c.pagada && !c.anulada);
        if (estado === 'PAGADA') compras = compras.filter(c => c.pagada && !c.anulada);
        if (estado === 'ANULADA') compras = compras.filter(c => c.anulada);

        return compras.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    },

    getCompraById(id) {
        return this.get('compras').find(c => c.id === id) || null;
    },

    getProveedores() {
        const compras = this.get('compras');
        return [...new Set(compras.map(c => c.proveedor).filter(Boolean))].sort();
    },

    registrarCompra(data) {
        if (!data.proveedor || !data.proveedor.trim()) {
            throw new Error('Indica el proveedor');
        }
        if (!data.items || data.items.length === 0) {
            throw new Error('Agrega al menos un producto a la compra');
        }

        // Validar productos e importes antes de tocar nada
        const items = data.items.map(item => {
            const prod = this.getProductoById(item.producto_id);
            if (!prod) throw new Error(`Producto #${item.producto_id} no encontrado`);

            const cantidad = parseFloat(item.cantidad);
            const costo = parseFloat(item.costo_unitario);
            if (!(cantidad > 0)) throw new Error(`Cantidad inválida en "${prod.nombre}"`);
            if (!(costo >= 0)) throw new Error(`Costo inválido en "${prod.nombre}"`);

            return {
                producto_id: prod.id,
                nombre: prod.nombre,
                unidad: prod.unidad,
                cantidad,
                costo_unitario: costo,
                subtotal: +(cantidad * costo).toFixed(2)
            };
        });

        const total = +items.reduce((s, i) => s + i.subtotal, 0).toFixed(2);
        const contado = data.condicion_pago === 'CONTADO';
        const metodoPago = contado ? (data.metodo_pago || 'EFECTIVO') : null;

        // El efectivo sale del cajón: la caja tiene que estar abierta
        if (contado && metodoPago === 'EFECTIVO' && !this.getCajaEstado().abierta) {
            throw new Error('La caja está cerrada. Ábrela para pagar en efectivo o registra la compra al crédito.');
        }

        const compra = {
            id: this.nextId('compras'),
            numero: this.generarNumeroCompra(),
            fecha: new Date().toISOString(),
            proveedor: data.proveedor.trim(),
            documento_tipo: data.documento_tipo || 'SIN_DOC',
            documento_numero: (data.documento_numero || '').trim(),
            fecha_documento: data.fecha_documento || null,
            items,
            total,
            condicion_pago: contado ? 'CONTADO' : 'CREDITO',
            metodo_pago: metodoPago,
            pagada: contado,
            fecha_pago: contado ? new Date().toISOString() : null,
            anulada: false
        };

        const compras = this.get('compras');
        compras.push(compra);
        this.set('compras', compras);

        // Ingresar mercadería al stock (y actualizar el costo si se pidió)
        this.aplicarStockCompra(items, 1, data.actualizar_costo);

        if (contado) {
            this.registrarMovimientoCaja({
                tipo: 'COMPRA',
                monto: -total,
                descripcion: `Compra ${compra.numero} — ${compra.proveedor}`,
                metodo_pago: metodoPago,
                referencia_id: compra.id
            });
        }

        return compra;
    },

    // signo: +1 ingresa mercadería, -1 la revierte
    aplicarStockCompra(items, signo, actualizarCosto = false) {
        const productos = this.get('productos');

        for (const item of items) {
            const idx = productos.findIndex(p => p.id === item.producto_id);
            if (idx === -1) continue;

            productos[idx].stock = Math.max(0, (productos[idx].stock || 0) + (signo * item.cantidad));

            if (signo > 0 && actualizarCosto && item.costo_unitario > 0) {
                productos[idx].precio_compra = item.costo_unitario;
            }
        }

        this.set('productos', productos);
    },

    pagarCompra(id, metodoPago) {
        const compras = this.get('compras');
        const idx = compras.findIndex(c => c.id === id);
        if (idx === -1) throw new Error('Compra no encontrada');
        if (compras[idx].anulada) throw new Error('La compra está anulada');
        if (compras[idx].pagada) throw new Error('La compra ya está pagada');

        const metodo = metodoPago || 'EFECTIVO';
        if (metodo === 'EFECTIVO' && !this.getCajaEstado().abierta) {
            throw new Error('La caja está cerrada. Ábrela para pagar en efectivo.');
        }

        compras[idx].pagada = true;
        compras[idx].metodo_pago = metodo;
        compras[idx].fecha_pago = new Date().toISOString();
        this.set('compras', compras);

        this.registrarMovimientoCaja({
            tipo: 'COMPRA',
            monto: -compras[idx].total,
            descripcion: `Pago compra ${compras[idx].numero} — ${compras[idx].proveedor}`,
            metodo_pago: metodo,
            referencia_id: compras[idx].id
        });

        return compras[idx];
    },

    anularCompra(id, motivo) {
        const compras = this.get('compras');
        const idx = compras.findIndex(c => c.id === id);
        if (idx === -1) throw new Error('Compra no encontrada');
        if (compras[idx].anulada) throw new Error('La compra ya está anulada');

        const compra = compras[idx];

        // La mercadería sale del stock
        this.aplicarStockCompra(compra.items, -1);

        // Si ya se pagó, el dinero vuelve
        if (compra.pagada) {
            this.registrarMovimientoCaja({
                tipo: 'ANULACION',
                monto: compra.total,
                descripcion: `Anulación compra ${compra.numero}: ${motivo}`,
                metodo_pago: compra.metodo_pago,
                referencia_id: compra.id
            });
        }

        compras[idx].anulada = true;
        compras[idx].motivo_anulacion = motivo;
        compras[idx].fecha_anulacion = new Date().toISOString();
        this.set('compras', compras);

        return compras[idx];
    },

    getResumenCompras() {
        const hoy = new Date().toDateString();
        const compras = this.get('compras').filter(c => !c.anulada);

        const delDia = compras.filter(c => new Date(c.fecha).toDateString() === hoy);
        const pendientes = compras.filter(c => !c.pagada);

        return {
            hoy_cantidad: delDia.length,
            hoy_total: +delDia.reduce((s, c) => s + c.total, 0).toFixed(2),
            hoy_efectivo: +delDia
                .filter(c => c.pagada && c.metodo_pago === 'EFECTIVO')
                .reduce((s, c) => s + c.total, 0).toFixed(2),
            pendientes_cantidad: pendientes.length,
            pendientes_total: +pendientes.reduce((s, c) => s + c.total, 0).toFixed(2)
        };
    },

    // ═══════════════════════════════════════════
    //  CARGA CSV (procesamiento en cliente)
    // ═══════════════════════════════════════════

    procesarCSV(contenido) {
        const lineas = contenido.trim().split('\n');
        let insertados = 0, omitidos = 0;

        // Detectar si hay cabecera
        const primeraLinea = lineas[0].toLowerCase();
        const tieneCabecera = primeraLinea.includes('nombre') || primeraLinea.includes('precio');
        const inicio = tieneCabecera ? 1 : 0;

        for (let i = inicio; i < lineas.length; i++) {
            const cols = lineas[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length < 2) { omitidos++; continue; }

            const [codigo_barras, nombre, precio_venta, precio_compra, stock, categoria, unidad] = cols;

            if (!nombre) { omitidos++; continue; }
            if (!precio_venta || isNaN(parseFloat(precio_venta))) { omitidos++; continue; }

            try {
                this.crearProducto({
                    codigo_barras: codigo_barras || null,
                    nombre,
                    precio_venta: parseFloat(precio_venta),
                    precio_compra: parseFloat(precio_compra) || 0,
                    stock: parseInt(stock) || 0,
                    stock_minimo: 5,
                    categoria: categoria || 'General',
                    unidad: unidad || 'UND'
                });
                insertados++;
            } catch {
                omitidos++;
            }
        }

        return { insertados, omitidos, total: lineas.length - inicio };
    },

    // ═══════════════════════════════════════════
    //  DATOS DE EJEMPLO (primera vez)
    // ═══════════════════════════════════════════

    inicializarDemoSiVacio() {
        const productos = this.get('productos');
        if (productos.length > 0) return; // Ya hay datos

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

        demo.forEach(p => this.crearProducto(p));
        console.log(`✅ ${demo.length} productos de demo cargados`);
    }
};
