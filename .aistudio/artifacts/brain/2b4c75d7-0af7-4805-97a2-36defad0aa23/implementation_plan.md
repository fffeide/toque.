# Módulo Recibo de Toque — Plan de Implementación

> Módulo integral de cobranza en caja, emisión de comprobantes digitales efímeros, club de fidelidad y captación transparente de reseñas en Google a través de carteles físicos inteligentes con NFC y QR.

---

### Decisiones Críticas y Preferencias del Usuario

> [!IMPORTANT]
> Se han incorporado las preferencias confirmadas por el usuario:
> - **Inicialización de datos**: Base limpia y estados vacíos honestos para nuevos comercios (con cartel de prueba `sin_activar` y PIN `ABC123` rotulado como *"Ejemplo"* para validar la activación).
> - **Pantalla de Caja**: Teclado numérico grande por defecto con interruptor rápido para detallar ítems (nombre + precio).
> - **Descarga en el Hub**: Generación y guardado local del comprobante como imagen PNG y archivo PDF ligero descargable en el navegador.

---

## 1. Visión General y Concepto Central

### Qué es y qué resuelve
El módulo **Recibo** complementa el ecosistema de **Toque**. Permite que el comerciante registre cobros en segundos desde cualquier tablet o computadora en la caja, y que el cliente, al apoyar su celular o escanear el cartel acrílico físico, visualice su comprobante de compra digital sin papel, acceda al programa de fidelidad (Club), conozca productos destacados y acceda de inmediato a calificar en Google Reviews con un botón neutral y sin condicionamientos.

### Personas y Contexto de Uso
1. **El Cajero / Empleado**: Opera en la pantalla `/caja` (tablet o monitor táctil), ingresa el importe rápidamente, selecciona el medio de cobro (Mercado Pago QR, Efectivo o Posnet) y solicita al cliente que apoye su dispositivo.
2. **El Cliente del Comercio**: Escanea el cartel o apoya su teléfono (NFC). Llega a `/h/:code` en su navegador móvil; sin necesidad de registrarse ni instalar aplicaciones, descarga su recibo, se suma al Club si lo desea y deja una reseña en Google Maps.
3. **El Titular del Comercio**: Administra en `/panel` sus carteles, el diseño del Hub en vivo, las ventas, el Club de fidelidad y la configuración de su cuenta.
4. **El Fabricante de Carteles**: Ingresa en `/admin/lotes` para generar partidas de carteles físicos (código corto + PIN interior) y exportar el CSV de impresión.

---

## 2. Experiencia de Usuario y Diseño Visual

### Identidad Visual y Sistema de Diseño (Sin Vidrio, Estética Editorial Sólida)
Se abandona cualquier efecto de vidrio o degradados oscuros para abrazar una estética editorial limpia, táctil y de alto contraste inspirada en papel y tinta de imprenta:

- **Paleta Estricta (5 Colores y Tonos Derivados)**:
  - `Papel` (`#F7F4EE`): Lienzo de fondo cálido, descansado y de lectura natural.
  - `Tinta` (`#0B1030`): Tipografía principal, bordes estructurales e íconos.
  - `Ultramar` (`#3A3FE0`): Acciones principales, enlaces y foco interactivo.
  - `Estrella` (`#FFC21A`): Botón principal en el Hub y acentos destacados (siempre con texto en color Tinta `#0B1030`, nunca blanco ni sobre claro).
  - `Coral` (`#B8332A`): Errores y cancelaciones.
  - *Tonos suaves*: Líneas `#E3DDD2`, Texto secundario `#5E6072`, Fondos suaves `#ECEDFC` (ultramar), `#FFF1C7` (estrella), `#FCE9E6` (coral).
- **Tipografías**:
  - `Sora`: Títulos, totales y números grandes en Caja y Comprobante.
  - `Inter`: Texto corrido, etiquetas, botones y cuerpo de interfaz.
  - `JetBrains Mono`: Exclusivamente para códigos de cartel (`TQ-4829`, PIN de activación).
- **Tarjetas y Superficies**: Sólidas, fondo blanco puro o papel con borde sutil `#E3DDD2` y sombra suave (sin transparencias ni desenfoques).
- **Ergonomía Táctil**:
  - Botones de Caja de $\ge 48\text{px}$, teclas numéricas grandes con respuesta táctil inmediata.
  - Mobile-first en el Hub del cliente con zona de pulgar optimizada.
  - Cumplimiento total de `prefers-reduced-motion` (desactivación de desplazamientos).

---

## 3. Decisiones Clave de Producto y Reglas de Oro

1. **Cero Firebase / Cero Backend en Servidor**:
   - Se construye una arquitectura pura en frontend con desacoplamiento total en `src/api`:
     - `ToqueApi.ts`: Interfaz TypeScript con contratos estrictos.
     - `mockApi.ts`: Implementación en memoria sin persistencia en Firebase ni localStorage como base de datos.
     - `httpApi.ts`: Cliente HTTP estándar con `fetch('/api/...')`, `credentials: 'include'` y manejo de errores `{ error: { code, message } }`.
     - `src/api/index.ts`: Switch dinámico basado en `VITE_API_MODE`.
2. **Sin Review Gating ni Premios por Opinar**:
   - El botón de Google Reviews siempre dice *"Dejar reseña en Google"*, es visible para todos los clientes (incluso si falló el recibo) y nunca se condiciona a premios o descuentos.
3. **Comprobante No Fiscal Seguro**:
   - Cada comprobante incluye la leyenda obligatoria: *"Comprobante de compra. No es una factura."*
   - Reclamable una única vez: tras su visualización/reclamo o pasados 3 minutos, desaparece del cartel para resguardar la privacidad del siguiente cliente.
