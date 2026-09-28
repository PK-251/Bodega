/**
 * ════════════════════════════════════════════════
 *  BODEGA POS — Configuración del Negocio
 *  Nombre, contacto y foto que salen en el
 *  encabezado y en el comprobante de WhatsApp
 * ════════════════════════════════════════════════
 */

// Lado máximo de la foto guardada. Una foto de celular pesa
// varios MB y el navegador solo da unos pocos para todo el
// sistema: se reduce antes de guardarla.
const FOTO_LADO_MAX = 256;
const FOTO_CALIDAD = 0.82;

let fotoPendiente = undefined; // undefined = sin cambios; null = quitarla

// ─── Aplicar la configuración a la interfaz ────
function aplicarConfig() {
    const cfg = DB.getConfig();
    APP.config = cfg;

    document.getElementById('app-nombre').textContent = cfg.nombre;
    document.title = `${cfg.nombre} — POS`;

    const logo = document.getElementById('app-logo-foto');
    const emoji = document.getElementById('app-logo-emoji');

    if (cfg.foto) {
        logo.src = cfg.foto;
        logo.style.display = '';
        emoji.style.display = 'none';
    } else {
        logo.removeAttribute('src');
        logo.style.display = 'none';
        emoji.style.display = '';
    }
}

// ─── Abrir el formulario ───────────────────────
document.getElementById('btn-config').addEventListener('click', () => {
    const cfg = DB.getConfig();
    fotoPendiente = undefined;

    document.getElementById('cfg-nombre').value = cfg.nombre;
    document.getElementById('cfg-telefono').value = cfg.telefono;
    document.getElementById('cfg-direccion').value = cfg.direccion;
    document.getElementById('cfg-ruc').value = cfg.ruc;
    document.getElementById('cfg-foto-input').value = '';

    renderPreviewFoto(cfg.foto);
    abrirModal('modal-config');
});

function renderPreviewFoto(dataUrl) {
    const img = document.getElementById('cfg-foto-preview');
    const vacio = document.getElementById('cfg-foto-vacia');
    const btnQuitar = document.getElementById('btn-quitar-foto');

    if (dataUrl) {
        img.src = dataUrl;
        img.style.display = '';
        vacio.style.display = 'none';
        btnQuitar.style.display = '';
    } else {
        img.removeAttribute('src');
        img.style.display = 'none';
        vacio.style.display = '';
        btnQuitar.style.display = 'none';
    }
}

// ─── Elegir la foto ────────────────────────────
document.getElementById('cfg-foto-zona').addEventListener('click', () => {
    document.getElementById('cfg-foto-input').click();
});

document.getElementById('cfg-foto-input').addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    if (archivo.type.indexOf('image/') !== 0) {
        toast('⚠️ Elige una imagen (JPG o PNG)', 'warning');
        return;
    }

    reducirImagen(archivo, (dataUrl) => {
        if (!dataUrl) {
            toast('❌ No se pudo leer la imagen', 'error');
            return;
        }
        fotoPendiente = dataUrl;
        renderPreviewFoto(dataUrl);
    });
});

document.getElementById('btn-quitar-foto').addEventListener('click', () => {
    fotoPendiente = null;
    renderPreviewFoto(null);
});

// Recorta al centro y reduce: la foto se muestra redonda
// y pequeña, no tiene sentido guardar el original.
function reducirImagen(archivo, callback) {
    const lector = new FileReader();

    lector.onload = (e) => {
        const img = new Image();

        img.onload = () => {
            try {
                const lado = Math.min(img.width, img.height);
                const x = (img.width - lado) / 2;
                const y = (img.height - lado) / 2;
                const destino = Math.min(FOTO_LADO_MAX, lado);

                const canvas = document.createElement('canvas');
                canvas.width = destino;
                canvas.height = destino;
                canvas.getContext('2d').drawImage(img, x, y, lado, lado, 0, 0, destino, destino);

                callback(canvas.toDataURL('image/jpeg', FOTO_CALIDAD));
            } catch (err) {
                callback(null);
            }
        };

        img.onerror = () => callback(null);
        img.src = e.target.result;
    };

    lector.onerror = () => callback(null);
    lector.readAsDataURL(archivo);
}

// ─── Guardar ───────────────────────────────────
document.getElementById('btn-guardar-config').addEventListener('click', () => {
    const nombre = document.getElementById('cfg-nombre').value.trim();

    if (!nombre) {
        toast('⚠️ El nombre del negocio es requerido', 'warning');
        document.getElementById('cfg-nombre').focus();
        return;
    }

    const data = {
        nombre,
        telefono: document.getElementById('cfg-telefono').value.trim(),
        direccion: document.getElementById('cfg-direccion').value.trim(),
        ruc: document.getElementById('cfg-ruc').value.trim()
    };

    // Solo se toca la foto si se eligió otra o se quitó
    if (fotoPendiente !== undefined) {
        data.foto = fotoPendiente;
    }

    try {
        DB.guardarConfig(data);
        aplicarConfig();
        cerrarModal('modal-config');
        toast('✅ Configuración guardada', 'success');
    } catch (err) {
        toast(`❌ ${err.message}`, 'error', 5000);
    }
});
