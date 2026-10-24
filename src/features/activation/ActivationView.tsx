import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, Cartel, CartelRole } from '../../api';
import { useAuth } from '../../lib/authContext';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { QrCode, CheckCircle2, ArrowRight } from 'lucide-react';

export const ActivationView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, login, register } = useAuth();
  const { showToast } = useToast();

  const [cartel, setCartel] = useState<Cartel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [cartelName, setCartelName] = useState('Mostrador Principal');
  const [role, setRole] = useState<CartelRole>('caja');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    if (!code) return;
    setIsLoading(true);
    api
      .getCartelByCode(code)
      .then((res) => {
        if (!res) {
          setNotFound(true);
        } else if (res.status === 'active') {
          navigate(`/h/${res.code}`, { replace: true });
        } else {
          setCartel(res);
          if (res.name && res.name !== `Cartel ${res.code}`) {
            setCartelName(res.name);
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [code, navigate]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        await register({
          businessName,
          ownerName: businessName,
          email,
        });
        showToast('Cuenta creada. Ahora configurá tu cartel.', 'success');
      } else {
        await login({ email, code: password });
        showToast('Sesión iniciada. Ahora configurá tu cartel.', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error de autenticación', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setIsActivating(true);
    try {
      await api.activateCartel({
        code,
        name: cartelName,
        role,
        googleReviewUrl: googleReviewUrl || undefined,
      });
      showToast('¡Cartel activado y sincronizado con tu comercio!', 'success');
      navigate('/panel');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al activar el cartel', 'error');
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee] flex flex-col">
        <PublicHeader />
        <div className="max-w-md w-full mx-auto p-6 space-y-4 mt-8">
          <Skeleton className="h-8 w-3/4 mx-auto bg-[#141416]" />
          <Skeleton className="h-64 w-full bg-[#141416]" />
        </div>
      </div>
    );
  }

  if (notFound || !cartel) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee] flex flex-col">
        <PublicHeader />
        <div className="max-w-md w-full mx-auto p-6 mt-8 text-center">
          <Card padding="lg" className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#28282a] flex items-center justify-center mx-auto text-[#bec8ff]">
              <QrCode className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-[#f1f1ee]">Código no encontrado</h1>
            <p className="text-sm text-[#a1a1aa]">
              El código <span className="font-mono font-bold text-[#bec8ff]">{code}</span> no existe. Podés crearlo directamente desde tu panel de comercio.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/panel/carteles">
                <Button fullWidth>Ir a Mis Carteles</Button>
              </Link>
              <Link to="/h/CAJA01">
                <Button variant="outline" fullWidth>
                  Probar cartel activo (CAJA01)
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee] flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#2fb36a]/20 text-[#34d399] border border-[#2fb36a]/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Cartel Nuevo · Código {cartel.code}
          </span>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Activá tu cartel Toque en 2 pasos
          </h1>
          <p className="text-sm text-[#a1a1aa]">
            Vinculá este cartel físico a tu negocio para emitir recibos digitales y sumar reseñas.
          </p>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center gap-3 text-xs font-bold">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
              !isAuthenticated
                ? 'bg-[#bec8ff] text-[#0c0c0c] border-[#bec8ff]'
                : 'bg-[#2fb36a]/20 text-[#34d399] border-[#2fb36a]/40'
            }`}
          >
            <span>{isAuthenticated ? '✓' : '1'}</span>
            <span>Tu Cuenta</span>
          </div>
          <ArrowRight className="w-4 h-4 text-[#a1a1aa]" />
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
              isAuthenticated
                ? 'bg-[#bec8ff] text-[#0c0c0c] border-[#bec8ff]'
                : 'bg-[#141416] text-[#a1a1aa] border-[#242426]'
            }`}
          >
            <span>2</span>
            <span>Configurar Cartel</span>
          </div>
        </div>

        {!isAuthenticated ? (
          <Card padding="lg">
            <div className="flex border-b border-[#242426] mb-5">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 pb-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                  authMode === 'register'
                    ? 'border-[#bec8ff] text-[#bec8ff]'
                    : 'border-transparent text-[#a1a1aa]'
                }`}
              >
                Crear cuenta nueva
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 pb-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                  authMode === 'login'
                    ? 'border-[#bec8ff] text-[#bec8ff]'
                    : 'border-transparent text-[#a1a1aa]'
                }`}
              >
                Ya tengo cuenta
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'register' && (
                <Input
                  label="Nombre de tu comercio"
                  placeholder="Ej: Café La Esquina"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              )}
              <Input
                label="Email"
                type="email"
                placeholder="hola@tunegocio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Contraseña"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" fullWidth size="touch" isLoading={authLoading}>
                Continuar al Paso 2
              </Button>
            </form>
          </Card>
        ) : (
          <Card padding="lg">
            <form onSubmit={handleActivateSubmit} className="space-y-5">
              <Input
                label="¿Dónde vas a poner este cartel?"
                placeholder="Ej: Mostrador Caja 1, Mesa 4, Entrada"
                value={cartelName}
                onChange={(e) => setCartelName(e.target.value)}
                required
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#f1f1ee]">
                  ¿Qué función principal tendrá?
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      role === 'caja'
                        ? 'border-[#bec8ff] bg-[#bec8ff]/15'
                        : 'border-[#28282a] bg-[#18181b]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={role === 'caja'}
                      onChange={() => setRole('caja')}
                      className="mt-1"
                    />
                    <div>
                      <span className="block text-sm font-bold text-[#f1f1ee]">
                        Modo Caja + Recibo Digital en vivo
                      </span>
                      <span className="block text-xs text-[#a1a1aa] mt-0.5">
                        Muestra el comprobante digital al instante cuando cobrás en Caja, suma puntos y pide reseña.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      role === 'resena'
                        ? 'border-[#2fb36a] bg-[#2fb36a]/15'
                        : 'border-[#28282a] bg-[#18181b]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={role === 'resena'}
                      onChange={() => setRole('resena')}
                      className="mt-1"
                    />
                    <div>
                      <span className="block text-sm font-bold text-[#f1f1ee]">
                        Modo Reseña y Fidelización
                      </span>
                      <span className="block text-xs text-[#a1a1aa] mt-0.5">
                        Ideal para mesas o bolsas: destaca el botón de reseña en Google Maps, Wi-Fi y Club.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <Input
                label="Link de reseñas de Google Maps (opcional)"
                placeholder="https://g.page/r/..."
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
              />

              <Button type="submit" fullWidth size="touch" isLoading={isActivating}>
                Activar Cartel Ahora
              </Button>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
};