4. **Privacidad Estricta**:
   - Sin registro de IPs.
   - El Club de Fidelidad solicita consentimiento explícito con casilla sin marcar y pide datos mínimos (nombre opcional + WhatsApp o correo).

---

## 4. Arquitectura del Sistema y Flujo de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            APP ROUTER (React 19)                            │
│                  Cargado con React.lazy + ErrorBoundary                     │
└──────┬───────────────────┬───────────────────┬──────────────────────┬───────┘
       │                   │                   │                      │
       ▼                   ▼                   ▼                      ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐       ┌──────────────┐
│  /login &    │    │  /activar/   │    │  /h/:code    │       │    /caja     │
│  /registro   │    │    :code     │    │  Hub Público │       │  Pantalla de │
│  (Auth)      │    │  (6 pasos)   │    │  (Mobile)    │       │  Cobro POS   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘       └──────┬───────┘
       │                   │                   │                      │
       └───────────────────┴─────────┬─────────┴──────────────────────┘
                                     ▼
                    ┌──────────────────────────────────┐
                    │       PANEL DEL NEGOCIO          │
                    │  /panel (Resumen, Ventas,        │
                    │   Carteles, Hub, Club, Conex.)   │
                    └────────────────┬─────────────────┘
                                     │
                                     ▼
                    ┌──────────────────────────────────┐
                    │     CAPA DE DATOS (src/api)      │
                    │   ToqueApi (Contrato Común)      │
                    │  ├── mockApi.ts (En memoria)     │
                    │  └── httpApi.ts (/api/...)       │
                    └──────────────────────────────────┘
```

### Mapa de Archivos a Implementar

```
src/
├── api/
│   ├── types.ts              // Tipos de dominio: Cartel, Sale, Receipt, Club, Hub
│   ├── ToqueApi.ts           // Interfaz abstracta de todos los métodos requeridos
│   ├── mockApi.ts            // Implementación mock en memoria con datos limpios y ejemplo rotulado
│   ├── httpApi.ts            // Implementación REST fetch a /api/...
│   └── index.ts              // Exporta api según VITE_API_MODE
├── lib/
│   ├── authContext.tsx       // Contexto liviano de autenticación (usuario y negocio)
│   ├── formatters.ts         // Formateo de pesos argentinos (ARS), fechas y números
│   └── receiptGenerator.ts   // Renderizado de comprobante como imagen PNG y PDF descargable
├── components/
│   ├── ErrorBoundary.tsx     // Captura de errores con mensaje claro y botón de reintento
│   ├── layout/
│   │   ├── PanelLayout.tsx   // Barra lateral en desktop + barra inferior en mobile
│   │   └── PublicHeader.tsx  // Cabecera limpia para Hub y Activación
│   └── ui/                   // Botones (Estrella/Ultramar), Teclado Numérico, Modal, Alertas
├── features/
│   ├── auth/
│   │   ├── LoginView.tsx     // Inicio de sesión con correo y Google simulado
│   │   └── RegisterView.tsx  // Registro de comercio y usuario
│   ├── activation/
│   │   └── ActivationView.tsx// Flujo guiado de 6 pasos con PIN, validación y prueba
│   ├── hub/
│   │   ├── PublicHubView.tsx // Hub público del cliente con recibo, reseña, club y redes
│   │   └── ReceiptBlock.tsx  // Comprobante no fiscal con descarga de imagen/PDF
│   ├── cashier/
│   │   └── CashierView.tsx   // Pantalla de caja táctil con Mercado Pago QR y simulación
│   ├── panel/
│   │   ├── DashboardSummaryView.tsx // Resumen con cobros, recibos y socios
│   │   ├── SalesView.tsx            // Historial de ventas y filtros
│   │   ├── CartelesManagementView.tsx// Gestión de carteles (estado, rol, enlaces)
│   │   ├── HubEditorView.tsx        // Editor accesible de bloques con vista previa
│   │   ├── ClubView.tsx             // Configuración de reglas, metas y lista de socios
│   │   ├── ConnectionsView.tsx      // Conexión con Mercado Pago
│   │   ├── ReviewsStatsView.tsx     // Toques de reseñas y aviso institucional
│   │   └── AccountSettingsView.tsx  // Perfil del negocio y link de Google Maps
│   └── admin/
│       └── BatchAdminView.tsx       // Generador de lotes y exportación CSV para fabricante
├── App.tsx                   // Enrutador con React.lazy y Suspense
├── main.tsx
└── index.css                 // Definición de variables CSS (#F7F4EE, #0B1030, #3A3FE0, etc.)
```

---

## 5. Criterios de Aceptación y Validación

- [x] **Activación en < 60s**: Cartel de ejemplo con PIN `ABC123` rotulado como *"Ejemplo"*, validación de URL de Google Maps y éxito inmediato.
- [x] **Flujo de Cobro y Recibo Efímero**: Se cobra un monto en `/caja`, se aprueba y en `/h/CODIGO` aparece el comprobante en la cabecera. Al recargar o ingresar de nuevo, desaparece por haber sido reclamado.
- [x] **Botón de Reseña Inquebrantable**: En `/h/:code` el botón *"Dejar reseña en Google"* permanece activo y accesible incluso ante cualquier desconexión o falla de los otros bloques.
- [x] **Accesibilidad y Movimiento**: Todo operable por teclado, sin fondos animados, con soporte para `prefers-reduced-motion` y contraste $\ge 4.5:1$.
- [x] **Verificación Técnica**: Compilación sin errores (`tsc --noEmit` y `vite build`).
