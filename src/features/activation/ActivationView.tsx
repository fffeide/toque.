import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, CartelRole, HubMode } from '../../api';
import { useAuth } from '../../lib/authContext';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { useToast } from '../../components/ui/Toast';
import {
  CheckCircle2,
  KeyRound,
  Store,
  ExternalLink,
  Tag,
  Eye,
  Check,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Smartphone,
} from 'lucide-react';

export const ActivationView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, business } = useAuth();
  const { success, error: toastError } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [cartelState, setCartelState] = useState<{
    found: boolean;
    status?: string;
    requiresPin?: boolean;
    cartel?: { code?: string; name?: string; role?: CartelRole; status?: string };
  } | null>(null);

  // Pasos de activación (1 a 6)
  const [currentStep, setCurrentStep] = useState(1);

  // Formulario
  const [pin, setPin] = useState('');
  const [bizName, setBizName] = useState(business?.name || '');
  const [reviewUrl, setReviewUrl] = useState(business?.reviewUrl || 'https://maps.app.goo.gl/ejemplo');
  const [cartelName, setCartelName] = useState('Caja 1');
  const [role, setRole] = useState<CartelRole>('caja');
  const [mode, setMode] = useState<HubMode>('hub');

  // Estados de proceso y errores
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const cleanCode = (code || '').toUpperCase();

  const fetchState = async () => {
    setIsLoading(true);
    setActivationError(null);
    try {
      const state = await api.getActivationState(cleanCode);
      setCartelState(state);
      if (user && state.found && state.status === 'sin_activar') {
        // Si ya está logueado, avanzar al paso 2 (PIN)
        setCurrentStep(2);
      }
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Error al consultar el cartel.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (cleanCode) {
      fetchState();
    }
  }, [cleanCode, user]);

  useEffect(() => {
    if (business?.name && !bizName) setBizName(business.name);
    if (business?.reviewUrl && !reviewUrl) setReviewUrl(business.reviewUrl);
  }, [business]);

  // Validación de Google Maps
  const validateGoogleReviewUrl = (url: string) => {
    const clean = url.trim().toLowerCase();
    if (clean.includes('google.com/url?q=') || clean.includes('/url?q=')) {
      return false;
    }
    return (
      clean.includes('g.page/') ||
      clean.includes('maps.app.goo.gl/') ||
      clean.includes('google.com/maps') ||
      clean.includes('goo.gl/maps')
    );
  };

  const handleTestReviewUrl = () => {
    if (!validateGoogleReviewUrl(reviewUrl)) {
      toastError('El enlace no es válido', 'Debe ser un link de Google Maps (g.page, maps.app.goo.gl o google.com/maps).');
      return;
    }
    window.open(reviewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCompleteActivation = async () => {
    setIsActivating(true);
    setActivationError(null);
    try {
      await api.activateCartel({
        code: cleanCode,
        pin: pin.trim(),
        businessName: bizName.trim(),
        reviewUrl: reviewUrl.trim(),
        cartelName: cartelName.trim(),
        role,
        mode,
      });
      success('¡Cartel activado!', 'Ya podés vincularlo a tu caja o colocarlo en tu local.');
      setCurrentStep(6);
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Error al activar.');
      toastError('No pudimos activar el cartel', err instanceof Error ? err.message : 'Revisá los datos ingresados.');
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F4EE]">
        <PublicHeader />
        <div className="max-w-xl mx-auto p-6 space-y-4 pt-12">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // Estado: Código inexistente
  if (!cartelState?.found) {
    return (
      <div className="min-h-screen bg-[#F7F4EE]">
        <PublicHeader />
        <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FCE9E6] text-[#B8332A] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="font-display font-bold text-xl text-[#0B1030]">
            Cartel no encontrado
          </h2>
          <p className="text-xs text-[#5E6072] leading-relaxed">
            El código <span className="cartel-code font-bold text-[#0B1030]">{cleanCode}</span> no coincide con ningún cartel registrado en Toque. Verificá que esté bien escrito o comunicate con soporte.
          </p>
          <div className="pt-2">
            <Link to="/login">
              <Button variant="secundario">Ir al inicio de sesión</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Estado: Ya activado
  if (cartelState.status === 'active' && currentStep !== 6) {
    return (
      <div className="min-h-screen bg-[#F7F4EE]">
        <PublicHeader />
        <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#ECEDFC] text-[#3A3FE0] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="font-display font-bold text-xl text-[#0B1030]">
            Este cartel ya está activado
          </h2>
          <p className="text-xs text-[#5E6072] leading-relaxed">
            El cartel <span className="cartel-code font-bold text-[#0B1030]">{cleanCode}</span> ya se encuentra en funcionamiento. Podés probarlo en el Hub público o gestionarlo desde el panel.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <Link to={`/h/${cleanCode}`}>
              <Button variant="estrella" size="touch" fullWidth>
                Abrir Hub del Cliente
              </Button>
            </Link>
            <Link to="/panel/carteles">
              <Button variant="secundario" size="touch" fullWidth>
                Ver en mi panel
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 py-8">
        {/* Encabezado y Barra de Progreso */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#5E6072]">
            <span>Activá tu cartel</span>
            <span className="cartel-code text-[#0B1030] bg-white px-2 py-0.5 rounded border border-[#E3DDD2]">
              {cleanCode}
            </span>
            <span>Paso {currentStep} de 6</span>
          </div>

          <div className="w-full h-2 bg-[#E3DDD2] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3A3FE0] transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            />
          </div>
        </div>

        {activationError && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#FCE9E6] border border-[#B8332A]/20 text-xs text-[#B8332A] font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{activationError}</span>
          </div>
        )}

        <Card padding="lg" className="space-y-6">
          {/* PASO 1: SESIÓN */}
          {currentStep === 1 && (
            <div className="space-y-5 text-center sm:text-left">
              <div>
                <h2 className="font-display font-bold text-xl text-[#0B1030]">
                  Paso 1: Iniciá sesión en Toque
                </h2>
                <p className="text-xs text-[#5E6072] mt-1">
                  Para asociar este cartel a tu negocio necesitás identificarte con tu cuenta.
                </p>
              </div>

              {user ? (
                <div className="p-4 rounded-xl bg-[#ECEDFC] border border-[#3A3FE0]/20 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-[#3A3FE0] uppercase">Sesión activa</span>
                    <p className="font-bold text-sm text-[#0B1030]">{user.name}</p>
                    <p className="text-xs text-[#5E6072]">{user.email}</p>
                  </div>
                  <Button variant="ultramar" size="sm" onClick={() => setCurrentStep(2)}>
                    Continuar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <Link to="/login">
                    <Button variant="ultramar" fullWidth size="touch">
                      Iniciar sesión con mi cuenta
                    </Button>
                  </Link>
                  <Link to="/registro">
                    <Button variant="secundario" fullWidth size="touch">
                      Crear una cuenta nueva
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* PASO 2: PIN DE ACTIVACIÓN */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display font-bold text-xl text-[#0B1030] flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#3A3FE0]" />
                  <span>Paso 2: Ingresá el PIN de activación</span>
                </h2>
                <p className="text-xs text-[#5E6072] mt-1">
                  Es un código de 6 caracteres impreso en la tarjeta o adentro de la caja de tu cartel.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="pin">
                  PIN de 6 caracteres
                </label>
                <input
                  id="pin"
                  type="text"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.toUpperCase())}
                  placeholder="Ej. ABC123"
                  className="cartel-code w-full text-center tracking-widest text-2xl font-bold px-4 py-3 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/60 focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
                />
                <p className="text-[11px] text-[#5E6072] mt-1.5">
                  Ejemplo de prueba rápida en demo: utilizá <strong className="cartel-code text-[#0B1030]">ABC123</strong>.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secundario" onClick={() => setCurrentStep(1)}>
                  Volver
                </Button>
                <Button
                  variant="ultramar"
                  fullWidth
                  size="touch"
                  disabled={pin.trim().length !== 6}
                  onClick={() => setCurrentStep(3)}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* PASO 3: NEGOCIO Y GOOGLE REVIEWS */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display font-bold text-xl text-[#0B1030] flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#3A3FE0]" />
                  <span>Paso 3: Tu negocio y enlace de reseñas</span>
                </h2>
                <p className="text-xs text-[#5E6072] mt-1">
                  Donde los clientes van a dejar su opinión al apoyar el celular.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="bName">
                    Nombre del comercio
                  </label>
                  <input
                    id="bName"
                    type="text"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder="Ej. Café La Esquina"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-sm focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="rUrl">
                    Enlace de reseñas de Google Maps *
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="rUrl"
                      type="url"
                      value={reviewUrl}
                      onChange={(e) => setReviewUrl(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-xs focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
                    />
                    <Button
                      type="button"
                      variant="secundario"
                      size="sm"
                      onClick={handleTestReviewUrl}
                      icon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      Probar
                    </Button>
                  </div>
                  <p className="text-[11px] text-[#5E6072] mt-1.5 leading-relaxed">
                    Acepta enlaces oficiales de Google (g.page, maps.app.goo.gl o google.com/maps). Rechaza enlaces redirectores no directos.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secundario" onClick={() => setCurrentStep(2)}>
                  Volver
                </Button>
                <Button
                  variant="ultramar"
                  fullWidth
                  size="touch"
                  disabled={!bizName.trim() || !validateGoogleReviewUrl(reviewUrl)}
                  onClick={() => setCurrentStep(4)}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* PASO 4: NOMBRE Y ROL DEL CARTEL */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display font-bold text-xl text-[#0B1030] flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#3A3FE0]" />
                  <span>Paso 4: Nombre y ubicación del cartel</span>
                </h2>
                <p className="text-xs text-[#5E6072] mt-1">
                  Identificá en qué sector del salón o mostrador vas a colocar este soporte.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="cName">
                    Nombre del cartel
                  </label>
                  <input
                    id="cName"
                    type="text"
                    value={cartelName}
                    onChange={(e) => setCartelName(e.target.value)}
                    placeholder="Ej. Caja 1, Barra, Mesa 4"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-sm focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#0B1030] mb-2">
                    Rol operativo del cartel
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('caja')}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                        role === 'caja'
                          ? 'border-[#3A3FE0] bg-[#ECEDFC] text-[#0B1030]'
                          : 'border-[#E3DDD2] hover:bg-[#F7F4EE] text-[#5E6072]'
                      }`}
                    >
                      <span className="font-bold text-sm block">Rol: Caja</span>
                      <span className="text-[11px] block mt-0.5">
                        Muestra recibos de cobros recién emitidos + reseñas.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('resena')}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                        role === 'resena'
                          ? 'border-[#3A3FE0] bg-[#ECEDFC] text-[#0B1030]'
                          : 'border-[#E3DDD2] hover:bg-[#F7F4EE] text-[#5E6072]'
                      }`}
                    >
                      <span className="font-bold text-sm block">Rol: Reseña</span>
                      <span className="text-[11px] block mt-0.5">
                        Para mesas o barras sin cobro. Enfoque 100% reseñas.
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secundario" onClick={() => setCurrentStep(3)}>
                  Volver
                </Button>
                <Button
                  variant="ultramar"
                  fullWidth
                  size="touch"
                  disabled={!cartelName.trim()}
                  onClick={() => setCurrentStep(5)}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* PASO 5: MODO (DIRECTO O HUB) + VISTA PREVIA */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display font-bold text-xl text-[#0B1030] flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#3A3FE0]" />
                  <span>Paso 5: Modo de apertura y vista previa</span>
                </h2>
                <p className="text-xs text-[#5E6072] mt-1">
                  Elegí qué experimenta el cliente al apoyar su celular o escanear el QR.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('hub')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    mode === 'hub'
                      ? 'border-[#3A3FE0] bg-[#ECEDFC] text-[#0B1030]'
                      : 'border-[#E3DDD2] hover:bg-[#F7F4EE] text-[#5E6072]'
                  }`}
                >
                  <span className="font-bold text-sm block">Hub Completo (Recomendado)</span>
                  <span className="text-[11px] block mt-0.5">
                    Comprobante + Botón de Reseña + Club + Redes sociales.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('direct')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    mode === 'direct'
                      ? 'border-[#3A3FE0] bg-[#ECEDFC] text-[#0B1030]'
                      : 'border-[#E3DDD2] hover:bg-[#F7F4EE] text-[#5E6072]'
                  }`}
                >
                  <span className="font-bold text-sm block">Directo a Google</span>
                  <span className="text-[11px] block mt-0.5">
                    Redirige inmediatamente a la ficha de Google Reviews.
                  </span>
                </button>
              </div>

              {/* Vista previa simplificada */}
              <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#E3DDD2] space-y-3">
                <span className="text-[10px] font-bold text-[#5E6072] uppercase tracking-wider block">
                  Vista previa de experiencia del cliente
                </span>
                <div className="bg-white p-4 rounded-xl border border-[#E3DDD2] text-center space-y-3 max-w-xs mx-auto">
                  <p className="font-display font-bold text-sm text-[#0B1030]">{bizName}</p>
                  {role === 'caja' && mode === 'hub' && (
                    <div className="p-2.5 rounded-lg bg-[#F7F4EE] text-left text-xs text-[#5E6072] border border-[#E3DDD2]">
                      <span className="font-bold text-[#0B1030] block">Comprobante de compra</span>
                      <span>Total: $14.500 (Ejemplo)</span>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-[#FFC21A] text-[#0B1030] font-bold text-xs shadow-xs">
                    Dejar reseña en Google
                  </div>
                  {mode === 'hub' && (
                    <p className="text-[10px] text-[#5E6072] pt-1">
                      + Club de fidelidad y redes del negocio
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secundario" onClick={() => setCurrentStep(4)}>
                  Volver
                </Button>
                <Button
                  variant="estrella"
                  fullWidth
                  size="touch"
                  disabled={isActivating}
                  onClick={handleCompleteActivation}
                >
                  {isActivating ? 'Activando cartel…' : 'Activar cartel ahora'}
                </Button>
              </div>
            </div>
          )}

          {/* PASO 6: PRUEBA Y ÉXITO */}
          {currentStep === 6 && (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 rounded-3xl bg-[#FFF1C7] text-[#0B1030] flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-8 h-8 text-[#FFC21A]" />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#3A3FE0]">
                  ¡Felicitaciones!
                </span>
                <h2 className="font-display font-bold text-2xl text-[#0B1030]">
                  Tu cartel ya está activo
                </h2>
                <p className="text-xs text-[#5E6072] max-w-sm mx-auto leading-relaxed">
                  El código <span className="cartel-code font-bold text-[#0B1030]">{cleanCode}</span> quedó asociado a <strong className="text-[#0B1030]">{bizName}</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F4EE] border border-[#E3DDD2] max-w-sm mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#5E6072]">Ubicación:</span>
                  <span className="font-semibold text-[#0B1030]">{cartelName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5E6072]">Rol:</span>
                  <span className="font-semibold text-[#0B1030] capitalize">{role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5E6072]">Modo:</span>
                  <span className="font-semibold text-[#0B1030]">{mode === 'hub' ? 'Hub público' : 'Directo a Google'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5E6072]">Enlace corto:</span>
                  <span className="cartel-code font-bold text-[#3A3FE0]">toque.ar/h/{cleanCode}</span>
                </div>
              </div>

              <div className="space-y-2.5 max-w-sm mx-auto">
                <Link to={`/h/${cleanCode}`}>
                  <Button variant="estrella" size="touch" fullWidth icon={<Smartphone className="w-4 h-4" />}>
                    Probar cómo lo ve el cliente
                  </Button>
                </Link>

                <Link to="/caja">
                  <Button variant="ultramar" size="touch" fullWidth>
                    Ir a la pantalla de Caja
                  </Button>
                </Link>

                <Link to="/panel/carteles">
                  <Button variant="secundario" size="touch" fullWidth>
                    Ir al panel de control
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};
