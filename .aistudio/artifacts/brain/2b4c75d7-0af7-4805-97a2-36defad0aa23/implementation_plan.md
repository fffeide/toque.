# TOQUE — Sincronización Real Caja ↔ Hub, RLS, WalletWallet y Unificación Visual

Transformaremos **TOQUE** de un prototipo en memoria volátil a una plataforma en tiempo real respaldada por **Cloud Firestore** y proxy de servidor seguro, incorporando control de acceso por filas y roles (**RLS**), emisión de pases reales con **WalletWallet**, analítica con **Microsoft Clarity** (`ywqriqpjun`), y unificación estética **Matte Dark Flat** con cumplimiento estricto de contraste **WCAG AA**.

### User Review & Critical Decisions

> [!IMPORTANT]
> Se han incorporado todas las definiciones confirmadas para asegurar una arquitectura 100% real, sin datos ficticios y con aislamiento de seguridad por rol y comercio.

- **Roles y Permisos en Equipo (Confirmado)**: Tres niveles de acceso (**Dueño**, **Encargado** y **Cajero**) con permisos diferenciados y redirección automática según el rol asignado.
- **Alcance del Panel Admin (Confirmado)**: Métricas 100% reales tanto en el panel de cada comercio como en una nueva vista **Super Admin Global** para auditar toda la plataforma.
- **Conexión Caja ↔ Hub para Recibos (Confirmado)**: Doble modalidad simultánea — aparición instantánea en tiempo real al apoyar/escanear el cartel del mostrador y código QR / estado NFC directo en la pantalla de la Caja.

---

### 1. Overview & Core Concept

- **What It Does**: Plataforma integral para comercios físicos que conecta el punto de venta (**Caja**) con el cartel inteligente del mostrador (**Hub NFC/QR**), permitiendo emitir comprobantes digitales en tiempo real, fidelizar clientes con pases de **Apple Wallet / Google Wallet** vía **WalletWallet**, y administrar colaboradores bajo reglas estrictas de seguridad (**RLS**).
- **Target Audience / Persona**:
  - **Dueños y Encargados de Comercios**: Administran su cartel, su club de beneficios, sus métricas reales de facturación y su equipo de trabajo.
  - **Cajeros**: Operan exclusivamente la terminal de cobro rápida en mostrador para emitir ventas y comprobantes digitales al instante.
  - **Clientes Finales**: Apoyan su teléfono en el cartel o escanean el QR en caja para recibir su comprobante al instante y sumar puntos en su Wallet.
  - **Super Admin Global**: Supervisa el rendimiento real de todos los comercios, carteles y emisiones en toda la red TOQUE.
