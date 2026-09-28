/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Lector de Código de Barras Dual
 *  PC: captura keydown (escáner USB)
 *  Celular: cámara vía html5-qrcode
 *  Disponible en Ventas y en el alta/edición de productos
 * ════════════════════════════════════════════════
 */

// ─── Escáner USB (modo emulación de teclado) ───
// Los escáneres USB envían caracteres rápidamente
// seguidos de un Enter. Detectamos esta secuencia.

let barcodeBuffer = '';
let barcodeTimer = null;
const BARCODE_TIMEOUT = 80; // ms entre caracteres

function modalAbierto(id) {
    const modal = document.getElementById(id);
    return !!modal && modal.classList.contains('active');
}

function modalProductoAbierto() {
    return modalAbierto('modal-producto');
}

function modalCompraAbierto() {
    return modalAbierto('modal-compra');
}

document.addEventListener('keydown', (e) => {
    // Con un modal abierto solo escuchamos los que usan códigos:
    // el de producto (llena el código de barras) y el de compra
    // (agrega el producto escaneado a la compra).
    const hayModal = document.querySelector('.modal-overlay.active');
    if (hayModal && !modalProductoAbierto() && !modalCompraAbierto()) return;

    // Ignorar si estamos escribiendo en un campo de texto
    // (excepto el buscador, donde el escáner también funciona.
    //  El campo prod-codigo se maneja en inventario.js)
    const activeEl = document.activeElement;
    const isTextInput = activeEl &&
        (activeEl.tagName === 'TEXTAREA' ||
         (activeEl.tagName === 'INPUT' && activeEl.type !== 'button' && activeEl.id !== 'input-buscar'));

    if (isTextInput) return;

    // Los escáneres envían caracteres alfanuméricos rápidamente
    if (e.key === 'Enter' && barcodeBuffer.length >= 4) {
        e.preventDefault();
        const codigo = barcodeBuffer.trim();
        barcodeBuffer = '';
        clearTimeout(barcodeTimer);

        // Procesar código escaneado
        procesarCodigoEscaneado(codigo);
        return;
    }

    // Solo caracteres imprimibles (códigos de barras son numéricos o alfanuméricos)
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Si el foco está en el buscador, no capturar aquí
        if (activeEl && activeEl.id === 'input-buscar') return;

        barcodeBuffer += e.key;
        clearTimeout(barcodeTimer);

        // Reset buffer si pasa mucho tiempo entre caracteres
        // (una persona normal no escribe tan rápido)
        barcodeTimer = setTimeout(() => {
            barcodeBuffer = '';
        }, BARCODE_TIMEOUT);
    }
});

// El escáner USB puede empezar a disparar antes de que el
// campo de código reciba el foco: esa primera parte queda en
// el buffer y inventario.js la recupera al recibir el Enter.
function tomarBufferPendiente() {
    const pendiente = barcodeBuffer;
    barcodeBuffer = '';
    clearTimeout(barcodeTimer);
    return pendiente;
}

function procesarCodigoEscaneado(codigo) {
    // Alta/edición de producto abierta → llenar el código de barras
    if (modalProductoAbierto()) {
        aplicarCodigoEnFormulario(codigo);
        return;
    }

    // Compra abierta → agregar el producto a la mercadería que entra
    if (modalCompraAbierto()) {
        agregarItemCompraPorCodigo(codigo);
        return;
    }

    // Si estamos en la sección de ventas, agregar al carrito
    if (APP.currentSection === 'ventas') {
        agregarPorCodigo(codigo);
        // Limpiar el input de búsqueda si tenía el código
        const inputBuscar = document.getElementById('input-buscar');
        if (inputBuscar.value === codigo) {
            inputBuscar.value = '';
        }
    }
}

// ─── Escáner por Cámara (html5-qrcode) ────────
// Fábrica reutilizable: un escáner por cada lugar
// donde se necesite (ventas, formulario de producto).

function formatosSoportados() {
    return [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE
    ];
}

function camaraDisponible() {
    if (typeof Html5Qrcode === 'undefined') {
        toast('⚠️ Librería de cámara no disponible', 'warning');
        return false;
    }
    // La cámara solo funciona en contexto seguro: HTTPS o localhost.
    // Lo decide el navegador, no hace falta adivinarlo por el protocolo.
    if (!window.isSecureContext) {
        toast('⚠️ Se necesita HTTPS para usar la cámara. En la PC: npm run cert y npm run https', 'warning', 6000);
        return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('⚠️ Este navegador no da acceso a la cámara', 'warning', 5000);
        return false;
    }

    return true;
}

