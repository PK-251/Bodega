/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Módulo Principal (app.js)
 *  Navegación, utilidades globales, estado central
 * ════════════════════════════════════════════════
 */

// ─── Estado Global ─────────────────────────────
const APP = {
    BASE_URL: window.location.origin,
    // Datos del negocio (editables desde el botón ⚙️)
    config: null,
    cajaAbierta: false,
    currentSection: 'ventas'
};

// ─── API Helper ────────────────────────────────
async function api(endpoint, options = {}) {
    const url = `${APP.BASE_URL}/api${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }
    if (config.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Error ${response.status}`);
        }
        return data;
    } catch (err) {
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            mostrarOffline(true);
            throw new Error('Sin conexión al servidor');
        }
        throw err;
    }
}

// ─── Navegación entre secciones ────────────────
function initNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const section = tab.dataset.section;
            activarSeccion(section);
        });
    });
}

function activarSeccion(nombre) {
    // Tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.nav-tab[data-section="${nombre}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Secciones
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`section-${nombre}`);
    if (section) section.classList.add('active');

    APP.currentSection = nombre;

    // Cargar datos al abrir sección
    if (nombre === 'inventario') cargarInventario();
    if (nombre === 'compras') cargarCompras();
    if (nombre === 'caja') cargarEstadoCaja();
}

// ─── Toast Notifications ───────────────────────
function toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = message;
    container.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        el.style.transition = '300ms ease';
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// ─── Modal Management ──────────────────────────
function abrirModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
        overlay.classList.add('active');
        // Focus primer input (en móvil no, para no abrir el teclado
        // encima del botón de cámara)
        if (!esMobile()) {
            setTimeout(() => {
                const input = overlay.querySelector('input:not([type="hidden"]), textarea, select');
                if (input) input.focus();
            }, 200);
        }
    }
}

function cerrarModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Cerrar modales con click fuera o Escape
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
            activeModal.classList.remove('active');
            return;
        }
        // Si no hay modal abierto y estamos en ventas, vaciar lista
        if (APP.currentSection === 'ventas') {
            vaciarVenta();
        }
    }
});

// ─── Atajos de Teclado ─────────────────────────
document.addEventListener('keydown', (e) => {
    // Ignorar si hay modal abierto
    if (document.querySelector('.modal-overlay.active')) return;

    switch (e.key) {
        case 'F2':
            e.preventDefault();
            document.getElementById('btn-cobrar').click();
            break;
        case 'F4':
            e.preventDefault();
            activarSeccion('ventas');
            document.getElementById('input-buscar').focus();
            break;
    }
});

// ─── Reloj ─────────────────────────────────────
function actualizarReloj() {
    const el = document.getElementById('header-clock');
    const now = new Date();
    el.textContent = now.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ─── Online/Offline ────────────────────────────
function mostrarOffline(offline) {
    const banner = document.getElementById('offline-banner');
    if (offline) {
        banner.style.display = '';
        banner.classList.add('visible');
    } else {
        banner.classList.remove('visible');
    }
}

window.addEventListener('online', () => {
    mostrarOffline(false);
    toast('✅ Conexión restaurada', 'success');
});

window.addEventListener('offline', () => {
    mostrarOffline(true);
    toast('⚠️ Sin conexión al servidor', 'warning');
});

// ─── Formateo de moneda ────────────────────────
function formatMoney(amount) {
    return `S/ ${parseFloat(amount || 0).toFixed(2)}`;
}

// ─── Actualizar badge de caja ──────────────────
function actualizarBadgeCaja(abierta) {
    const badge = document.getElementById('caja-status-badge');
    APP.cajaAbierta = abierta;
    if (abierta) {
        badge.className = 'caja-badge abierta';
        badge.innerHTML = '<span>●</span> Caja abierta';
    } else {
        badge.className = 'caja-badge cerrada';
        badge.innerHTML = '<span>●</span> Caja cerrada';
    }
}

// ─── Detectar dispositivo móvil ────────────────
function esMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768);
}

// ─── Botones de cámara (ventas, producto, compra) ─
// Solo tienen sentido en móvil o con HTTPS, y se
// reevalúan al rotar o redimensionar la ventana.
function actualizarBotonesCamara() {
    // Visible donde la cámara puede funcionar (HTTPS o localhost),
    // y también en celular aunque falte HTTPS: así el botón explica
    // qué falta en vez de desaparecer sin motivo.
    const mostrar = window.isSecureContext || esMobile();
    document.querySelectorAll('.btn-scanner').forEach(btn => {
        btn.classList.toggle('visible', mostrar);
    });
}

window.addEventListener('resize', actualizarBotonesCamara);

// ─── Inicialización ────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    DB.inicializarDemoSiVacio();
    aplicarConfig();
    initNavigation();
    actualizarReloj();
    setInterval(actualizarReloj, 30000);

    actualizarBotonesCamara();

    // Verificar estado de caja al inicio
    verificarCajaInicial();

    // Cargar productos iniciales
    buscarProductos('');

    // Restaurar venta desde localStorage
    restaurarVentaLocal();

    console.log('🏪 Bodega POS iniciado');
});

// El estado real de la caja vive en el navegador (db.js),
// no en el servidor: el badge debe leer de ahí.
function verificarCajaInicial() {
    try {
        actualizarBadgeCaja(DB.getCajaEstado().abierta);
    } catch (e) {
        // Silencioso al inicio
    }
}
