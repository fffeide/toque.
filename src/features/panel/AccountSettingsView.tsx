import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { MercadoPagoStatus, PlanState, TeamMember, Cartel } from '../../api/types';
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
  Users,
  UserPlus,
  Trash2,
} from 'lucide-react';

export const AccountSettingsView: React.FC = () => {
  const { user, business, refreshSession } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(business?.name || 'La Burger');
  const [ownerName, setOwnerName] = useState(business?.ownerName || 'Martín');
  const [email, setEmail] = useState(business?.email || 'hola@laburger.com.ar');
  const [reviewUrl, setReviewUrl] = useState(business?.reviewUrl || '');

  const [mpStatus, setMpStatus] = useState<MercadoPagoStatus | null>(null);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<'free' | 'mensual' | 'anual'>('anual');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [carteles, setCarteles] = useState<Cartel[]>([]);

  // Alta de colaborador en Equipo
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'manager' | 'cashier'>('cashier');
  const [addingMember, setAddingMember] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [togglingMp, setTogglingMp] = useState(false);
  const [activatingPlan, setActivatingPlan] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [biz, mp, plan, teamList, cartelesList] = await Promise.all([
        api.getBusinessProfile(),
        api.getMercadoPagoStatus(),
        api.getPlanState(),
        api.listTeamMembers(),
        api.listCarteles(),
      ]);
      setName(biz.name);
      setOwnerName(biz.ownerName);
      setEmail(biz.email);
      setReviewUrl(biz.reviewUrl || '');
      setMpStatus(mp);
      setPlanState(plan);
      setSelectedPlanId(plan.planId || 'anual');
      setTeam(teamList);
      setCarteles(cartelesList);
    } catch (err: any) {
      showToast(err?.message || 'Error al cargar ajustes de cuenta', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleActivatePlan = async (planId: 'free' | 'mensual' | 'anual') => {
    try {
      setActivatingPlan(true);
      const next = await api.startTrial(planId);
      setPlanState(next);
      setSelectedPlanId(planId);
      if (planId === 'free') {
        showToast(
          'Pasaste al Plan Free (Hub básico). Tus datos históricos de clientes siguen guardados.',
          'info'
        );
      } else if (planId === 'anual') {
        showToast(
          `Plan Pro Anual activado con ${TRIAL_DAYS} días de prueba gratis incluidos.`,
          'success'
        );
      } else {
        showToast('Plan Pro Mensual ($34.999/mes) activado con todas las funciones.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'No se pudo actualizar la suscripción', 'error');
    } finally {
      setActivatingPlan(false);
    }
  };

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planState?.status === 'free' || planState?.planId === 'free') {
      showToast('La gestión de equipo requiere Plan Pro o el Trial de 14 días.', 'error');
      return;
    }
    try {
      setAddingMember(true);
      const created = await api.addTeamMember({
        name: memberName.trim(),
        email: memberEmail.trim().toLowerCase(),
        role: memberRole,
        assignedCartelId: carteles[0]?.id,
      });
      setTeam((prev) => [...prev, created]);
      setMemberName('');
      setMemberEmail('');
      showToast(`Colaborador ${created.name} agregado al equipo`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo agregar al colaborador', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveTeamMember = async (id: string) => {
    try {
      await api.removeTeamMember(id);
      setTeam((prev) => prev.filter((m) => m.id !== id));
      showToast('Acceso revocado', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Error al quitar colaborador', 'error');
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl bg-[#141418]" />
        <Skeleton className="h-72 rounded-2xl bg-[#141418]" />
        <Skeleton className="h-64 rounded-2xl bg-[#141418]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#D95B26]">
          Configuración Unificada · Equipo, Roles y Suscripción
        </span>
        <h1 className="text-2xl font-bold text-[#F4F4F6] mt-0.5">Equipo y Cuenta</h1>
        <p className="text-sm text-[#9E9EA8] mt-0.5">
          Gestioná tus colaboradores (Cajeros y Encargados), tu Plan Toque ($34.999 Pro o Trial 14
          días Anual) y los datos de tu comercio.
        </p>
      </div>

      {/* =================================================================== */}
      {/* 1. MODELO DE PLANES ($34.999 PRO, TRIAL 14 DÍAS ANUAL Y PLAN FREE)  */}
      {/* =================================================================== */}
      <section className="rounded-2xl bg-[#141418] border border-[#282830] p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#282830] flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D95B26]/15 text-[#D95B26] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F4F4F6]">Plan y Suscripción Toque</h2>
              <p className="text-xs text-[#9E9EA8]">
                Los {TRIAL_DAYS} días de prueba gratis están disponibles exclusivamente al elegir el
                Plan Anual. Si vence sin pago, pasás a Plan Free sin perder datos históricos.
              </p>
            </div>
          </div>

          {planState && (
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold ${
                planState.status === 'free'
                  ? 'bg-[#1C1C22] border-[#282830] text-[#9E9EA8]'
                  : 'bg-[#2FB36A]/15 border-[#2FB36A]/30 text-[#2FB36A]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {planState.status === 'trial'
                  ? `Trial Anual Activo · ${planState.daysRemaining} días restantes`
                  : planState.status === 'free'
                  ? 'Plan Free Activo (Solo Hub básico)'
                  : `Plan Pro (${planState.planId === 'anual' ? 'Anual' : 'Mensual'}) Activo`}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-5 border transition-colors flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'bg-[#1C1C22] border-[#D95B26]'
                    : 'bg-[#0C0C0E] border-[#282830]'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#F4F4F6]">{plan.name}</span>
                    {plan.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-[#D95B26]/20 text-[#D95B26] text-[10px] font-extrabold">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-[#F4F4F6]">
                      {plan.priceArs === 0 ? 'Gratis' : formatARS(plan.priceArs)}
                    </span>
                    {plan.priceArs > 0 && (
                      <span className="text-xs text-[#9E9EA8]">/ {plan.periodLabel}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#9E9EA8] leading-relaxed">{plan.description}</p>
                </div>

                <button
                  type="button"
                  disabled={activatingPlan}
                  onClick={() => handleActivatePlan(plan.id)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#D95B26] text-white'
                      : 'bg-[#1C1C22] hover:bg-[#282830] text-[#F4F4F6]'
                  }`}
                >
                  {isSelected
                    ? 'Plan actual'
                    : plan.id === 'anual'
                    ? `Iniciar Trial ${TRIAL_DAYS} días (Anual)`
                    : `Elegir ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl bg-[#1C1C22] border border-[#282830] p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#2FB36A] shrink-0 mt-0.5" />
          <div className="text-xs text-[#9E9EA8] space-y-1">
            <p className="font-semibold text-[#F4F4F6]">
              Protección de datos históricos garantizada
            </p>
            <p>
              Si finaliza el período de prueba de {TRIAL_DAYS} días sin abonar o pasás al Plan Free,
              tu Cartel QR sigue mostrando el Hub básico (reseñas y enlaces) y nunca se borran tus
              clientes ni sus sellos acumulados.
            </p>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 2. GESTIÓN DE EQUIPO Y ROLES (DUEÑO, ENCARGADO, CAJERO AISLADO)     */}
      {/* =================================================================== */}
      <section className="rounded-2xl bg-[#141418] border border-[#282830] p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#282830]">
          <div className="w-10 h-10 rounded-xl bg-[#BEC8FF]/15 text-[#BEC8FF] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F4F4F6]">Equipo del Comercio y Permisos</h2>
            <p className="text-xs text-[#9E9EA8]">
              El rol <strong className="text-[#F4F4F6]">Cajero</strong> solo tiene acceso a Caja POS
              y al Lector de Tarjetas (sin acceso a facturación ni configuración).
            </p>
          </div>
        </div>

        <form onSubmit={handleAddTeamMember} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Nombre (ej. Lucas Caja)"
            className="px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
          />
          <input
            type="email"
            required
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder="cajero@comercio.com"
            className="px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
          />
          <select
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as 'manager' | 'cashier')}
            className="px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
          >
            <option value="cashier">Cajero (Solo Caja POS + Lector)</option>
            <option value="manager">Encargado (Gestión operativa)</option>
          </select>
          <button
            type="submit"
            disabled={addingMember}
            className="px-4 py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{addingMember ? 'Agregando...' : 'Agregar al equipo'}</span>
          </button>
        </form>

        <div className="divide-y divide-[#282830] border border-[#282830] rounded-xl overflow-hidden">
          {team.map((member) => (
            <div
              key={member.id}
              className="p-3.5 bg-[#0C0C0E] flex items-center justify-between gap-3 text-xs"
            >
              <div>
                <span className="font-bold text-[#F4F4F6]">{member.name}</span>
                <span className="text-[#9E9EA8] ml-2">{member.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#1C1C22] border border-[#282830] font-bold text-[#BEC8FF]">
                  {member.role === 'owner'
                    ? 'Dueño'
                    : member.role === 'manager'
                    ? 'Encargado'
                    : 'Cajero'}
                </span>
                {member.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTeamMember(member.id)}
                    className="p-1.5 rounded-lg text-[#f87171] hover:bg-[#f87171]/15 cursor-pointer"
                    title="Revocar acceso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. DATOS DEL COMERCIO E INTEGRACIÓN MERCADO PAGO                    */}
      {/* =================================================================== */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl bg-[#141418] border border-[#282830] p-6 space-y-5"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-[#282830]">
          <div className="w-10 h-10 rounded-xl bg-[#1C1C22] text-[#D95B26] flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F4F4F6]">Identidad del Comercio</h2>
            <p className="text-xs text-[#9E9EA8]">
              Visible en tu Hub, en la Tarjeta de Sellos Digital y en los comprobantes térmicos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#F4F4F6] mb-1.5">
              Nombre comercial
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: La Burger"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#F4F4F6] mb-1.5">
              Titular / Responsable
            </label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Ej: Martín"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#F4F4F6] mb-1.5">
              Correo administrativo
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@comercio.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#F4F4F6] mb-1.5">
              Enlace de Reseñas en Google Maps
            </label>
            <input
              type="url"
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://g.page/r/.../review"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={togglingMp}
              onClick={handleToggleMp}
              className="px-3.5 py-2 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-semibold text-[#F4F4F6] inline-flex items-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#2FB36A]" />
              <span>
                {mpStatus?.connected ? 'Mercado Pago Conectado ✓' : 'Conectar Mercado Pago QR'}
              </span>
            </button>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savingProfile ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
