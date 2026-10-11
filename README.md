# Toque — Tu cartel, con datos

> **Propuesta de valor:** "Tu cartel, con datos."  
> **Para fabricantes:** "Vendé el cartel. Quedate con el cliente."  
> Plataforma SaaS multi-tenant para vincular carteles físicos con chip NFC y código QR directamente a las reseñas de Google Maps, midiendo toques en tiempo real, con analítica agregada y preservación total de la privacidad de los clientes finales.

---

## 1. Cómo correr el proyecto

### Requisitos previos
- Node.js 18+ (recomendado Node.js 20+)
- npm 9+

### Instalación y ejecución local
```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en puerto 3000
npm run dev

# Compilar para producción (typecheck + bundle optimizado con chunks diferidos)
npm run build

# Ejecutar validación de tipos y sintaxis (Linter)
npm run lint
```

El servidor estará disponible en `http://localhost:3000`.

---

## 2. Estructura del proyecto

```text
toque-app/
├── index.html                     # HTML principal con metaetiquetas OpenGraph y Schema.org
├── package.json                   # Dependencias, scripts y configuración del proyecto
├── .env.example                   # Variables de entorno documentadas
├── public/
│   ├── robots.txt                 # Directivas para rastreadores de búsqueda
│   └── sitemap.xml                # Mapa del sitio con rutas públicas y legales
└── src/
    ├── main.tsx                   # Punto de entrada de React 19
    ├── App.tsx                    # Enrutador con carga diferida (lazy loading) y alerta offline
    ├── index.css                  # Hoja de estilos global (@import "tailwindcss")
    ├── api/                       # Capa de datos y contratos Anexo A
    │   ├── types.ts               # Modelos de datos TypeScript (Cartel, Tenant, Scan, etc.)
    │   ├── ToqueApi.ts            # Contrato estricto de la interfaz ToqueApi
    │   ├── mockApi.ts             # Adaptador en memoria determinístico con persistencia
    │   ├── httpApi.ts             # Adaptador HTTP REST con cookies httpOnly
    │   └── index.ts               # Selector dinámico de API según VITE_API_MODE
    ├── components/                # Componentes reutilizables de UI y maquetación
    │   ├── layout/
    │   │   └── AppLayout.tsx      # Shell responsive, dock móvil y barra superior
    │   └── ui/                    # Sistema de diseño con Apple Liquid Glass disciplinado
    │       ├── Avatar.tsx         # BrandLogo e isotipo de la estrella de Toque
    │       ├── BarChart.tsx       # Gráficos de barras accesibles con tooltips
    │       ├── Button.tsx         # Botones con target táctil >= 44px
    │       ├── Card.tsx           # Tarjetas con borde sutil y sombras suaves
    │       ├── Dialog.tsx         # Modales accesibles con foco atrapado
    │       ├── ErrorState.tsx     # Estado de error con botón de reintento
    │       ├── EmptyState.tsx     # Estado vacío con llamada a la acción
    │       ├── Skeleton.tsx       # Marcadores de posición de carga
    │       ├── Toast.tsx          # Notificaciones toast con acción deshacer
    │       └── ThemeToggle.tsx    # Selector de tema claro / oscuro
    ├── config/
    │   └── legal.ts               # Datos y textos legales centralizados (Ley 24.240 y 25.326)
    ├── features/                  # Módulos organizados por dominio funcional
    │   ├── auth/                  # Inicio de sesión mediante enlace mágico
    │   ├── business/              # Panel del Negocio (Resumen, Carteles, Reportes, Canales, Equipo)
    │   │   ├── BusinessDashboard.tsx  # Métricas hoy, reseñas estimadas y carteles activos
    │   │   ├── CartelesView.tsx       # Gestión de carteles, prueba, reemplazo y papelera
    │   │   ├── CartelDetailModal.tsx  # Estadísticas horarias, dispositivos y kit QR
    │   │   ├── ReplaceCartelSheet.tsx # Reemplazo digital sin costo de cupo
    │   │   ├── ReportsView.tsx        # Resumen semanal y exportación a PDF
    │   │   ├── ChannelsView.tsx       # Métricas de WhatsApp, Instagram, Tickets
    │   │   ├── StaffView.tsx          # Desafío amigable de equipo con QR por mozo
    │   │   └── AccountView.tsx        # Configuración de cuenta y feature flags
    │   ├── manufacturer/          # Panel del Fabricante
    │   │   ├── ManufacturerDashboard.tsx # Tablero, cupos, negocios en riesgo y marca
    │   │   ├── PrintKitView.tsx          # Generador de PDF de QR y CSV para chips NFC
    │   │   ├── ResaleCalculatorView.tsx  # Calculadora de ingreso mensual recurrente
    │   │   ├── ManufacturerBillingView.tsx# Plan, cupo usado y regla de gracia de 15 días
    │   │   └── ManufacturerOnboardingWizard.tsx # Asistente de 9 pasos autoservicio
    │   └── public/                # Sitio público oficial y páginas normativas
    │       ├── LandingView.tsx        # Portada institucional con demo interactiva
    │       ├── LegalPageView.tsx      # Lector Markdown con variables dinámicas
    │       ├── ArrepentimientoView.tsx# Formulario de revocación (Ley 24.240 / Res. 424/2020)
    │       └── CookieBanner.tsx       # Aviso informativo sin bloqueo de pantalla
    └── lib/                       # Utilidades, formateadores y contextos
        ├── authContext.tsx        # Contexto de sesión y roles de usuario
        ├── themeContext.tsx       # Contexto de tema (claro/oscuro) y densidad
        ├── formatters.ts          # Formato de moneda en pesos argentinos y fechas
        └── urlValidator.ts        # Validación estricta de dominios de Google con HTTPS
```

