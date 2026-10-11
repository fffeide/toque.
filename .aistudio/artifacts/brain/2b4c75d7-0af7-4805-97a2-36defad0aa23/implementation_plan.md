# Desacoplamiento Estricto de Paneles y Control de Acceso por Roles (RBAC)

Separar de forma definitiva las interfaces y permisos de **Negocio**, **Fabricante** y **Super Admin** en Toque, garantizando que cada usuario acceda únicamente a su panel correspondiente sin mezcla de rutas, menús cruzados ni selectores inapropiados.

### Decisiones Críticas Confirmadas

> [!IMPORTANT]
> - **Protección y Bloqueo de Rutas por Rol (RBAC)**: Si un usuario con rol de Negocio intenta entrar a `/admin` o `/fabricante`, el sistema lo redirecciona automáticamente a `/resumen`. Si un Fabricante intenta acceder a `/admin`, se lo redirige a `/fabricante`. Nadie puede ver paneles ajenos a su nivel de cuenta.
> - **Eliminación del Selector de Cambio de Rol en la Cabecera Global**: Se remueve el interruptor "Negocio / Fabricante" del header para todos los usuarios regulares y comercios. Se confina un switcher de simulación exclusivamente para la cuenta `@pruebas` dentro de una pestaña protegida en el panel Super Admin (`/admin`).
> - **Redirección de Inicio de Sesión Inteligente**: Al iniciar sesión o entrar a la app, cada usuario es enviado directamente a su destino canónico:
>   - `platform_admin` (Dueño/Admin) → `/admin`
>   - `manufacturer_admin` (Taller/Fabricante) → `/fabricante`
>   - `business_owner` / `business_staff` (Comercio/Café) → `/resumen`
> - **Menú Lateral y Mobile Dock Exclusivos**: Los íconos y accesos rápidos de la barra lateral y dock móvil solo mostrarán los módulos que corresponden al rol activo (un negocio nunca verá íconos de fabricante ni de admin; un fabricante nunca verá la navegación de café).

---

## 1. Visión General del Sistema y Arquitectura de Acceso

El sistema contará con un componente guardián (`RoleProtectedRoute`) que evalúa el estado del usuario autenticado antes de renderizar cualquier vista. Si el usuario no tiene la sesión requerida o su rol no coincide con el panel solicitado, es redirigido a su espacio canónico.

```
                  ┌─────────────────────────────────────┐
                  │          Usuario Autenticado        │
                  │   (email, role, tenantId, type)     │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   [platform_admin]        [manufacturer_admin]         [business_owner]
           │                         │                         │
 ┌─────────┴─────────┐     ┌─────────┴─────────┐     ┌─────────┴─────────┐
 │   Ruta: /admin    │     │ Ruta: /fabricante │     │  Ruta: /resumen   │
 │   Panel Toque     │     │  Panel Producción │     │  /carteles        │
 │   • Métricas Red  │     │  • Mis Comercios  │     │  /reportes        │
 │   • Recaudación   │     │  • Kit Impresión  │     │  /equipo          │
 │   • Salud Sistema │     │  • Marca Blanca   │     │  /cuenta          │
 │   • Sandbox QA    │     │  • Chips NTAG215  │     │  (Solo su local)  │
 │     (@pruebas)    │     └───────────────────┘     └───────────────────┘
 └───────────────────┘
```

---

## 2. Experiencia de Usuario y Separación de Interfaz

### A. Panel de Negocio (`/resumen`, `/carteles`, `/canales`, `/reportes`, `/equipo`, `/cuenta`)
- **Público**: Dueños de cafeterías, bares, restaurantes y locales comerciales.
- **Navegación Lateral**:
  - Resumen del Salón (Toques hoy, curva de horas, alertas).
  - Mis Carteles (Gestión de carteles de mesa, cambiar link de QR, cómo escanear).
  - Canales de Escaneo (Próximamente: WhatsApp, Instagram, ticket).
  - Reportes (Informe mensual imprimible en PDF con métricas limpias).
  - Equipo (Código individual por empleado y reto del mes ético).
  - Mi Cuenta (Datos del negocio y WhatsApp de su fabricante asignado).