- **Key Value**: Elimina la desconexión entre pestañas o dispositivos mediante sincronización instantánea en la nube, protege todas las credenciales de API en el servidor y garantiza datos 100% verificables.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Flujo de Cobro y Comprobante en Tiempo Real (Caja ↔ Hub)**:
     - El cajero ingresa el monto, concepto y método de pago en la **Caja** y confirma el cobro.
     - Instantáneamente, la pantalla de **Caja** despliega la tarjeta del comprobante emitido con su **código QR directo**, estado de vinculación **NFC activa** y vista previa del ticket.
     - En paralelo, cualquier cliente que tenga abierto el **Hub del Cartel** (o acerque su teléfono vía NFC/QR dentro de la ventana activa) ve aparecer en vivo el banner destacado **"Tu Comprobante Digital está listo"** sin recargar la página, pudiendo abrirlo, guardarlo o descargarlo.
  2. **Flujo de Fidelización y Pase Digital (WalletWallet)**:
     - Desde el Hub del comercio, el cliente se une al Club de Beneficios ingresando su nombre y contacto.
     - Al tocar **"Agregar a Wallet"**, la aplicación solicita al backend seguro la creación del pase digital en `api.walletwallet.dev` y entrega el pase listo para Apple Wallet / Google Wallet sin exponer jamás la clave privada.
  3. **Flujo de Gestión de Equipo y RLS**:
     - En la sección **Equipo** del panel, el Dueño invita o registra colaboradores indicando nombre, email, rol (**Dueño**, **Encargado** o **Cajero**) y caja/cartel asignado.
     - Cuando un colaborador inicia sesión con su correo, el sistema RLS detecta su membresía y le habilita únicamente las vistas autorizadas (por ejemplo, llevando al Cajero directo a la terminal de Caja y bloqueando rutas administrativas).
  4. **Eliminación de Módulos Obsoletos**:
     - Se remueven por completo las vistas y accesos a **Lotes de Producción (Fabricante)** y **Conexiones**, dejando una navegación limpia enfocada en la operación real y la sección de **Equipo**.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **Matte Dark Flat** de alto contraste, velocidad inmediata y cero ruido visual (sin desenfoques `backdrop-blur`, sin transparencias lechosas ni gradientes decorativos). Toda la experiencia —Home, Panel, Caja, Hub Público, Recibo Digital y Activación— comparte el mismo lenguaje visual.
  - *Color Palette & Mood*:
    - `--background`: `#000000` / `#0c0c0c` (Negro carbón mate profundo para el lienzo general).
    - `--surface`: `#111113` / `#141414` (Gris grafito sólido para tarjetas, paneles laterales y módulos operativos).
    - `--surface-elevated`: `#18181b` (Contenedores interactivos, selectores y cajas de datos).
    - `--border`: `#242426` (`1px solid` técnico, con estado hover en `#333338`).
    - `--primary`: `#bec8ff` (Lavanda característico del Home, usado en botones primarios e indicadores clave con texto oscuro `#0c0c0c` para un contraste > 11:1).
    - `--accent-emerald`: `#2fb36a` (Verde esmeralda del Home para confirmaciones de cobro, estados activos y emisión de recibos, acompañado de texto `#0c0c0c` en botones sólidos o `#34d399` sobre fondos oscuros).
    - `--text-primary`: `#f1f1ee` / `#ffffff` (Títulos, montos y datos principales).
    - `--text-secondary`: `#a1a1aa` (Subtítulos y etiquetas secundarias, garantizando relación de contraste >= 4.5:1 WCAG AA sobre `#0c0c0c` y `#141414`).
  - *Typography & Hierarchy*:
    - Encabezados y montos destacados en `Plus Jakarta Sans` / `Inter` en peso `600–700` con `tracking-tight`.
    - Códigos de recibo, identificadores de cartel, importes tabulares y marcas de tiempo en `JetBrains Mono` (`tabular-nums`).
    - Etiquetas de sección en mayúsculas compactas (`11px`, `tracking-wider`, color `#a1a1aa`).

- **Interactive Feedback & Motion**:
  - Indicador de sincronización en vivo en el Hub y en la Caja cuando se emite un comprobante nuevo.
  - Estados vacíos honestos y accionables cuando un comercio aún tiene `0` ventas o `0` miembros, sin rellenar con gráficos ni cifras ficticias.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Sincronización en Tiempo Real mediante Cloud Firestore (`onSnapshot`)**
  - *Chosen Approach*: Persistir comercios, carteles, ventas, comprobantes, miembros del club y equipo en Firestore con suscripciones en tiempo real entre la Caja y el Hub Público.
  - *Why*: Resuelve de raíz el problema donde la Caja y el Hub no se conectaban por estar aislados en la memoria local de cada pestaña. Ahora un cobro en la computadora o tablet del cajero aparece al instante en el teléfono del cliente.
  - *Alternatives Considered*: `localStorage` o `BroadcastChannel`, descartados porque solo funcionan dentro del mismo navegador y no entre el dispositivo del comercio y el celular del cliente.

- **Decision 2: Proxy Backend para WalletWallet API y Variables de Entorno**
  - *Chosen Approach*: Almacenar `WALLETWALLET_API_KEY` exclusivamente en el entorno del servidor Express y exponer un endpoint interno `/api/wallet/pass` que realiza la petición autenticada hacia `https://api.walletwallet.dev`.
  - *Why*: Cumple con la regla estricta de esconder siempre todas las APIs y evita que la clave privada `ww_live_...` pueda ser inspeccionada desde el navegador.
  - *Alternatives Considered*: Llamadas directas desde el navegador (`fetch` en el cliente), descartadas por exponer la credencial en el tráfico de red del cliente.

- **Decision 3: Seguridad RLS (Row-Level Security) en Dos Capas (Reglas de Base de Datos + Guardián de Vistas)**
  - *Chosen Approach*: Aplicar validación de pertenencia y rol tanto en las reglas de seguridad de Firestore como en el contexto de sesión de la aplicación.
  - *Why*: Garantiza que cada usuario acceda únicamente a los datos de su comercio asignado, que los Cajeros solo operen la Caja, y que solo cuentas autorizadas como Super Admin visualicen métricas globales de toda la plataforma.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CLIENTE WEB (Matte Dark Flat UI)                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Microsoft Clarity Analytics (Tag ID: ywqriqpjun en cabecera global)    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌──────────────┐  │
