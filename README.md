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

El script lo encuentra aunque la terminal aún no tenga el PATH actualizado.

### Paso 2: Generar los certificados

```bash
.\cert.bat
```

> **Por qué un `.bat` y no `npm run cert`:** Windows viene con la ejecución de
> scripts de PowerShell deshabilitada, y `npm` en Windows *es* un script de
> PowerShell, así que ni siquiera arranca (`UnauthorizedAccess`). El `.bat` lo
> lanza igual sin cambiar nada del sistema. Si prefieres seguir con npm, usa
> `npm.cmd run cert` — el `.cmd` no está bloqueado.
>
> Para habilitarlo de forma permanente (decisión tuya, es un ajuste de
> seguridad): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

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
.\iniciar-https.bat
```

Con el celular en la **misma red**, abre `https://<IP-DE-TU-PC>:3443`
— el script te imprime la dirección exacta al terminar.

> Si el router le cambia la IP a la PC, vuelve a correr `npm run cert`: el
> certificado va atado a esa IP. Para evitarlo, reserva la IP de la PC en el
> router (DHCP estático).

---

## 📷 Lector de Código de Barras

Funciona en **tres lugares** y con **dos métodos**:

| Dónde | Escáner USB (PC) | Cámara (celular) |
|---|---|---|
| **Ventas** | Dispara el código sobre el buscador: entra al carrito | Botón `📷 Cámara` junto al buscador |
| **Nuevo / Editar Producto** | Dispara el código sobre el campo *Código de Barras* | Botón `📷` junto al campo |
| **Nueva Compra** | Dispara el código: el producto entra a la compra | Botón `📷` junto al buscador |

### En ventas

El escáner USB escribe el código y termina con Enter: el producto entra al
carrito sin tocar el mouse y el buscador queda limpio y enfocado para el
siguiente. Escanear dos veces el mismo producto suma cantidad.

Tecleando también sirve: si el nombre da **una sola** coincidencia, Enter la
agrega; si da varias, avisa para que elijas de la lista.

La cámara se queda abierta para escanear productos seguidos, con medio segundo
de espera entre lecturas repetidas del mismo código.

### En el alta de productos

- El código se escribe en el campo y el foco salta al **nombre**.
- Si el código **ya pertenece a otro producto**, el sistema lo avisa y ofrece
  abrir ese producto para editarlo (útil para reponer stock escaneando).
- La cámara se apaga sola al capturar el código; en **compras** se queda
  abierta para escanear varios productos seguidos.

> El botón de cámara aparece donde la cámara puede funcionar — HTTPS o
> `localhost`, así que también sirve con una webcam en la PC — y en el celular
> aunque falte HTTPS, para que te diga qué hace falta en vez de desaparecer.

> El escáner USB no necesita nada: se comporta como un teclado y funciona
> siempre, aun sin HTTPS.

---

## ⚙️ Datos del Negocio

El botón ⚙️ de la esquina superior derecha abre la configuración:

| Dato | Dónde se usa |
|---|---|
| **Nombre** (obligatorio) | Encabezado del sistema y del comprobante de WhatsApp |
| **Teléfono / WhatsApp** | Al pie del comprobante, como *"Pedidos: ..."* |
| **Dirección** | Bajo el nombre en el comprobante |
| **RUC** | Bajo el nombre en el comprobante |
| **Foto** | Encabezado del sistema y del comprobante en imagen |
| **QR de Yape / Plin** | Se le muestra al cliente al cobrar |
| **Nombre y número de Yape** | Debajo del QR, para que el cliente confirme |

La foto se recorta al centro y se reduce a 256px antes de guardarse: una foto
de celular de 4 MB queda en unos pocos KB. El navegador reserva poco espacio
para todo el sistema, y guardar el original lo llenaría.

### 💾 Copia de seguridad

Los datos (productos, ventas, compras, caja y esta configuración) se guardan en
**el navegador**, y el navegador los separa por **dirección**: entrar por
`http://<ip>:3000` y por `https://<ip>:3443` son dos bodegas distintas, aunque
sea el mismo servidor y el mismo celular. Lo mismo entre la PC y el celular.