- **Aislamiento**: Ninguna mención o acceso a listas de otros clientes, cotizadores de imprenta ni recaudación de plataforma.

### B. Panel del Fabricante (`/fabricante`)
- **Público**: Imprentas, grabadores láser y talleres de cartelería acrílica.
- **Navegación Lateral y Pestañas**:
  - Tablero de Taller (Capacidad activa de carteles, comercios asociados).
  - Mis Comercios (Directorio de clientes, comercios sin toques, WhatsApp directo).
  - Kit de Impresión (Descarga de CSV para chips NFC y plantillas QR a escala).
  - Marca Blanca y Dominio (Personalización del logo que ven sus clientes).
  - Pedidos de Reposición (Reposiciones de acrílicos rotos o extraviados).
  - Plan de Fabricación (Arranque / Taller / Fábrica con SSO).
- **Aislamiento**: No ve las pantallas de salón de un café específico; interactúa a nivel B2B de producción.

### C. Panel Super Admin de Toque (`/admin`)
- **Público**: Dueños y equipo fundador de Toque SaaS.
- **Navegación**:
  - Visión de Red y Métricas Totales (Escaneos globales, ratio NFC/QR).
  - Recaudación y Suscripciones (MRR, ARR en pesos argentinos).
  - Directorio Maestro de Fabricantes y Comercios.
  - Enlaces a Monitor de Estado en Vivo (`/status`) y Galería de Diseño (`/ui`).
  - **Sandbox Exclusivo para `@pruebas`**: Solo visible si el usuario logueado es `@pruebas`, permitiendo auditar la experiencia de cada rol para control de calidad.

---

## 3. Plan de Ejecución Técnico

1. **Crear `RoleProtectedRoute.tsx`**:
   - Componente envoltorio que valida `isAuthenticated` y contrasta `user.role` con una lista de roles permitidos (`allowedRoles`).
   - Redirección automática inmediata al destino canónico según el rol del usuario si intenta ingresar a una ruta indebida.

2. **Reestructurar las Rutas en `App.tsx`**:
   - Desagrupar el layout genérico único. Crear sub-árboles de rutas protegidas:
     - Rama `/admin/*` protegida exclusivamente para `platform_admin`.
     - Rama `/fabricante/*` protegida exclusivamente para `manufacturer_admin`.
     - Rama `/resumen`, `/carteles`, `/canales`, `/reportes`, `/equipo`, `/cuenta` protegida para `business_owner` y `business_staff`.
   - Crear una ruta `/dashboard` o resolver la redirección en `/` y `/login` para dirigir a cada perfil a su URL correspondiente sin mezclas.

3. **Limpiar `AppLayout.tsx`**:
   - Eliminar el banner superior de "Cambiar vista: Negocio / Fabricante" del layout general.
   - Renderizar en la barra lateral (`aside`) y en el dock móvil (`nav`) **únicamente** los enlaces permitidos para el rol activo.
   - Si un usuario es de Negocio, la barra lateral no renderiza íconos de Fabricante ni de Admin.

4. **Actualizar el Flujo de Login en `LoginView.tsx`**:
   - Tras iniciar sesión (sea por email directo, credenciales `@pruebas`, OAuth o SSO), el usuario es redirigido a su panel específico:
     - `platform_admin` → `/admin`
     - `manufacturer_admin` → `/fabricante`
     - `business_owner` → `/resumen`

5. **Sandbox de QA Confinado en `AdminDashboard.tsx`**:
   - La opción de simular y conmutar roles se mantiene disponible exclusivamente dentro del panel Admin cuando el usuario es `@pruebas`, sin invadir la navegación principal del resto de los usuarios.

6. **Verificación y Compilación**:
   - Ejecutar `lint_applet` y `compile_applet` para confirmar la integridad de tipos de TypeScript y validar que no existan advertencias ni rupturas en la navegación.
