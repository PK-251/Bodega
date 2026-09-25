/**
 * Servidor HTTPS para acceso desde celulares en red local.
 * Necesario para que el navegador móvil permita acceso a la cámara.
 *
 * USO:
 *   1. Generar certificado autofirmado (ver instrucciones abajo)
 *   2. npm run https
 *
 * GENERAR CERTIFICADO (ejecutar en la carpeta server/ssl/):
 *
 *   Con OpenSSL:
 *     openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=bodega-pos"
 *
 *   Con PowerShell (Windows, sin OpenSSL):
 *     $cert = New-SelfSignedCertificate -DnsName "bodega-pos" -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1)
 *     (Luego exportar manualmente a PEM)
 *
 *   La forma más fácil en Windows es instalar OpenSSL via: winget install OpenSSL
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3443;

// ─── Middleware ───────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Inicializar BD ──────────────────────────
initDatabase();

// ─── Rutas API ───────────────────────────────
app.use('/api/productos', require('./routes/productos'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/caja', require('./routes/caja'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Cargar certificados SSL ─────────────────
const sslDir = path.join(__dirname, 'ssl');
const keyPath = path.join(sslDir, 'key.pem');
const certPath = path.join(sslDir, 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error('');
    console.error('❌ No se encontraron los certificados SSL.');
    console.error('');
    console.error('   Genera un certificado autofirmado ejecutando:');
    console.error('');
    console.error('   cd server/ssl');
    console.error('   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=bodega-pos"');
    console.error('');
    process.exit(1);
}

const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
};

https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│    🔒 BODEGA POS - Modo HTTPS           │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│  https://localhost:${PORT}                │`);
    console.log(`│  https://<tu-ip>:${PORT}                  │`);
    console.log('│                                         │');
    console.log('│  📱 Cámara habilitada para celulares    │');
    console.log('│                                         │');
    console.log('│  NOTA: En el celular, aceptar el        │');
    console.log('│  certificado autofirmado la primera vez │');
    console.log('└─────────────────────────────────────────┘');
    console.log('');
});