function crearScannerCamara({ readerId, containerId, btnId, closeId, onScan,
                              labelIdle = '📷 Cámara', labelActive = '⏹ Cerrar Cámara' }) {
    const btn = document.getElementById(btnId);
    const container = document.getElementById(containerId);
    const btnClose = closeId ? document.getElementById(closeId) : null;
    if (!btn || !container) return null;

    let scanner = null;
    let activo = false;
    let lastCode = '';
    let cooldown = false;

    async function abrir() {
        if (activo) return;
        if (!camaraDisponible()) return;

        container.classList.add('active');
        btn.textContent = labelActive;

        try {
            scanner = new Html5Qrcode(readerId);

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    // Recuadro adaptado al ancho real (importante en celular)
                    qrbox: (ancho, alto) => ({
                        width: Math.floor(Math.min(ancho * 0.9, 300)),
                        height: Math.floor(Math.min(alto * 0.6, 180))
                    }),
                    formatsToSupport: formatosSoportados()
                },
                onScanSuccess,
                () => { /* fallo normal mientras busca */ }
            );

            activo = true;
            toast('📷 Cámara activa — Escanea un código', 'info');

        } catch (err) {
            console.error('Error al iniciar cámara:', err);
            toast('❌ No se pudo acceder a la cámara', 'error');
            container.classList.remove('active');
            btn.textContent = labelIdle;
        }
    }

    // Cooldown para evitar escaneos múltiples del mismo código
    function onScanSuccess(decodedText) {
        if (cooldown || decodedText === lastCode) return;

        lastCode = decodedText;
        cooldown = true;

        // Vibración haptica en móvil
        if (navigator.vibrate) navigator.vibrate(100);

        onScan(decodedText);

        setTimeout(() => {
            cooldown = false;
            lastCode = '';
        }, 1500);
    }

    async function cerrar() {
        if (scanner && activo) {
            try {
                await scanner.stop();
                scanner.clear();
            } catch (e) {
                // Ignorar errores al cerrar
            }
        }

        activo = false;
        scanner = null;
        container.classList.remove('active');
        btn.textContent = labelIdle;
    }

    function toggle() {
        if (activo) cerrar(); else abrir();
    }

    btn.addEventListener('click', toggle);
    if (btnClose) btnClose.addEventListener('click', cerrar);

    return { abrir, cerrar, toggle, estaActivo: () => activo };
}

// ─── Escáner de Ventas ─────────────────────────
const scannerVentas = crearScannerCamara({
    readerId: 'qr-reader',
    containerId: 'scanner-container',
    btnId: 'btn-scanner',
    closeId: 'btn-scanner-close',
    onScan: procesarCodigoEscaneado
});

// ─── Escáner del formulario de producto ────────
const scannerProducto = crearScannerCamara({
    readerId: 'qr-reader-prod',
    containerId: 'scanner-prod-container',
    btnId: 'btn-scan-prod',
    closeId: 'btn-scan-prod-close',
    labelIdle: '📷',
    labelActive: '⏹',
    onScan: (codigo) => {
        aplicarCodigoEnFormulario(codigo);
        // Un solo código por apertura: cerramos para liberar la cámara
        scannerProducto.cerrar();
    }
});

// ─── Escáner del formulario de compra ───────
// Aquí la cámara se queda abierta: al recibir mercadería
// se escanean varios productos seguidos.
const scannerCompra = crearScannerCamara({
    readerId: 'qr-reader-compra',
    containerId: 'scanner-compra-container',
    btnId: 'btn-scan-compra',
    closeId: 'btn-scan-compra-close',
    labelIdle: '📷',
    labelActive: '⏹',
    onScan: (codigo) => agregarItemCompraPorCodigo(codigo)
});

// Apagar la cámara si el modal se cierra por cualquier vía
// (botón, Escape, clic fuera, guardar)
function vigilarModal(modalId, scanner) {
    const modal = document.getElementById(modalId);
    if (!modal || !scanner) return;

    new MutationObserver(() => {
        if (!modal.classList.contains('active') && scanner.estaActivo()) {
            scanner.cerrar();
        }
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
}

vigilarModal('modal-producto', scannerProducto);
vigilarModal('modal-compra', scannerCompra);
