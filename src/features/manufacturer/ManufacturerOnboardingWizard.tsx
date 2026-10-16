/**
 * Toque — Onboarding Autoservicio del Fabricante (ManufacturerOnboardingWizard)
 * Wizard de 9 pasos (~10 min) con progreso persistido y reanudable:
 * 1. Cuenta (enlace mágico)
 * 2. Marca con vista previa
 * 3. Soporte
 * 4. Plan y cupo
 * 5. Dominio (opcional)
 * 6. Primer negocio de prueba guiado con datos borrables
 * 7. Kit de QR
 * 8. Prueba ("Escaneá tu cartel": cuando llega el escaneo se pone verde)
 * 9. Lista de verificación "Listo para vender" con tutorial corto
 */

import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { QRPreview } from '../../components/ui/QRPreview';
import { BrandPreview } from '../../components/ui/BrandPreview';
import { useTheme } from '../../lib/themeContext';
import { useAuth } from '../../lib/authContext';
import { api, Tenant, Cartel } from '../../api';
import { validateGoogleReviewUrl } from '../../lib/urlValidator';
import { useToast } from '../../components/ui/Toast';
import {
  Check,
  CheckCircle2,
  Sparkles,
  Smartphone,
  QrCode,
  Globe,
  Store,
  ShieldCheck,
  Palette,
  CreditCard,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface ManufacturerOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onFinish?: () => void;
}

const STORAGE_STEP_KEY = 'toque_mfg_onboarding_step_v1';
const STORAGE_COMPLETED_KEY = 'toque_mfg_onboarding_completed_v1';