│  │   PANEL DEL COMERCIO    │  │    TERMINAL DE CAJA     │  │ SUPER ADMIN  │  │
│  │  (Dueño / Encargado)    │  │  (Dueño/Encarg./Cajero) │  │   GLOBAL     │  │
│  │  • Resumen (100% Real)  │  │  • Teclado e Importe    │  │  • Métricas  │  │
│  │  • Mi Cartel / Hub      │  │  • Emisión Instantánea  │  │    Globales  │  │
│  │  • Recibos y Club       │  │  • QR Directo + NFC     │  │  • Auditoría │  │
│  │  • Equipo (Roles RLS)   │  │  • Historial de Turno   │  │    Comercios │  │
│  └───────────┬─────────────┘  └────────────┬────────────┘  └──────┬───────┘  │
│              │                             │                      │          │
│              │         ┌───────────────────┴────────────┐         │          │
│              │         │      HUB PÚBLICO & RECIBOS     │         │          │
│              │         │  • Banner Recibo en Vivo (NFC) │         │          │
│              │         │  • Vista /Descarga de Ticket   │         │          │
│              │         │  • Registro Club + Pase Wallet │         │          │
│              │         └─────────┬──────────────┬───────┘         │          │
└──────────────┼───────────────────┼──────────────┼─────────────────┼──────────┘
               │                   │              │                 │
               ▼                   ▼              │                 ▼
┌─────────────────────────────────────────┐       │  ┌─────────────────────────┐
│     CLOUD FIRESTORE (Tiempo Real + RLS) │       │  │ SERVIDOR EXPRESS PROXY  │
│  • businesses (Datos + Accesos RLS)     │       └─►│  POST /api/wallet/pass  │
│  • cartels    (Vínculo Caja ↔ Hub)      │          │  GET  /api/wallet/status│
│  • sales      (Cobros reales emitidos)  │          │  [WALLETWALLET_API_KEY] │
│  • receipts   (Tickets digitales vivos) │          └────────────┬────────────┘
│  • members    (Clientes del Club)       │                       │
│  • team       (Colaboradores y Roles)   │                       ▼
└─────────────────────────────────────────┘          ┌─────────────────────────┐
                                                     │   api.walletwallet.dev  │
                                                     └─────────────────────────┘
```

- **Data Model & State**:
  - **Comercios (`businesses`)**: Identificador único, nombre comercial, rubro, configuración visual del Hub, propietario (`ownerUid`, `ownerEmail`), lista de correos autorizados (`teamEmails`) y mapa de roles (`roleMap`) para verificación RLS inmediata.
  - **Carteles (`cartels`)**: Código público único (ej. `CAJA01`), comercio vinculado, estado activo, contador real de escaneos y referencia al último comprobante emitido (`activeReceiptCode`, `activeReceiptUntil`).
  - **Ventas y Comprobantes (`sales` & `receipts`)**: Monto exacto, concepto, detalle de ítems, método de pago, código único de comprobante, fecha de emisión, estado de visualización en el Hub (`pending` / `claimed`) y comercio emisor.
  - **Equipo (`team`)**: Nombre del colaborador, correo electrónico, rol asignado (`owner`, `manager`, `cashier`), cartel/caja predeterminada y estado de acceso.
  - **Miembros del Club (`members`)**: Datos reales del cliente registrado desde el Hub, puntos acumulados por compras reales y estado de su pase digital WalletWallet.

- **Interactive Component & State Mapping**:
  - **Emisión en Caja → Aparición en Hub**: Al confirmar el cobro en la Caja, se crea el registro en `sales` y `receipts` y se actualiza el cartel correspondiente con `activeReceiptCode`. El listener en tiempo real del Hub detecta el cambio en menos de 200 ms y despliega el recibo en el celular del cliente; al mismo tiempo, la Caja muestra el QR directo para escaneo en mostrador.
  - **Gestión de Equipo → Permisos RLS**: Al agregar o editar un colaborador en la vista de Equipo, se actualiza el documento en `team` y el mapa de permisos del comercio. El guardián de navegación evalúa el rol en cada ruta y filtra el menú lateral automáticamente.
  - **Generación de Pase WalletWallet**: Al solicitar el pase desde el Club del Hub o Panel, el cliente envía los datos no sensibles a `/api/wallet/pass`; el servidor firma la solicitud con la clave oculta hacia `https://api.walletwallet.dev` y retorna el enlace o payload del pase para guardarlo en el teléfono.
