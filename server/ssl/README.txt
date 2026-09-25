Coloca aquí los archivos del certificado SSL autofirmado:
- key.pem
- cert.pem

Para generar (requiere OpenSSL):

    openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=bodega-pos"

En Windows, instalar OpenSSL con:

    winget install OpenSSL
