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
let qrPendiente = undefined;

// El QR debe quedar legible para la cámara del cliente:
// se guarda más grande que la foto y sin recortar.
const QR_LADO_MAX = 600;

// ─── Aplicar la configuración a la interfaz ────
function aplicarConfig() {
    const cfg = DB.getConfig();
    APP.config = cfg;

    document.getElementById('app-nombre').textContent = cfg.nombre;
    document.title = `${cfg.nombre} — POS`;

    if (typeof actualizarBotonQr === 'function') actualizarBotonQr();

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

    qrPendiente = undefined;
    document.getElementById('cfg-yape-nombre').value = cfg.yape_nombre;
    document.getElementById('cfg-yape-numero').value = cfg.yape_numero;
    document.getElementById('cfg-qr-input').value = '';

    renderPreviewFoto(cfg.foto);
    renderPreviewQr(cfg.yape_qr);
    renderResumenDatos();
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


// ─── QR de Yape / Plin ─────────────────────────
function renderPreviewQr(dataUrl) {
    const img = document.getElementById('cfg-qr-preview');
    const vacio = document.getElementById('cfg-qr-vacio');
    const btnQuitar = document.getElementById('btn-quitar-qr');

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

document.getElementById('cfg-qr-zona').addEventListener('click', () => {
    document.getElementById('cfg-qr-input').click();
});

document.getElementById('cfg-qr-input').addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    if (archivo.type.indexOf('image/') !== 0) {
        toast('⚠️ Elige una imagen del QR', 'warning');
        return;
    }

    reducirQr(archivo, (dataUrl, recortado) => {
        if (!dataUrl) {
            toast('❌ No se pudo leer la imagen', 'error');
            return;
        }

        qrPendiente = dataUrl;
        renderPreviewQr(dataUrl);

        if (recortado) {
            toast('✂️ Recortado al código', 'success', 2500);
        } else {
            toast('ℹ️ Se guardó la imagen completa. Desde el celular se recorta sola.', 'info', 5000);
        }
    });
});

document.getElementById('btn-quitar-qr').addEventListener('click', () => {
    qrPendiente = null;
    renderPreviewQr(null);
});

// A diferencia de la foto, el QR no se recorta a ciegas
// (perdería esquinas y dejaría de leerse) y se guarda en
// PNG, que no difumina los cuadros como haría el JPEG.
//
// Si el navegador sabe encontrar códigos —el Chrome del
// celular sí—, se recorta solo al código y se descarta el
// resto de la captura de Yape: el fondo morado, el logo y
// el nombre no aportan nada y achican el código.
function reducirQr(archivo, callback) {
    const lector = new FileReader();

    lector.onload = (e) => {
        const img = new Image();

        img.onload = () => {
            buscarCodigo(img, (recorte) => {
                try {
                    callback(dibujarQr(img, recorte), !!recorte);
                } catch (err) {
                    callback(null, false);
                }
            });
        };

        img.onerror = () => callback(null, false);
        img.src = e.target.result;
    };

    lector.onerror = () => callback(null, false);
    lector.readAsDataURL(archivo);
}

// Devuelve el rectángulo del código, o null si este
// navegador no sabe buscarlo o no encontró ninguno.
function buscarCodigo(img, callback) {
    if (typeof BarcodeDetector === 'undefined') {
        callback(null);
        return;
    }

    BarcodeDetector.getSupportedFormats()
        .then((formatos) => {
            if (formatos.indexOf('qr_code') === -1) return null;
            return new BarcodeDetector({ formats: ['qr_code'] }).detect(img);
        })
        .then((codigos) => {
            if (!codigos || codigos.length === 0) {
                callback(null);
                return;
            }

            const caja = codigos[0].boundingBox;

            // Margen alrededor: un QR sin borde blanco no se lee
            const margen = Math.round(Math.max(caja.width, caja.height) * 0.12);
            const x = Math.max(0, Math.round(caja.x - margen));
            const y = Math.max(0, Math.round(caja.y - margen));

            callback({
                x: x,
                y: y,
                ancho: Math.min(img.width - x, Math.round(caja.width + margen * 2)),
                alto: Math.min(img.height - y, Math.round(caja.height + margen * 2))
            });
        })
        .catch(() => callback(null));
}

function dibujarQr(img, recorte) {
    const origen = recorte || { x: 0, y: 0, ancho: img.width, alto: img.height };

    // No se agranda: un QR estirado se lee peor que uno chico
    const escala = Math.min(1, QR_LADO_MAX / Math.max(origen.ancho, origen.alto));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(origen.ancho * escala);
    canvas.height = Math.round(origen.alto * escala);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
        img,
        origen.x, origen.y, origen.ancho, origen.alto,
        0, 0, canvas.width, canvas.height
    );

    return canvas.toDataURL('image/png');
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

    data.yape_nombre = document.getElementById('cfg-yape-nombre').value.trim();
    data.yape_numero = document.getElementById('cfg-yape-numero').value.trim();

    // Solo se tocan las imágenes si se eligieron otras o se quitaron
    if (fotoPendiente !== undefined) {
        data.foto = fotoPendiente;
    }
    if (qrPendiente !== undefined) {
        data.yape_qr = qrPendiente;
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
