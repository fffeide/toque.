/**
 * Toque — Onboarding del Negocio (BusinessOnboardingModal)
 * Flujo guiado de 4 pasos (~2 min) respetando la marca blanca del fabricante:
 * 1. Bienvenida con el logo y nombre del fabricante
 * 2. Confirmar datos del negocio
 * 3. Probar el link oficial de reseñas en Google
 * 4. Elegir canal y frecuencia del reporte semanal
 * Finalización con celebración sobria.
 */

import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StepperWizard } from '../../components/ui/StepperWizard';
import { BrandLogo } from '../../components/ui/Avatar';
import { validateGoogleReviewUrl } from '../../lib/urlValidator';
import { Tenant } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import {
  Building2,
  ExternalLink,
  Mail,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface BusinessOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  onComplete?: () => void;
}

export const BusinessOnboardingModal: React.FC<BusinessOnboardingModalProps> = ({
  isOpen,
  onClose,
  tenant,
  onComplete,
}) => {
  const { success } = useToast();
  const [currentStep, setCurrentStep] = useState(0);

  // Paso 2: Datos
  const [bizName, setBizName] = useState(tenant?.name || 'Café de la Esquina');
  const [bizAddress, setBizAddress] = useState('Av. Corrientes 1540, CABA');
  const [bizCategory, setBizCategory] = useState('Cafetería y Restaurante');

  // Paso 3: Link de reseñas
  const [reviewUrl, setReviewUrl] = useState(
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
  );
  const [hasTestedLink, setHasTestedLink] = useState(false);
  const [urlValidation, setUrlValidation] = useState(() =>
    validateGoogleReviewUrl(reviewUrl)
  );

  // Paso 4: Reportes
  const [reportChannel, setReportChannel] = useState<'email' | 'whatsapp' | 'both'>('both');
  const [reportDay, setReportDay] = useState<'monday' | 'friday'>('monday');
  const [reportEmail, setReportEmail] = useState(tenant?.contactEmail || 'contacto@cafedelaesquina.ar');
  const [reportPhone, setReportPhone] = useState('+54 9 11 4455-8899');

  const steps = [
    { id: 'welcome', title: 'Bienvenida', description: 'Presentación del fabricante' },
    { id: 'data', title: 'Datos', description: 'Información del local' },
    { id: 'link', title: 'Probar link', description: 'Enlace a Google Reviews' },
    { id: 'reports', title: 'Reportes', description: 'Canal de avisos' },
  ];

  const handleUrlChange = (value: string) => {
    setReviewUrl(value);
    setUrlValidation(validateGoogleReviewUrl(value));
    setHasTestedLink(false);
  };

  const handleTestReviewLink = () => {
    if (urlValidation.isValid) {
      window.open(reviewUrl, '_blank', 'noopener,noreferrer');
      setHasTestedLink(true);
      success('Enlace comprobado', 'Se abrió la página oficial de reseñas en una nueva pestaña.');
    }
  };

  const { user, markUserOnboarded } = useAuth();

  const handleFinish = async () => {
    try {
      await markUserOnboarded(user?.id);
    } catch {
      // fallback
    }
    localStorage.setItem(`toque_onboarded_${tenant?.id || 'default'}`, 'true');
    success('¡Configuración lista!', 'Tu panel de Toque está calibrado y tus carteles listos para usar.');
    if (onComplete) onComplete();
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
    >
      <div className="space-y-6">
        {/* Encabezado y Asistente de Pasos */}
        <div className="pt-2">
          <StepperWizard steps={steps} currentStepIndex={currentStep} />
        </div>

        {/* PASO 1: BIENVENIDA CON MARCA DEL FABRICANTE */}
        {currentStep === 0 && (
          <div className="space-y-6 text-center py-4">
            <div className="inline-flex p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)]">
              <BrandLogo
                name={tenant?.name || 'Tu Cartel'}
                logoUrl={tenant?.brandLogo}
                size="lg"
                showToqueBadge
              />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h2 className="font-display text-title-2 font-bold text-[var(--text-main)]">
                Bienvenido a Toque
              </h2>
              <p className="text-small text-[var(--text-muted)] leading-relaxed">
                Tus carteles físicos con tecnología <span className="font-semibold text-[var(--text-main)]">NFC + QR</span> ya están listos. En solo 2 minutos confirmamos los datos para que veas en tiempo real si el cartel funciona y cuántas reseñas genera.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--ultramar)]/5 border border-[var(--ultramar)]/20 max-w-md mx-auto text-left flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[var(--brand)] shrink-0 mt-0.5" />
              <div className="text-micro text-[var(--text-main)] leading-relaxed">
                <span className="font-semibold">Regla transparente de Google:</span> El enlace dirige directo al visitante a la ficha de reseñas. Cero filtros ni bloqueos previos.
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: CONFIRMAR DATOS */}
        {currentStep === 1 && (
          <div className="space-y-4 max-w-md mx-auto py-2">
            <div>
              <h3 className="font-display text-title-3 font-semibold text-[var(--text-main)]">
                Confirmá los datos de tu negocio
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Aparecerán en tus reportes y en la administración de carteles.
              </p>
            </div>

            <Input
              label="Nombre del negocio"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder="Ej. Café Martínez Centro"
              required
            />

            <Input
              label="Dirección / Sucursal"
              value={bizAddress}
              onChange={(e) => setBizAddress(e.target.value)}
              placeholder="Ej. Av. Santa Fe 2100"
              required
            />

            <Input
              label="Rubro o actividad"
              value={bizCategory}
              onChange={(e) => setBizCategory(e.target.value)}
              placeholder="Ej. Gastronomía, Peluquería, Hotel"
            />
          </div>
        )}

        {/* PASO 3: PROBAR LINK DE RESEÑAS */}
        {currentStep === 2 && (
          <div className="space-y-5 max-w-md mx-auto py-2">
            <div>
              <h3 className="font-display text-title-3 font-semibold text-[var(--text-main)]">
                Probá el enlace de reseñas de Google
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Es la dirección oficial adonde viajarán tus clientes al apoyar el celular en el cartel.
              </p>
            </div>

            <div className="space-y-2">
              <Input
                label="Enlace a Google Reviews"
                value={reviewUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=..."
                error={urlValidation.isValid ? undefined : urlValidation.error}
                helperText="Dominios permitidos: google.com, maps.app.goo.gl, g.page, search.google.com"
              />

              <div className="pt-2 flex items-center justify-between gap-3">
                <Button
                  variant="primary"
                  onClick={handleTestReviewLink}
                  disabled={!urlValidation.isValid}
                  icon={<ExternalLink className="w-4 h-4" />}
                  className="w-full justify-center"
                >
                  Probar enlace ahora
                </Button>
              </div>

              {hasTestedLink && (
                <div className="p-3 rounded-xl bg-[var(--menta)]/10 border border-[var(--menta)]/30 text-micro text-[var(--text-main)] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--menta)] shrink-0" />
                  <span>¡Enlace probado! La ficha de Google abre sin trabas.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASO 4: ELEGIR REPORTE */}
        {currentStep === 3 && (
          <div className="space-y-5 max-w-md mx-auto py-2">
            <div>
              <h3 className="font-display text-title-3 font-semibold text-[var(--text-main)]">
                ¿Cómo querés recibir el resumen semanal?
              </h3>
              <p className="text-small text-[var(--text-muted)] mt-1">
                Un reporte claro en 3 líneas con una sola acción sugerida. Sin spam.
              </p>
            </div>

            {/* Canal */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setReportChannel('email')}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  reportChannel === 'email'
                    ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--text-main)] font-semibold'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Mail className="w-4 h-4 mx-auto mb-1 text-[var(--brand)]" />
                <span className="text-micro block">Por Email</span>
              </button>

              <button
                type="button"
                onClick={() => setReportChannel('whatsapp')}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  reportChannel === 'whatsapp'
                    ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--text-main)] font-semibold'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <MessageSquare className="w-4 h-4 mx-auto mb-1 text-[var(--menta)]" />
                <span className="text-micro block">Por WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setReportChannel('both')}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  reportChannel === 'both'
                    ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--text-main)] font-semibold'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Smartphone className="w-4 h-4 mx-auto mb-1 text-[var(--estrella)]" />
                <span className="text-micro block">Ambos</span>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <Input
                label="Email de recepción"
                value={reportEmail}
                onChange={(e) => setReportEmail(e.target.value)}
                placeholder="nombre@tudominio.com"
              />

              <Input
                label="Número de WhatsApp"
                value={reportPhone}
                onChange={(e) => setReportPhone(e.target.value)}
                placeholder="+54 9 11 ..."
              />
            </div>
          </div>
        )}

        {/* Botones de Navegación del Asistente */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
          {currentStep > 0 ? (
            <Button
              variant="secondary"
              onClick={() => setCurrentStep(prev => prev - 1)}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Anterior
            </Button>
          ) : (
            <div />
          )}

          {currentStep < steps.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="gap-2"
            >
              <span>Continuar</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleFinish}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4 text-[var(--estrella)]" />
              <span>Finalizar y entrar a mi panel</span>
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
};