---

## 3. Cómo conectar el backend real

La aplicación implementa el patrón **Repository / Adapter** mediante la interfaz `ToqueApi`:

1. Ambas implementaciones (`mockApi.ts` y `httpApi.ts`) satisfacen exactamente la misma firma TypeScript.
2. En `.env`, configurá:
   ```env
   VITE_API_MODE="http"
   VITE_API_BASE_URL="https://tu-api.toque.com.ar/api"
   ```
3. **No es necesario modificar ningún componente ni pantalla** del frontend; la exportación en `src/api/index.ts` conmuta automáticamente al adaptador `httpApi`.
4. El adaptador HTTP realiza peticiones fetch estándar con:
   - Encabezados `Accept: application/json` y `Content-Type: application/json`.
   - `credentials: 'same-origin'` o `include` para cookies de sesión `httpOnly`.
   - Manejo higienizado de errores de red sin exponer volcados de memoria ni detalles internos.

---

## 4. Variables de entorno

| Variable | Descripción | Valor por defecto |
| :--- | :--- | :--- |
| `APP_URL` | URL pública donde está alojada la aplicación | `http://localhost:3000` |
| `VITE_API_MODE` | Modo de la capa de datos (`mock` o `http`) | `mock` |
| `VITE_API_BASE_URL` | Prefijo para llamadas al backend REST | `/api` |

---

## 5. Auditoría de Seguridad y Accesibilidad

- **Glosario y Reglas de Marca:** Cero ocurrencias de términos prohibidos ("kini", "basta", "stand", "$3.999", "suscripción hardcodeada"). Uso exclusivo de la terminología de BLOQUE 0: *Cartel*, *Escaneo*, *Fabricante*, *Negocio*, *Toque*.
- **Cuatro estados:** Cada pantalla cuenta con estado de carga (`Skeleton`), estado vacío (`EmptyState`), estado de error con reintento (`ErrorState`) y estado de éxito con datos interactivos.
- **Sin conexión (Offline):** Detección en tiempo real mediante `navigator.onLine` y eventos `window.addEventListener('offline')` con banner informativo no bloqueante.
- **Accesibilidad AA/AAA:**
  - Contraste superior a 4.5:1 en modo claro y modo oscuro.
  - Indicador de foco visible de 2px con `--ultramar` / `--ultramar-hi`.
  - Atributos `aria-live` para contadores y notificaciones.
  - Soporte de teclado completo (`Enter` y `Espacio`) en todos los controles táctiles.
  - Soporte nativo de `prefers-reduced-motion`, `prefers-reduced-transparency` y `prefers-contrast: more`.
  - Zoom de texto al 200% sin truncamiento ni desbordes horizontales.
- **Seguridad Frontend:**
  - Cero usos de `dangerouslySetInnerHTML`.
  - Cero tokens de autenticación en `localStorage` (solo preferencias de tema y pasos de asistentes).
  - Validación de lista blanca para enlaces de reseñas: únicamente HTTPS y dominios oficiales de Google (`google.com`, `maps.app.goo.gl`, `g.page`).
  - Prohibición estricta de *review gating*.

---

## 6. Lista de tareas y siguientes pasos (Post-Beta)

1. **Integración con pasarela de cobro local:** Conectar webhooks de Mercado Pago / MODO para automatizar la facturación mensual en ARS de los planes de fabricantes al finalizar la beta pública.
2. **Registro de CNAME automático:** Integrar con Cloudflare API para verificación desatendida de dominios propios de fabricantes en el Plan Fábrica.
3. **Escritura directa WebNFC:** Para dispositivos Android con Chrome, habilitar la grabación del chip NTAG215 directamente desde el navegador mediante la API experimental `NDEFReader`.
4. **Firma legal definitiva:** Reemplazar el rótulo "Borrador — pendiente de revisión legal" en `/terminos`, `/privacidad`, `/cookies` y `/reembolso` una vez aprobados formalmente por el estudio legal de la empresa.
