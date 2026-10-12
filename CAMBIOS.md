# Toque — migración a Cloudflare D1 (resumen)

## Qué pasaba
Firestore rechazaba toda escritura (las reglas pedían `destinationUrl`; el código guardaba `targetUrl`) y el código
guardaba en localStorage sin avisar. Cada navegador tenía su "base de datos": en el celular el cartel no existía.
No había registro ni login real; Equipo y Canales eran datos fijos; el fabricante "asignado" era inventado.

## Qué hay ahora
- Backend real: `worker/` (Hono) + D1 (`migrations/0001_init.sql`) + KV.
- Redirect `/r/:code` en el borde: 302 en ~8 ms, registra el escaneo después de responder, sin guardar IP,
  ignora bots y duplicados (30 s), fail-open con copia en KV, código desconocido = "no encontrado".
- Registro e ingreso: correo + contraseña (PBKDF2) y Google OAuth. Sesión en cookie HttpOnly, anti-CSRF, límite de intentos.
- Los negocios que se registran solos pertenecen a Toque (sin fabricante inventado).
- Perfil del comercio editable (nombre y link de reseñas). Cambiar el link no obliga a reimprimir.
- Equipo (QR por persona) y Canales reales, con conteo propio y alta/baja.
- Reportes guardados: cron mensual los consolida; los escaneos se depuran a los 400 días.
- Se eliminó Firebase, Express, Drizzle/Postgres y el redirect del lado del navegador.
- Se mantienen las correcciones previas: textos sin "5 estrellas", validador de links de Google endurecido.

## Pendiente
- Panel de fabricantes y admin (la API responde 501 con mensaje claro).
- Ingreso por enlace al correo (hace falta proveedor de correo) y reseñas de Google reales.
- Planes por cantidad de clientes y cobro con Mercado Pago.
- Widget de chat: sigue guionado; `/api/chat` existe (con sesión y límite) pero no está conectado.
- Pruebas visuales en navegador y pasada de accesibilidad.
