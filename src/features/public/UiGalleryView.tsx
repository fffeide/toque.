/**
 * Toque — Galería de Componentes UI (/ui)
 * Muestra todos los componentes del sistema de diseño en claro y oscuro para verificación visual.
 */

import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Input,
  Select,
  Switch,
  SegmentedControl,
  Tabs,
  Card,
  Stat,
  Badge,
  Sheet,
  Dialog,
  Popover,
  Skeleton,
  EmptyState,
  ErrorState,
  Tooltip,
  Avatar,
  BrandLogo,
  BarChart,
  Sparkline,
  QRPreview,
  CopyField,
  StepperWizard,
  Table,
  FilterBar,
  ThemeToggle,
  BrandPreview,
  useToast,
} from '../../components/ui';
import {
  Smartphone,
  QrCode,
  Sparkles,
  Layers,
  Heart,
  Share2,
  Trash2,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useTheme } from '../../lib/themeContext';

export const UiGalleryView: React.FC = () => {
  const { toast, success, warning, error: toastError } = useToast();
  const { brandColor, contrastInfo } = useTheme();

  const [inputVal, setInputVal] = useState('Texto de ejemplo');
  const [selectVal, setSelectVal] = useState('1');
  const [switchVal, setSwitchVal] = useState(true);
  const [segmentedVal, setSegmentedVal] = useState<'dia' | 'mes' | 'año'>('mes');
  const [tabVal, setTabVal] = useState('t1');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(1);

  const sampleChartData = [
    { label: 'Lun', nfc: 14, qr: 8 },
    { label: 'Mar', nfc: 18, qr: 11 },
    { label: 'Mié', nfc: 15, qr: 9 },
    { label: 'Jue', nfc: 22, qr: 14 },
    { label: 'Vie', nfc: 34, qr: 24 },
    { label: 'Sáb', nfc: 41, qr: 28 },
    { label: 'Dom', nfc: 38, qr: 25 },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-6 pb-20">
      {/* Cabecera de la Galería */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <span className="text-micro font-bold text-[var(--brand)] uppercase tracking-wider">
            Sistema de Diseño Toque
          </span>
          <h1 className="font-display text-title-1 font-bold text-[var(--text-main)] mt-1">
            Galería de Componentes UI (/ui)
          </h1>
          <p className="text-small text-[var(--text-muted)] mt-1">
            Liquid glass con disciplina, respuesta táctil inmediata, y accesibilidad AA garantizada.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>

      {/* 1. Tipografía y Jerarquía */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          1. Escala Tipográfica (Sora + Inter + JetBrains Mono)
        </h2>
        <Card className="space-y-3">
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Hero (2.75rem / Sora 700 / −0.025em tracking):</span>
            <div className="text-hero text-[var(--text-main)]">Tu cartel, con datos.</div>
          </div>
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Título 1 (2rem / Sora 600 / −0.02em):</span>
            <div className="text-title-1 text-[var(--text-main)]">Mirá cómo va tu negocio</div>
          </div>
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Título 2 (1.5rem / Sora 600):</span>
            <div className="text-title-2 text-[var(--text-main)]">Vendé el cartel. Quedate con el cliente.</div>
          </div>
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Cuerpo (1rem / Inter 400 / line-height 1.5):</span>
            <p className="text-body text-[var(--text-main)]">
              Toque es una plataforma SaaS para negocios que venden o usan carteles con NFC y QR que llevan directo a la página de reseñas de Google.
            </p>
          </div>
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Cifras y Códigos de Cartel (JetBrains Mono 500):</span>
            <span className="text-code text-[var(--brand)] font-bold text-base">k7m2p • toque.ar/k7m2p</span>
          </div>
        </Card>
      </section>

      {/* 2. Botones y Microinteracciones */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          2. Botones e Interacción Inmediata (:active scale 0.97)
        </h2>
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" leftIcon={<Smartphone className="w-4 h-4" />}>
              Primario (44px)
            </Button>
            <Button variant="secondary" leftIcon={<QrCode className="w-4 h-4" />}>
              Secundario
            </Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger" leftIcon={<Trash2 className="w-4 h-4" />}>
              Peligro
            </Button>
            <Button variant="primary" isLoading>
              Cargando
            </Button>
            <Button variant="primary" disabled>
              Deshabilitado
            </Button>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <IconButton aria-label="Favorito" variant="primary">
              <Heart className="w-4 h-4" />
            </IconButton>
            <IconButton aria-label="Compartir" variant="secondary">
              <Share2 className="w-4 h-4" />
            </IconButton>
            <IconButton aria-label="Vidrio" variant="glass">
              <Sparkles className="w-4 h-4 text-[var(--estrella)]" />
            </IconButton>
            <span className="text-micro text-[var(--text-muted)]">
              ← IconButtons con aria-label obligatorio y área táctil de 44px
            </span>
          </div>
        </Card>
      </section>

      {/* 3. Formularios y Entradas */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          3. Campos de Formulario y Validación en Línea
        </h2>
        <Card className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Campo regular"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            helperText="Texto auxiliar orientativo."
          />
          <Input
            label="Campo con error en línea"
            value="http://inseguro.com"
            error="El enlace debe comenzar con https:// por seguridad."
          />
          <Select
            label="Selector desplegable"
            value={selectVal}
            onChange={e => setSelectVal(e.target.value)}
            options={[
              { value: '1', label: 'Mesa 1 — Salón Principal' },
              { value: '2', label: 'Mesa 2 — Terraza' },
              { value: '3', label: 'Mostrador de Caja' },
            ]}
          />
          <CopyField
            label="Campo con botón de copiado rápido"
            value="https://toque.ar/k7m2p"
          />
        </Card>
      </section>

      {/* 4. Interruptores, Controles Segmentados y Pestañas */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          4. Interruptores, Segmentados y Pestañas
        </h2>
        <Card className="space-y-6">
          <Switch
            checked={switchVal}
            onChange={setSwitchVal}
            label="Recepción de escaneos NFC activa"
            description="Permite que los celulares toquen el cartel y abran Google Maps."
          />

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-small font-medium text-[var(--text-main)] block">
                Control Segmentado Fluido
              </span>
              <span className="text-micro text-[var(--text-muted)]">
                Pastilla con animación spring crítica.
              </span>
            </div>
            <SegmentedControl
              value={segmentedVal}
              onChange={setSegmentedVal}
              options={[
                { value: 'dia', label: 'Por Día' },
                { value: 'mes', label: 'Por Mes' },
                { value: 'año', label: 'Por Año' },
              ]}
            />
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)]">
            <Tabs
              activeId={tabVal}
              onChange={setTabVal}
              tabs={[
                { id: 't1', label: 'Métricas en tiempo real', badge: 12 },
                { id: 't2', label: 'Carteles en servicio', badge: 6 },
                { id: 't3', label: 'Historial de visitas' },
              ]}
            />
          </div>
        </Card>
      </section>

      {/* 5. Jerarquía de Materiales y Niveles de Elevación */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          5. Niveles de Materiales y Superficies
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="solid">
            <span className="text-micro font-bold text-blue-400 block mb-1">Nivel 1: Escenario</span>
            <h4 className="font-display text-small font-semibold">Fondo Atmosférico</h4>
            <p className="text-micro text-[var(--text-muted)] mt-1">
              Base global oscura (#04121b) con gradiente sutil. Da profundidad a toda la app.
            </p>
          </Card>

          <Card variant="solid">
            <span className="text-micro font-bold text-[var(--brand-hi)] block mb-1">Nivel 2: Paneles</span>
            <h4 className="font-display text-small font-semibold">Tarjetas de Contenido</h4>
            <p className="text-micro text-[var(--text-muted)] mt-1">
              Superficies satinadas para métricas, listas y carteles. Máxima legibilidad.
            </p>
          </Card>

          <Card variant="subtle">
            <span className="text-micro font-bold text-amber-300 block mb-1">Nivel 2B: Sub-bloques</span>
            <h4 className="font-display text-small font-semibold">Divisiones Internas</h4>
            <p className="text-micro text-[var(--text-muted)] mt-1">
              Bloques contenidos dentro de tarjetas (códigos, filtros, inputs). No se usa para pop-ups.
            </p>
          </Card>

          <Card className="bg-[rgba(10,20,38,0.98)] border border-white/20 shadow-xl">
            <span className="text-micro font-bold text-emerald-300 block mb-1">Nivel 3: Pop-ups & Sheets</span>
            <h4 className="font-display text-small font-semibold">Modales y Hojas Flotantes</h4>
            <p className="text-micro text-[var(--text-muted)] mt-1">
              Superficie opaca de alto contraste con blur. Evita que el fondo se transparente.
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Total de escaneos"
            value="1.450"
            subtext="Últimos 30 días"
            icon={<Smartphone className="w-5 h-5 text-[var(--brand)]" />}
            trend={{ value: '+18%', isPositive: true }}
          />
          <Stat
            label="Reseñas potenciales"
            value="406"
            subtext="Estimación fundamentada"
            explanation="Calculado con la tasa de conversión promedio de 28% al abrir el perfil de Google."
            icon={<Sparkles className="w-5 h-5 text-[var(--estrella)]" />}
          />
          <Stat
            label="Tendencia semanal"
            value="+24%"
            subtext="Más concurrencia viernes"
            icon={<Sparkline data={[12, 15, 19, 14, 28, 35, 42]} />}
          />
          <Stat
            label="Carteles activos"
            value="6"
            subtext="Todos operativos"
            icon={<Layers className="w-5 h-5 text-[var(--menta)]" />}
          />
        </div>
      </section>

      {/* 6. Insignias / Chips con Ícono Obligatorio */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          6. Insignias de Estado (Accesibilidad: Ícono + Texto)
        </h2>
        <Card className="flex flex-wrap items-center gap-3">
          <Badge variant="success">Cartel Activo</Badge>
          <Badge variant="warning">Atención / Sin escaneos</Badge>
          <Badge variant="error">Enlace roto</Badge>
          <Badge variant="info">Toque NFC</Badge>
          <Badge variant="neutral">En papelera</Badge>
        </Card>
      </section>

      {/* 7. Gráfico Accesible con Alternativa en Tabla */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          7. Gráficos Accesibles (NFC en ultramar, QR en estrella, Tabla alternativa)
        </h2>
        <Card>
          <BarChart
            title="Comparativa Semanal NFC vs QR"
            data={sampleChartData}
          />
        </Card>
      </section>

      {/* 8. Avisos Toasts y Notificaciones con aria-live */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          8. Sistema de Notificaciones Toast (con aria-live)
        </h2>
        <Card className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => success('¡Tu cartel ya está trabajando!', 'Registró su primer escaneo de cliente.')}
          >
            Lanzar éxito (celebración)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => warning('Cartel sin movimiento', 'No registró toques en los últimos 7 días.')}
          >
            Lanzar advertencia
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toastError('Enlace no disponible', 'Verificá tu URL de Google Maps.')}
          >
            Lanzar error
          </Button>
        </Card>
      </section>

      {/* 9. Modales, Hojas Arrastrables y Asistentes */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          9. Modales y Hoja Arrastrable con Proyección de Impulso
        </h2>
        <Card className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => setIsSheetOpen(true)}>
              Abrir Hoja Inferior (Sheet)
            </Button>
            <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
              Abrir Diálogo Modal
            </Button>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <span className="text-small font-medium text-[var(--text-main)] block mb-2">
              Asistente de Pasos (StepperWizard)
            </span>
            <StepperWizard
              currentStepIndex={stepIndex}
              steps={[
                { id: '1', title: 'Datos del cartel' },
                { id: '2', title: 'Enlace Google' },
                { id: '3', title: 'Impresión QR' },
              ]}
            />
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="secondary"
                disabled={stepIndex <= 0}
                onClick={() => setStepIndex(stepIndex - 1)}
              >
                Paso anterior
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={stepIndex >= 2}
                onClick={() => setStepIndex(stepIndex + 1)}
              >
                Paso siguiente
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* 10. Vista Previa de Código QR */}
      <section className="space-y-4">
        <h2 className="font-display text-title-2 font-semibold text-[var(--text-main)]">
          10. Generación y Descarga de Código QR
        </h2>
        <div className="max-w-xs">
          <QRPreview
            url="https://toque.ar/k7m2p"
            shortCode="k7m2p"
            cartelName="Mesa 4 — Salón Principal"
            size={180}
          />
        </div>
      </section>

      {/* Hoja Inferior Demo */}
      <Sheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Hoja Arrastrable de Ejemplo"
        description="Arrastrala hacia abajo con el dedo o mouse. Soltala con envión para probar la proyección de impulso."
      >
        <div className="space-y-4 text-small">
          <p>
            Esta hoja implementa la física especificada en el bloque 6.5:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-micro text-[var(--text-muted)]">
            <li>Seguimiento 1:1 del puntero con Pointer Capture.</li>
            <li>Resistencia progresiva elástica hacia arriba (rubber-band).</li>
            <li>Proyección de velocidad al soltar según la fórmula física de fricción.</li>
            <li>Cierre por signo de velocidad hacia abajo.</li>
          </ul>
          <div className="pt-4">
            <Button variant="primary" onClick={() => setIsSheetOpen(false)} className="w-full">
              Entendido
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Diálogo Demo */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Diálogo de Confirmación"
        description="Los diálogos en Toque se reservan únicamente para acciones críticas e irreversibles."
      >
        <div className="flex justify-end gap-2.5 pt-4">
          <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
            Cerrar
          </Button>
          <Button variant="primary" onClick={() => setIsDialogOpen(false)}>
            Aceptar
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
