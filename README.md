# 🏪 Bodega POS — Sistema de Punto de Venta

Sistema de Punto de Venta (POS) y Control de Inventario para bodegas pequeñas en Perú.  
Adaptado al **Régimen NRUS** — precios finales, sin desglose de IGV.

---

## 🚀 Instalación Rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor (HTTP, para PC en red local)
npm start

# 3. O iniciar en modo desarrollo (auto-restart)
npm run dev
```

El sistema se abre en: **http://localhost:3000**

---

## 📱 Acceso desde Celulares (Cámara / Escáner)

Los navegadores móviles requieren **HTTPS** para acceder a la cámara.

### Paso 1: Generar certificado SSL autofirmado

```bash
# Instalar OpenSSL (si no lo tienes)
winget install OpenSSL

# Generar certificado (en la carpeta server/ssl/)
cd server/ssl
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=bodega-pos"
```

### Paso 2: Iniciar en modo HTTPS

```bash
npm run https
```

### Paso 3: Acceder desde el celular

1. Conectar el celular a la **misma red Wi-Fi**.
2. Abrir en el navegador: `https://<IP-DE-TU-PC>:3443`
3. Aceptar la advertencia del certificado autofirmado.

> **Tip:** Para ver la IP de tu PC, ejecuta `ipconfig` en la terminal y busca la dirección IPv4.

---

## 📷 Lector de Código de Barras

Funciona en **dos lugares** y con **dos métodos**:

| Dónde | Escáner USB (PC) | Cámara (celular) |
|---|---|---|
| **Ventas** | Dispara el código: el producto se agrega al carrito | Botón `📷 Cámara` junto al buscador |
| **Nuevo / Editar Producto** | Dispara el código sobre el campo *Código de Barras* | Botón `📷` junto al campo |
| **Nueva Compra** | Dispara el código: el producto entra a la compra | Botón `📷` junto al buscador |

Al escanear dentro del formulario de producto:

- El código se escribe en el campo y el foco salta al **nombre**.
- Si el código **ya pertenece a otro producto**, el sistema lo avisa y ofrece
  abrir ese producto para editarlo (útil para reponer stock escaneando).
- La cámara se apaga sola al capturar un código o al cerrar la ventana.
  En **compras** se queda abierta para escanear varios productos seguidos.

> El botón de cámara solo aparece en celular o cuando el sistema corre en HTTPS,
> porque los navegadores no dan acceso a la cámara sin conexión segura.

---

## 📥 Gestión de Compras

Registra la mercadería que entra a la bodega. Al guardar una compra:

1. **Sube el stock** de cada producto por la cantidad recibida.
2. **Actualiza el precio de compra** con el costo pagado (casilla marcada por defecto).
   Si un producto queda vendiéndose al costo o por debajo, el sistema avisa.
3. **Descuenta de la caja** si la compra es al contado.

### Contado o crédito

| Condición | Qué pasa |
|---|---|
| **Contado** | El pago se registra de una vez (efectivo, Yape/Plin o transferencia) |
| **Crédito** | Queda como *Por pagar*; se paga después con el botón 💵 de la lista |

- Pagar en **efectivo** exige la caja abierta: la plata sale del cajón.
- Si el pago supera el efectivo disponible, el sistema pregunta antes de dejar la caja en negativo.
- **Anular** una compra devuelve la mercadería (baja el stock) y, si estaba pagada,
  el dinero vuelve a la caja.

> Los productos deben existir en el **Inventario** antes de comprarlos: la compra
> mueve stock y costos, no crea productos nuevos.

---

## 📱 Compatibilidad

**Tamaños.** Probado de 320px (iPhone SE) a escritorio, en vertical y en
horizontal: 320×568, 360×740, 375×812, 430×932 y 667×375 acostado.
Ninguna sección desborda la pantalla. Las tablas anchas (inventario, compras)
se deslizan en horizontal con el dedo.

**Detalles táctiles.**

- Los campos usan 16px en celular: por debajo de eso iOS hace zoom al enfocarlos.
- Botones de ícono de 36px y pestañas de 40px de alto.
- Los atajos de teclado (F2, F4) se ocultan en pantallas sin mouse.
- Respeta el área segura del notch y de la barra de gestos.
- La altura usa `dvh`, así la barra del navegador móvil no corta el contenido.

**Navegadores.** El código evita sintaxis reciente (nada de `?.`, `??` ni
`catch` sin variable) para no romperse en Android viejos, e incluye los
prefijos `-webkit-` donde Safari los necesita. Requisito real: un navegador
con soporte de `async/await` — Chrome 55+, Safari 11+, Firefox 52+, Edge 79+.

> La cámara depende del navegador: en iPhone funciona en Safari (y en Chrome
> desde iOS 14.3). Siempre necesita HTTPS.

---

## 📁 Estructura del Proyecto

```
bodega-pos/
├── database/
│   └── schema.sql          # Esquema de base de datos
├── server/
│   ├── server.js            # Servidor HTTP (principal)
│   ├── server-https.js      # Servidor HTTPS (para cámara móvil)
│   ├── database.js          # Conexión SQLite
│   ├── ssl/                 # Certificados SSL
│   └── routes/
│       ├── productos.js     # API de productos
│       ├── ventas.js        # API de ventas
│       └── caja.js          # API de caja/arqueo
├── public/
│   ├── index.html           # Interfaz principal
│   ├── css/
│   │   └── styles.css       # Estilos
│   └── js/
│       ├── app.js           # Módulo principal
│       ├── ventas.js         # Módulo de ventas
│       ├── barcode.js       # Lector de código de barras
│       ├── inventario.js    # Módulo de inventario
│       ├── compras.js       # Módulo de compras a proveedores
│       └── caja.js          # Módulo de caja
├── data/                    # Base de datos SQLite (auto-generado)
├── package.json
└── README.md
```

---

## ⌨️ Atajos de Teclado

| Tecla  | Acción                    |
|--------|---------------------------|
| **F2** | Cobrar venta              |
| **F4** | Ir a búsqueda de producto |
| **Esc**| Vaciar lista / Cerrar modal |

---

## 🔒 Seguridad y Calidad (ISO 9001 / ISO 27001)

- **Soft Delete**: Productos y ventas nunca se eliminan físicamente, solo se desactivan.
- **Prepared Statements**: Todas las consultas SQL usan parámetros preparados.
- **Trazabilidad**: Fechas de creación, modificación y anulación registradas.
- **Contingencia**: La venta en progreso se guarda en `localStorage` ante caídas de red.
- **Transacciones**: Las ventas usan transacciones atómicas (stock + venta + caja).

---

## 📊 Base de Datos

El sistema usa **SQLite** (archivo local en `data/bodega.db`).  
Se crea automáticamente al iniciar con productos de ejemplo.

### Tablas:
- `Productos` — Catálogo con código de barras, precios, stock
- `Ventas` — Cabecera de ventas (comprobante, total, método de pago)
- `Detalle_Ventas` — Items por venta
- `Movimientos_Caja` — Apertura, cierre, ingresos, egresos, compras
- `Numeracion_Comprobantes` — Series y correlativos

---

## 📄 Carga Masiva por CSV

Formato del archivo CSV:

```csv
codigo_barras,nombre,precio_venta,precio_compra,stock,categoria,unidad
7750100000123,Inca Kola 500ml,2.50,1.80,48,Bebidas,UND
7750100000456,Coca Cola 500ml,2.50,1.80,36,Bebidas,UND
```

Subir desde: **Inventario → Cargar CSV**

---

## 📝 Licencia

Uso libre para fines comerciales de bodegas pequeñas.
