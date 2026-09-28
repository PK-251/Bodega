<#
    ════════════════════════════════════════════════
     BODEGA POS — Certificados HTTPS con mkcert
    ════════════════════════════════════════════════

    Genera un certificado válido para esta PC (localhost y su IP
    de red local) y deja listo el archivo que hay que instalar en
    el celular para que Chrome deje de mostrar la advertencia.

    Uso:  npm run cert

    Importante: este script ejecuta "mkcert -install", que agrega
    una autoridad certificadora LOCAL al almacén de confianza de
    Windows. Esa autoridad vive solo en esta PC y sirve para firmar
    certificados de desarrollo. Si algún día quieres quitarla:
    mkcert -uninstall
#>

$ErrorActionPreference = 'Stop'

function Escribir($texto, $color = 'White') {
    Write-Host $texto -ForegroundColor $color
}

Escribir ""
Escribir "═══ Certificados HTTPS para Bodega POS ═══" Cyan
Escribir ""

# ─── 1. Verificar mkcert ──────────────────────
# Recién instalado con winget no queda en el PATH de esta
# terminal hasta reiniciarla, así que también se busca donde
# winget deja los programas.
function BuscarMkcert {
    $cmd = Get-Command mkcert -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidatos = @(
        (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\mkcert.exe"),
        (Join-Path $env:ProgramFiles "mkcert\mkcert.exe"),
        "C:\ProgramData\chocolatey\bin\mkcert.exe"
    )
    foreach ($c in $candidatos) {
        if ($c -and (Test-Path $c)) { return $c }
    }

    $paquetes = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path $paquetes) {
        $hallado = Get-ChildItem $paquetes -Recurse -Filter "mkcert*.exe" -ErrorAction SilentlyContinue |
                   Select-Object -First 1
        if ($hallado) { return $hallado.FullName }
    }

    return $null
}

$mkcert = BuscarMkcert
if (-not $mkcert) {
    Escribir "❌ mkcert no está instalado." Red
    Escribir ""
    Escribir "   Instálalo con:" Yellow
    Escribir "   winget install FiloSottile.mkcert" White
    Escribir ""
    Escribir "   Luego repite: npm run cert" Yellow
    Escribir ""
    exit 1
}
Escribir "✓ mkcert encontrado: $mkcert" Green

# ─── 2. Detectar las IP de red local ─────
# Se incluyen TODAS las direcciones reales de la PC (puede tener
# Wi-Fi y cable a la vez), descartando las virtuales de Docker,
# Hyper-V, VPN y las de enlace local 169.254.
$virtuales = 'vEthernet|Hyper-V|VirtualBox|VMware|Docker|WSL|Loopback|Bluetooth'

$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
         Where-Object {
             $_.IPAddress -notlike '127.*' -and
             $_.IPAddress -notlike '169.254.*' -and
             $_.InterfaceAlias -notmatch $virtuales
         } |
         Select-Object -ExpandProperty IPAddress -Unique)

if ($ips.Count -eq 0) {
    Escribir "❌ No se pudo detectar ninguna IP de red local." Red
    Escribir "   Conéctate al Wi-Fi o al cable y vuelve a intentarlo." Yellow
    exit 1
}

# La de la interfaz con salida a internet es la que se muestra al final
$ruta = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Sort-Object RouteMetric |
        Select-Object -First 1
$ipPrincipal = $ips[0]
if ($ruta) {
    $candidata = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $ruta.InterfaceIndex -ErrorAction SilentlyContinue |
                  Where-Object { $_.IPAddress -notlike '169.254.*' } |
                  Select-Object -First 1).IPAddress
    if ($candidata) { $ipPrincipal = $candidata }
}

Escribir ("✓ IP de esta PC en la red: " + ($ips -join ', ')) Green

# ─── 3. Instalar la autoridad local ───────────
Escribir ""
Escribir "→ Instalando la autoridad certificadora local en Windows..." Cyan
Escribir "  (puede aparecer una ventana de Windows pidiendo confirmación)" DarkGray
& $mkcert -install
if ($LASTEXITCODE -ne 0) {
    Escribir "❌ Falló 'mkcert -install'." Red
    exit 1
}

# ─── 4. Generar el certificado del servidor ───
$raiz   = Split-Path -Parent $PSScriptRoot
$sslDir = Join-Path $raiz 'server\ssl'
New-Item -ItemType Directory -Force -Path $sslDir | Out-Null

Escribir ""
Escribir ("→ Generando certificado para localhost y " + ($ips -join ', ') + " ...") Cyan

$nombres = @('localhost', '127.0.0.1', '::1') + $ips

Push-Location $sslDir
try {
    & $mkcert -key-file key.pem -cert-file cert.pem @nombres
    if ($LASTEXITCODE -ne 0) { throw "mkcert no pudo generar el certificado" }
} finally {
    Pop-Location
}
Escribir "✓ Certificado creado en server\ssl\" Green

# ─── 5. Copiar la CA para el celular ──────────
$caRoot = (& $mkcert -CAROOT).Trim()
$caOrigen = Join-Path $caRoot 'rootCA.pem'
$caDestino = Join-Path $sslDir 'bodega-CA.crt'

if (Test-Path $caOrigen) {
    Copy-Item $caOrigen $caDestino -Force
    Escribir "✓ Autoridad para el celular: server\ssl\bodega-CA.crt" Green
} else {
    Escribir "⚠ No se encontró rootCA.pem en $caRoot" Yellow
}

# ─── 6. Instrucciones ─────────────────────────
Escribir ""
Escribir "═══ Listo. Ahora en el celular ═══" Cyan
Escribir ""
Escribir "  1. Pasa el archivo server\ssl\bodega-CA.crt al celular"
Escribir "     (cable USB, WhatsApp a ti mismo, Drive, lo que uses)."
Escribir ""
Escribir "  2. En Android: Ajustes → Seguridad → Cifrado y credenciales"
Escribir "     → Instalar un certificado → Certificado de CA → elegir el archivo."
Escribir "     Android pedirá el PIN del teléfono y avisará que la red"
Escribir "     puede ser monitoreada: es normal, la autoridad es tuya."
Escribir ""
Escribir "  3. En la PC:  npm run https"
Escribir ""
Escribir "  4. En el celular, con el mismo Wi-Fi, abre:"
Escribir "     https://$ipPrincipal`:3443" Green
Escribir ""
Escribir "  Ya no debería aparecer ninguna advertencia." DarkGray
Escribir ""
if ($ips.Count -gt 1) {
    Escribir ("  También sirve cualquiera de estas: " + ($ips -join ', ')) DarkGray
    Escribir ""
}
Escribir "  Si el router le cambia la IP a la PC, vuelve a correr" DarkGray
Escribir "  'npm run cert' (el certificado va atado a la IP)." DarkGray
Escribir ""