Por eso la configuración tiene **Descargar copia** y **Restaurar copia**:

1. En el equipo que tiene los datos buenos: **Descargar copia** (un archivo `.json`).
2. En el otro: **Restaurar copia** y elegir ese archivo.

> Restaurar **reemplaza** todo lo que haya en ese navegador; el sistema avisa
> antes con lo que se va a perder.

> Conviene descargar una copia de vez en cuando: si se borran los datos de
> navegación del celular, se va todo. No hay otro respaldo.

---

## 📱 Cobrar por Yape / Plin

Al elegir **Yape/Plin** como método de pago aparece el botón *Mostrar QR al
cliente*: abre el código en grande con el **monto exacto**, tu nombre y tu
número, para que el cliente escanee sin tipear nada.

Carga tu QR una sola vez en la configuración (⚙️). Se guarda en PNG y sin
recortar, para que no pierda las esquinas ni se difumine: si se deforma, deja
de leerse.

> El sistema **no verifica** que el pago haya llegado: confirma en tu app de
> Yape antes de cerrar la venta.

> El pago con **tarjeta** se quitó: un negocio NRUS no suele tener POS.

---

## 💬 Enviar el Comprobante por WhatsApp

Al terminar una venta, el comprobante trae un campo para mandarlo al cliente.
Escribe el celular (9 dígitos, se le agrega el +51 solo) y **Enviar**: se abre
WhatsApp con el mensaje ya escrito.

```
*Bodega Doña Rosa*
RUC 10456789012
Jr. Ayacucho 123, Huancayo

Boleta de Venta B001-2609-000001
27/09/2026, 10:16 p. m.

1 x Inca Kola 500ml — S/ 3.00
1 x Galletas Oreo Paq. — S/ 3.50

*TOTAL: S/ 6.50*
Pago: Efectivo
Pagó con: S/ 10.00
Vuelto: S/ 3.50

¡Gracias por su compra!
Pedidos: 987 654 321
```

Sin número, abre WhatsApp para que elijas el contacto de la lista.

> **El envío lo confirma la persona.** WhatsApp abre el chat con el texto
> listo y hay que darle a enviar. Mandarlo solo, sin intervención, exige
> contratar la API de WhatsApp Business con un proveedor y plantillas
> aprobadas — no se puede desde una web.

### Como imagen

El botón **Enviar como imagen** arma el comprobante dibujado — con tu foto,
nombre, RUC, dirección, productos, total y vuelto — y lo comparte:

- **En el celular:** abre la hoja de Android para elegir WhatsApp y va como foto.
- **En la PC:** se descarga el PNG para adjuntarlo a mano.

La imagen se dibuja apenas se cierra la venta, no al tocar el botón: Android
descarta el permiso de compartir si pasa demasiado entre el toque y el envío.

> El botón verde de arriba manda el mismo comprobante como **texto**, que pesa
> menos y se puede buscar en el chat. La imagen se ve mejor; elige según el caso.

Los datos del encabezado salen de la configuración (botón ⚙️).

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

**Diseño de celular.** No es la pantalla de escritorio encogida:

- **Ventas:** la lista de resultados es corta, así el carrito y el total quedan
  en la misma pantalla. Si el botón Cobrar se va de la vista, aparece abajo una
  **barra fija** con los productos, el total y un botón para bajar a cobrar.
- **Inventario y Compras:** las tablas se vuelven **tarjetas**, una por producto
  o compra, con el nombre arriba y los botones a la derecha. Antes había que
  arrastrar la tabla de lado y siempre quedaba algo cortado.
- Los métodos de pago van en fila, no apilados; el buscador y su botón de
  cámara caben en un solo renglón.
- Los avisos salen **abajo**: arriba tapaban el buscador justo al escribir.
  Si la barra de cobro está a la vista, suben para no quedar debajo de ella.

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
│       ├── config.js        # Datos del negocio (nombre, contacto, foto)
│       └── caja.js          # Módulo de caja
├── cert.bat                 # Genera los certificados (doble clic)
├── iniciar.bat              # Arranca el servidor normal (HTTP)
├── iniciar-https.bat        # Arranca el servidor HTTPS (cámara)
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
