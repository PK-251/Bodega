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

## 📱 Acceso desde el Celular (Cámara / Escáner)

Los navegadores exigen **HTTPS** para dar acceso a la cámara. Se usa
**mkcert**, que crea una autoridad certificadora propia: instalándola una
sola vez en el celular, Chrome deja de mostrar advertencias para siempre.

### Paso 1: Instalar mkcert (una sola vez en la PC)

```bash
winget install FiloSottile.mkcert
```

Cierra y vuelve a abrir la terminal para que quede en el PATH.

### Paso 2: Generar los certificados

```bash
npm run cert
```

El script detecta **todas** las IP reales de la PC (Wi-Fi y cable, descartando
las virtuales de Docker y Hyper-V), genera un certificado válido para todas y
deja la autoridad lista en `server/ssl/bodega-CA.crt`.

> Este paso ejecuta `mkcert -install`, que agrega una autoridad certificadora
> **local** al almacén de confianza de Windows. Vive solo en esta PC y sirve
> para firmar certificados de desarrollo. Para quitarla: `mkcert -uninstall`.

### Paso 3: Instalar la autoridad en el celular (una sola vez)

1. Pasa `server/ssl/bodega-CA.crt` al celular (cable, WhatsApp a ti mismo, Drive...).
2. **Ajustes → Seguridad → Cifrado y credenciales → Instalar un certificado
   → Certificado de CA** y elige el archivo.
3. Android pide el PIN del teléfono y avisa que la red podría ser monitoreada.
   Es el aviso estándar para cualquier CA agregada a mano; esta la generaste tú
   y su clave privada no sale de tu PC.

> El menú cambia de nombre según la marca: busca *"Instalar certificado"*
> o *"Credenciales"* dentro de Seguridad.

### Paso 4: Usarlo

```bash
npm run https
```

Con el celular en la **misma red Wi-Fi**, abre `https://<IP-DE-TU-PC>:3443`
— el script te imprime la dirección exacta al terminar.

> Si el router le cambia la IP a la PC, vuelve a correr `npm run cert`: el
> certificado va atado a esa IP. Para evitarlo, reserva la IP de la PC en el
> router (DHCP estático).

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

Pensado para **PC con Windows + celular Android**, que es el equipo de la bodega.

**Tamaños.** Probado de 320px a escritorio, en vertical y en horizontal:
320×568, 360×740 (Android común), 430×932 y 667×375 acostado. Ninguna
sección desborda la pantalla. Las tablas anchas (inventario, compras) se
deslizan en horizontal con el dedo.

**Detalles táctiles.**

- Campos de 16px en celular: cómodos para el dedo y sin zoom automático.
- Botones de ícono de 36px y pestañas de 40px de alto.
- Los atajos de teclado (F2, F4) se ocultan en pantallas sin mouse.
- La altura usa `dvh`, así la barra del navegador no corta el contenido.
- Vibración corta al escanear un código (funciona en Android).

**Navegadores.** El código evita sintaxis reciente (nada de `?.`, `??` ni
`catch` sin variable) para no romperse en Android antiguos: un error de
parseo dejaría la app en blanco. Piso real: Chrome 55+, Edge 79+,
Firefox 52+ — cualquier Android que reciba actualizaciones lo cumple.

### Cámara en el Android

1. Levantar el sistema con `npm run https` (ver la sección de acceso desde celulares).
2. En el celular, entrar a `https://<IP-de-la-PC>:3443`.
3. Al tocar el botón 📷 por primera vez, Chrome pide permiso de cámara: **Permitir**.

Con la autoridad de mkcert instalada en el celular no aparece ninguna
advertencia de certificado.

> Sin HTTPS el botón de cámara avisa y no hace nada: los navegadores no dan
> acceso a la cámara en conexiones sin cifrar. El escáner USB en la PC no
> necesita nada de esto.

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
├── scripts/
│   └── generar-certificados.ps1  # Certificados HTTPS con mkcert
├── data/                    # Base de datos local (auto-generado)
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
