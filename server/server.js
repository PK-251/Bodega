const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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

// ─── SPA fallback ────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Manejo global de errores ────────────────
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Iniciar servidor ────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│        🏪  BODEGA POS  v1.0             │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│  Local:  http://localhost:${PORT}          │`);
    console.log('│                                         │');
    console.log('│  Base de datos: data/bodega.json        │');
    console.log('│  Presiona Ctrl+C para detener           │');
    console.log('└─────────────────────────────────────────┘');
    console.log('');
});