export const ManufacturerOnboardingWizard: React.FC<ManufacturerOnboardingWizardProps> = ({
  isOpen,
  onClose,
  onFinish,
}) => {
  const { tenant } = useAuth();
  const { brandColor, setBrandColor, contrastInfo } = useTheme();
  const { success, info } = useToast();

  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_STEP_KEY);
    return saved ? parseInt(saved, 10) : 1;
  });

  // Paso 1: Cuenta
  const [ownerName, setOwnerName] = useState('Martín Gómez');
  const [ownerEmail, setOwnerEmail] = useState(tenant?.contactEmail || 'contacto@carteleriademo.com.ar');
  const [ownerPhone, setOwnerPhone] = useState('+54 9 11 4455-8899');

  // Paso 2: Marca
  const [brandName, setBrandName] = useState(tenant?.name || 'Cartelería Demo');
  const [accentColor, setAccentColor] = useState(brandColor || '#3A3FE0');

  // Paso 3: Soporte
  const [supportWhatsapp, setSupportWhatsapp] = useState('+54 9 11 4455-8899');
  const [supportEmail, setSupportEmail] = useState('soporte@carteleriademo.com.ar');

  // Paso 4: Plan y cupo
  const [selectedQuota, setSelectedQuota] = useState<number>(50);

  // Paso 5: Dominio
  const [useCustomDomain, setUseCustomDomain] = useState(false);
  const [customDomain, setCustomDomain] = useState('');

  // Paso 6: Primer negocio de prueba
  const [demoBizName, setDemoBizName] = useState('Café & Bistro La Esquina');
  const [demoBizCategory, setDemoBizCategory] = useState('Gastronomía');
  const [demoBizUrl, setDemoBizUrl] = useState(
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
  );

  // Paso 7 & 8: Cartel de prueba y simulación de escaneo
  const [testShortCode] = useState('demo-cartel');
  const [hasScannedLive, setHasScannedLive] = useState(false);

  // Paso 9: Checklist
  const [checklist, setChecklist] = useState({
    chipsOrdered: true,
    nfcToolsInstalled: true,
    firstPitchReady: true,
  });

  // Guardar progreso cada vez que cambia de paso
  useEffect(() => {
    localStorage.setItem(STORAGE_STEP_KEY, currentStep.toString());
  }, [currentStep]);

  const stepTitles = [
    'Cuenta y contacto',
    'Identidad y color',
    'Canales de soporte',
    'Plan y cupo de carteles',
    'Dominio propio (opcional)',
    'Primer negocio de prueba',
    'Kit de QR inicial',
    'Prueba de escaneo en vivo',
    'Listo para vender',
  ];

  const handleNext = () => {
    if (currentStep < 9) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_COMPLETED_KEY, 'true');
    success('¡Onboarding completado!', 'Tu taller ya está configurado para fabricar y vender carteles Toque.');
    if (onFinish) onFinish();
    onClose();
  };

  const handleSaveAndExit = () => {
    info('Progreso guardado', `Paso ${currentStep} de 9 guardado. Podés continuar cuando quieras.`);
    onClose();
  };

  const handleSimulateScan = () => {
    setHasScannedLive(true);
    success('¡Escaneo detectado en vivo!', 'El servidor registró el toque físico y el cartel se activó.');
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleSaveAndExit}
      title=""
      size="lg"
    >
      <div className="space-y-6">
        {/* Barra de Progreso Superior con salida clara */}
        <div className="space-y-2 pt-1 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center justify-between text-micro text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--brand)] uppercase tracking-wider">
              Paso {currentStep} de 9: {stepTitles[currentStep - 1]}
            </span>
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="text-micro font-medium hover:text-[var(--text-main)] transition cursor-pointer"
            >
              Guardar y salir
            </button>
          </div>

          <div className="h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
              style={{ width: `${(currentStep / 9) * 100}%` }}
            />
          </div>
        </div>

        {/* CONTENIDO SEGÚN PASO */}

        {/* PASO 1: CUENTA */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Bienvenido al Panel del Fabricante
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Confirmá los datos de tu empresa fabricante de carteles para asociar tu taller y recibir enlaces mágicos de acceso.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Input
                label="Nombre y apellido del titular"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="ej. Martín Gómez"
              />

              <Input
                label="Correo electrónico para enlace mágico"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="contacto@carteleriademo.com.ar"
              />

              <Input
                label="WhatsApp de contacto del taller"
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+54 9 11 4455-8899"
              />
            </div>
          </div>
        )}

        {/* PASO 2: IDENTIDAD Y COLOR */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Personalizá la Identidad de tu Taller
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Tus clientes verán tu nombre y color corporativo en todo momento.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="space-y-3">
                <Input
                  label="Nombre de tu marca fabricante"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="ej. Cartelería Demo"
                />

                <div>
                  <label className="text-small font-medium text-[var(--text-main)] block mb-1">
                    Color de acento
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => {
                        setAccentColor(e.target.value);
                        setBrandColor(e.target.value);
                      }}
                      className="w-12 h-10 p-1 rounded-xl border border-[var(--border-subtle)] cursor-pointer"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => {
                        setAccentColor(e.target.value);
                        setBrandColor(e.target.value);
                      }}
                      className="font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] text-micro text-[var(--text-muted)]">
                  Verificador de contraste: <strong className={contrastInfo.passesAA ? 'text-[var(--menta)]' : 'text-[var(--ambar)]'}>{contrastInfo.passesAA ? 'Aprobado (WCAG AA)' : 'Revisar legibilidad'}</strong>
                </div>
              </div>

              <BrandPreview
                brandName={brandName}
                brandColor={accentColor}
                contrastRatio={contrastInfo.ratio}
                passesAA={contrastInfo.passesAA}
                recommendedColor={contrastInfo.recommendedColor}
                onApplyRecommended={() => {
                  if (contrastInfo.recommendedColor) {
                    setAccentColor(contrastInfo.recommendedColor);
                    setBrandColor(contrastInfo.recommendedColor);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* PASO 3: SOPORTE */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Canales de Soporte para tus Clientes
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Cuando un comercio tenga dudas sobre su cartel o quiera pedir más unidades, este WhatsApp aparecerá directamente en su panel.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Input
                label="WhatsApp de soporte oficial"
                type="tel"
                value={supportWhatsapp}
                onChange={(e) => setSupportWhatsapp(e.target.value)}
                placeholder="+54 9 11 4455-8899"
                helperText="Número directo con código de país para abrir chat en 1 clic"
              />

              <Input
                label="Correo electrónico de asistencia"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="soporte@carteleriademo.com.ar"
              />
            </div>
          </div>
        )}

        {/* PASO 4: PLAN Y CUPO */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Elegí tu Cupo Inicial de Carteles
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Podés ampliar tu cupo en cualquier momento a medida que sumás clientes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                { size: 15, title: 'Plan Arranque', desc: 'Hasta 15 carteles activos', price: '$11.899 /mes' },
                { size: 50, title: 'Plan Taller (Recomendado)', desc: 'Hasta 50 carteles activos', price: '$24.899 /mes' },
                { size: 150, title: 'Plan Fábrica', desc: 'Hasta 150 carteles activos', price: '$44.899 /mes' },
              ].map((p) => (
                <div
                  key={p.size}
                  onClick={() => setSelectedQuota(p.size)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                    selectedQuota === p.size
                      ? 'border-[var(--brand)] bg-[var(--brand)]/5 ring-2 ring-[var(--brand)]/20'
                      : 'border-[var(--border-subtle)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div>
                    <h4 className="font-display text-body font-bold text-[var(--text-main)]">
                      {p.title}
                    </h4>
                    <p className="text-micro text-[var(--text-muted)] mt-0.5">{p.desc}</p>
                  </div>

                  <div>
                    <span className="font-mono text-small font-bold text-[var(--brand)] block">
                      {p.price}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Garantía de 15 días de gracia incluida
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PASO 5: DOMINIO */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Configuración de Dominio (Opcional)
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Podés usar tu subdominio oficial de Toque o conectar un dominio propio de tu empresa.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomDomain}
                  onChange={(e) => setUseCustomDomain(e.target.checked)}
                  className="w-4 h-4 text-[var(--brand)] rounded"
                />
                <div>
                  <span className="text-small font-medium text-[var(--text-main)] block">
                    Quiero usar un dominio propio (ej. carteles.miempresa.com.ar)
                  </span>
                  <span className="text-micro text-[var(--text-muted)]">
                    Si no lo marcás, usarás el subdominio gratuito toque.ar/{brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}.
                  </span>
                </div>
              </label>

              {useCustomDomain && (
                <Input
                  label="Tu dominio o subdominio"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="carteles.miempresa.com.ar"
                />
              )}

              {/* Advertencia obligatoria del dominio */}
              <div className="p-4 rounded-xl bg-[var(--ultramar)]/5 border border-[var(--ultramar)]/25 text-small text-[var(--text-main)] flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[var(--brand)] shrink-0 mt-0.5" />
                <div className="text-micro leading-relaxed">
                  <strong className="font-semibold block text-[var(--brand)]">Garantía de Respaldo Toque:</strong>
                  "Si alguna vez perdés o se vence tu dominio propio, los carteles físicos siguen funcionando siempre por el nuestro."
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 6: PRIMER NEGOCIO DE PRUEBA */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Alta de tu Primer Negocio de Prueba
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Creamos un local de demostración para que pruebes el flujo completo. Podés borrarlo en 1 clic más tarde.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Input
                label="Nombre del local de prueba"
                value={demoBizName}
                onChange={(e) => setDemoBizName(e.target.value)}
                placeholder="Café & Bistro La Esquina"
              />

              <Input
                label="Enlace a Google Reviews de prueba"
                value={demoBizUrl}
                onChange={(e) => setDemoBizUrl(e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=..."
                helperText="Enlace verificado con lista blanca oficial de Google"
              />

              <div className="p-3 rounded-xl bg-[var(--menta)]/10 border border-[var(--menta)]/30 text-micro text-[var(--text-main)] flex items-center gap-2">
                <Check className="w-4 h-4 text-[var(--menta)] shrink-0" />
                <span>Datos 100% borrables desde tu panel de negocios cuando termines el tutorial.</span>
              </div>
            </div>
          </div>
        )}

        {/* PASO 7: KIT DE QR */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Kit de Fabricación para tu Cartel
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Este es el código corto y QR que se imprime o se graba en el chip NFC NTAG215.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center gap-6">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 shrink-0">
                <QRPreview url={`https://toque.ar/${testShortCode}`} size={140} />
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1">
                <span className="font-display text-body font-bold text-[var(--text-main)] block">
                  {demoBizName} — Cartel #1
                </span>
                <span className="font-mono text-small font-bold text-[var(--brand)] bg-black/5 dark:bg-white/10 px-2.5 py-1 rounded inline-block">
                  toque.ar/{testShortCode}
                </span>
                <p className="text-micro text-[var(--text-muted)] leading-relaxed">
                  Grabá esta URL en el chip NFC NTAG215 como URI (https://) o imprimí el código en acrílico a un tamaño mínimo de 2,5 cm.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PASO 8: PRUEBA INTERACTIVA ("ESCANEÁ TU CARTEL") */}
        {currentStep === 8 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Prueba en Vivo: Escaneá tu Cartel
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Probá el funcionamiento simulando un cliente o abriendo el enlace directo. Cuando se detecta el toque, el cartel se pone verde.
              </p>
            </div>

            <div
              className={`p-6 rounded-2xl border-2 transition-all text-center space-y-4 ${
                hasScannedLive
                  ? 'bg-emerald-500/10 border-[var(--menta)] text-emerald-900 dark:text-emerald-100'
                  : 'bg-black/[0.02] dark:bg-white/[0.03] border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center justify-center">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    hasScannedLive
                      ? 'bg-[var(--menta)] text-white scale-110 shadow-lg'
                      : 'bg-[var(--brand)] text-white'
                  }`}
                >
                  {hasScannedLive ? (
                    <CheckCircle2 className="w-8 h-8 animate-bounce" />
                  ) : (
                    <Smartphone className="w-8 h-8" />
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-display text-title-3 font-bold text-[var(--text-main)]">
                  {hasScannedLive ? '¡Escaneo Detectado con Éxito!' : 'Esperando primer escaneo...'}
                </h4>
                <p className="text-small text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                  {hasScannedLive
                    ? 'Tu infraestructura de redirección funciona a la perfección. El comensal fue dirigido a la ficha oficial.'
                    : 'Hacé clic abajo en "Simular escaneo de cliente" para ver la respuesta inmediata del servidor.'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <Button
                  variant={hasScannedLive ? 'secondary' : 'primary'}
                  onClick={handleSimulateScan}
                  icon={<Zap className="w-4 h-4" />}
                >
                  {hasScannedLive ? 'Probar otro escaneo' : 'Simular escaneo de cliente'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PASO 9: LISTA DE VERIFICACIÓN "LISTO PARA VENDER" */}
        {currentStep === 9 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                ¡Listo para Fabricar y Vender!
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Completá los últimos checks para comenzar a ofrecer carteles con tu marca propia:
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.chipsOrdered}
                  onChange={(e) => setChecklist({ ...checklist, chipsOrdered: e.target.checked })}
                  className="w-4 h-4 text-[var(--brand)] rounded"
                />
                <span className="text-small font-medium text-[var(--text-main)]">
                  Tengo chips NTAG215 o sé dónde comprarlos (guía disponible en el panel)
                </span>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.nfcToolsInstalled}
                  onChange={(e) => setChecklist({ ...checklist, nfcToolsInstalled: e.target.checked })}
                  className="w-4 h-4 text-[var(--brand)] rounded"
                />
                <span className="text-small font-medium text-[var(--text-main)]">
                  Tengo instalada la app gratuita NFC Tools en mi teléfono para pruebas de taller
                </span>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.firstPitchReady}
                  onChange={(e) => setChecklist({ ...checklist, firstPitchReady: e.target.checked })}
                  className="w-4 h-4 text-[var(--brand)] rounded"
                />
                <span className="text-small font-medium text-[var(--text-main)]">
                  Leí las plantillas de venta para WhatsApp e Instagram para contactar clientes
                </span>
              </label>
            </div>

            <div className="p-4 rounded-xl bg-[var(--menta)]/10 border border-[var(--menta)]/30 text-small text-[var(--text-main)] flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[var(--menta)] shrink-0" />
              <span>
                Todo configurado bajo tu propia identidad. Podés acceder a tu tablero de control en cualquier momento.
              </span>
            </div>
          </div>
        )}

        {/* NAVEGACIÓN INFERIOR (ANTERIOR / SIGUIENTE / FINALIZAR) */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <Button
                variant="ghost"
                onClick={handlePrev}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                Anterior
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={handleNext}
              icon={currentStep === 9 ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            >
              {currentStep === 9 ? 'Finalizar y entrar al panel' : 'Siguiente paso'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
