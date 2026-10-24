import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { MercadoPagoStatus, PlanState } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { PLANS, TRIAL_DAYS } from '../../config/pricing';
import { formatARS } from '../../lib/format';
import {
  Store,
  CreditCard,
  CheckCircle2,
  Save,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Calendar,
} from 'lucide-react';

export const AccountSettingsView: React.FC = () => {
  const { user, business, refreshSession } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(business?.name || 'Musical Monroe');
  const [ownerName, setOwnerName] = useState(business?.ownerName || 'Musical Monroe');
  const [email, setEmail] = useState(business?.email || 'hola@musicalmonroe.com.ar');
  const [reviewUrl, setReviewUrl] = useState(business?.reviewUrl || '');

  const [mpStatus, setMpStatus] = useState<MercadoPagoStatus | null>(null);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<'mensual' | 'anual'>('mensual');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [togglingMp, setTogglingMp] = useState(false);
  const [activatingPlan, setActivatingPlan] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [biz, mp, plan] = await Promise.all([
          api.getBusinessProfile(),
          api.getMercadoPagoStatus(),
          api.getPlanState(),
        ]);
        setName(biz.name);
        setOwnerName(biz.ownerName);
        setEmail(biz.email);
        setReviewUrl(biz.reviewUrl || '');
        setMpStatus(mp);
        setPlanState(plan);
        setSelectedPlanId(plan.planId || 'mensual');
      } catch (err: any) {
        showToast(err?.message || 'Error al cargar ajustes de cuenta', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [showToast]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      await api.updateBusinessProfile({
        name: name.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        reviewUrl: reviewUrl.trim(),
      });
      await refreshSession();
      showToast('Datos del comercio actualizados', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar cambios', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleMp = async () => {
    if (!mpStatus) return;
    try {
      setTogglingMp(true);
      if (mpStatus.connected) {
        await api.disconnectMercadoPago();
        setMpStatus({ connected: false });
        showToast('Cuenta de Mercado Pago desconectada', 'info');
      } else {
        await api.connectMercadoPago();
        const updated = await api.getMercadoPagoStatus();
        setMpStatus(updated);
        showToast('¡Mercado Pago conectado para cobros QR!', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error con Mercado Pago', 'error');
    } finally {
      setTogglingMp(false);
    }
  };

  const handleActivatePlan = async (planId: 'mensual' | 'anual') => {
    try {
      setActivatingPlan(true);
      const next = await api.startTrial(planId);
      setPlanState(next);
      setSelectedPlanId(planId);
      showToast(
        `Plan ${planId === 'anual' ? 'Anual' : 'Mensual'} actualizado (${TRIAL_DAYS} días de prueba incluidos).`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'No se pudo actualizar la suscripción', 'error');
    } finally {
      setActivatingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl bg-[#111113]" />
        <Skeleton className="h-72 rounded-2xl bg-[#111113]" />
        <Skeleton className="h-64 rounded-2xl bg-[#111113]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#f1f1ee]">Mi Cuenta y Suscripción</h1>
        <p className="text-sm text-[#a1a1aa] mt-0.5">
          Administrá los datos de tu comercio, tu suscripción a Toque y tus integraciones de cobro.
        </p>
      </div>

      {/* 1. Perfil del Comercio */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-[#242426]">
          <div className="w-10 h-10 rounded-xl bg-[#18181b] text-[#bec8ff] flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#f1f1ee]">Datos del Comercio</h2>
            <p className="text-xs text-[#a1a1aa]">
              Esta información encabeza tu Tarjeta de Sellos Digital, tu Smart Hub y tus comprobantes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#f1f1ee] mb-1.5">
              Nombre comercial
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#f1f1ee] mb-1.5">
              Titular / Responsable
            </label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#f1f1ee] mb-1.5">
              Correo de ingreso (código de 6 dígitos)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#f1f1ee] mb-1.5">
              Enlace de Reseñas de Google Maps
            </label>
            <input
              type="url"
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://g.page/r/.../review"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-[#a1a1aa]">
            Slug público:{' '}
            <code className="text-[#bec8ff] font-mono">/u/{business?.id || 'musical-monroe'}</code>
          </span>
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#bec8ff] hover:bg-[#a9b6ff] text-[#0c0c0c] font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savingProfile ? 'Guardando...' : 'Guardar Datos'}</span>
          </button>
        </div>
      </form>

      {/* 2. Suscripción Toque (Integrada dentro de Mi Cuenta) */}
      <section className="rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#242426] flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2fb36a]/15 text-[#2fb36a] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f1f1ee]">Suscripción y Plan Toque</h2>
              <p className="text-xs text-[#a1a1aa]">
                Todos los locales de tu comercio están incluidos. Sin comisiones por sello ni por venta.
              </p>
            </div>
          </div>

          {planState && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2fb36a]/15 border border-[#2fb36a]/30 text-xs font-bold text-[#2fb36a]">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {planState.status === 'trial'
                  ? `Prueba gratis activa · ${planState.daysRemaining} días restantes`
                  : `Plan ${planState.planId === 'anual' ? 'Anual' : 'Mensual'} activo`}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-5 border transition-colors flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'bg-[#18181b] border-[#bec8ff]'
                    : 'bg-[#141417] border-[#242426]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#f1f1ee]">{plan.name}</span>
                    {plan.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-[#2fb36a]/15 text-[#2fb36a] text-[10px] font-bold">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-[#f1f1ee]">
                      {formatARS(plan.priceArs)}
                    </span>
                    <span className="text-xs text-[#a1a1aa]">{plan.periodLabel}</span>
                  </div>
                  <p className="text-xs text-[#a1a1aa]">{plan.description}</p>
                </div>

                <button
                  type="button"
                  disabled={activatingPlan}
                  onClick={() => handleActivatePlan(plan.id)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#bec8ff] text-[#0c0c0c]'
                      : 'bg-[#222226] hover:bg-[#2c2c30] text-[#f1f1ee]'
                  }`}
                >
                  {isSelected ? 'Plan seleccionado' : `Elegir ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl bg-[#18181b] border border-[#28282a] p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#2fb36a] shrink-0 mt-0.5" />
          <div className="text-xs text-[#a1a1aa] space-y-1">
            <p className="font-semibold text-[#f1f1ee]">
              Garantía de continuidad para tus clientes
            </p>
            <p>
              Si algún mes decidís pausar o vence la suscripción, el Cartel QR del mostrador y las
              tarjetas de sellos de tus clientes siguen funcionando sin interrupciones.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Integración Mercado Pago */}
      <div className="rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/15 text-[#38bdf8] flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f1f1ee]">Integración Mercado Pago QR</h2>
              <p className="text-xs text-[#a1a1aa]">
                Generá cobros QR dinámicos en el Modo Caja y emití el comprobante digital al
                instante.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              mpStatus?.connected
                ? 'bg-[#2fb36a]/15 text-[#34d399]'
                : 'bg-[#18181b] text-[#a1a1aa]'
            }`}
          >
            {mpStatus?.connected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
              </>
            ) : (
              'Sin conectar'
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={togglingMp}
            onClick={handleToggleMp}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-2 cursor-pointer ${
              mpStatus?.connected
                ? 'bg-[#f87171]/15 hover:bg-[#f87171]/25 text-[#f87171]'
                : 'bg-[#2fb36a] hover:bg-[#269a59] text-[#08120c] font-bold'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>
              {togglingMp
                ? 'Procesando...'
                : mpStatus?.connected
                ? 'Desconectar Mercado Pago'
                : 'Conectar con Mercado Pago'}
            </span>
          </button>
        </div>
      </div>

      {/* Info de Sesión Actual */}
      <div className="rounded-2xl bg-[#111113] border border-[#242426] p-5 flex items-center justify-between text-xs text-[#a1a1aa]">
        <span>
          Sesión iniciada como <strong className="text-[#f1f1ee]">{user?.email}</strong>
        </span>
        <span>ID Comercio: {business?.id}</span>
      </div>
    </div>
  );
};
