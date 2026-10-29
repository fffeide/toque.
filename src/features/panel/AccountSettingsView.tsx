import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { PlanState } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Store,
  Save,
  Sparkles,
  CheckCircle2,
  Mail,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';

function stripRole(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/\s*\([^)]*\)/g, '').trim();
}

export const AccountSettingsView: React.FC = () => {
  const { user, business, refreshSession, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const creatorRealName =
    stripRole(user?.name) || stripRole(business?.ownerName) || 'Titular';

  const [name, setName] = useState(business?.name || '');
  const [ownerName, setOwnerName] = useState(creatorRealName);
  const [currentEmail, setCurrentEmail] = useState(
    user?.email || business?.email || ''
  );
  const [newEmail, setNewEmail] = useState('');
  const [planState, setPlanState] = useState<PlanState | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [biz, plan] = await Promise.all([
        api.getBusinessProfile(),
        api.getPlanState(),
      ]);
      setName(biz.name || '');
      const cleanOwner =
        stripRole(user?.name) ||
        (biz.ownerName &&
        biz.ownerName !== 'Encargado General' &&
        biz.ownerName !== 'Martín'
          ? stripRole(biz.ownerName)
          : creatorRealName);
      setOwnerName(cleanOwner);
      setCurrentEmail(user?.email || biz.email || '');
      setPlanState(plan);
    } catch (err: any) {
      showToast(err?.message || 'Error al cargar cuenta', 'error');
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
      });
      await refreshSession();
      showToast('Datos de la cuenta actualizados', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar cambios', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      showToast('Ingresá un correo electrónico válido', 'error');
      return;
    }
    try {
      setSavingEmail(true);
      const res = await api.updateAccountEmail(clean);
      setCurrentEmail(res.user.email || clean);
      setNewEmail('');
      await refreshSession();
      showToast('Correo electrónico actualizado', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo cambiar el mail', 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await api.deleteAccount();
      await logout();
      showToast('Cuenta eliminada correctamente', 'success');
      navigate('/ingresar', { replace: true });
    } catch (err: any) {
      showToast(err?.message || 'No se pudo eliminar la cuenta', 'error');
    } finally {
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-44 rounded-xl bg-[#141418]" />
        <Skeleton className="h-28 rounded-2xl bg-[#141418]" />
        <Skeleton className="h-44 rounded-2xl bg-[#141418]" />
      </div>
    );
  }

  const currentPlanLabel =
    planState?.planId === 'free' || planState?.status === 'free'
      ? 'Gratuito'
      : planState?.planId === 'a_consultar'
      ? 'A consultar'
      : 'Pago';

  const currentStatusLabel =
    planState?.unpaidLockdown
      ? 'Prueba finalizada sin pago (solo comprobante en Hub)'
      : planState?.status === 'expired_trial'
      ? `Prueba finalizada (${planState.graceDaysRemaining ?? 0} día(s) de gracia)`
      : planState?.status === 'trial'
      ? `En período de prueba (${planState.daysRemaining} día(s) restantes)`
      : 'Activa';

  return (
    <div className="space-y-5 max-w-3xl pb-12 text-sm">
      <div>
        <h1 className="text-lg font-bold text-[#F4F4F6]">Mi Cuenta</h1>
        <p className="text-xs text-[#9E9EA8] mt-0.5">
          Estado de tu suscripción, cambio de correo y administración de tu cuenta.
        </p>
      </div>

      {/* 1. SUSCRIPCIÓN: Solo muestra el estado y tipo de suscripción */}
      <section className="rounded-2xl bg-[#141418] border border-[#282830] p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D95B26]/15 text-[#D95B26] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F4F4F6]">Suscripción</h2>
              <p className="text-xs text-[#9E9EA8]">
                Tipo: <strong className="text-[#F4F4F6]">{currentPlanLabel}</strong> · Estado:{' '}
                <strong
                  className={
                    planState?.unpaidLockdown ? 'text-[#f87171]' : 'text-[#2FB36A]'
                  }
                >
                  {currentStatusLabel}
                </strong>
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              planState?.unpaidLockdown
                ? 'bg-[#f87171]/15 border-[#f87171]/30 text-[#f87171]'
                : 'bg-[#2FB36A]/15 border-[#2FB36A]/30 text-[#2FB36A]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {currentPlanLabel} · {currentStatusLabel}
            </span>
          </span>
        </div>
      </section>

      {/* 2. DATOS DEL COMERCIO */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4"
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#282830]">
          <div className="w-8 h-8 rounded-xl bg-[#1C1C22] text-[#D95B26] flex items-center justify-center">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#F4F4F6]">Datos del comercio</h2>
            <p className="text-xs text-[#9E9EA8]">
              Nombre comercial y titular creador de la cuenta.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-[#F4F4F6] mb-1">
              Nombre del comercio
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={business?.name || 'Nombre de tu comercio'}
              className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#F4F4F6] mb-1">
              Titular / Creador
            </label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder={`Ej: ${creatorRealName}`}
              className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
            />
          </div>
        </div>

        <div className="pt-1 flex items-center justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingProfile ? 'Guardando...' : 'Guardar cambios'}</span>
          </button>
        </div>
      </form>

      {/* 3. CAMBIAR MAIL */}
      <form
        onSubmit={handleUpdateEmail}
        className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4"
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#282830]">
          <div className="w-8 h-8 rounded-xl bg-[#1C1C22] text-[#BEC8FF] flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#F4F4F6]">Cambiar mail</h2>
            <p className="text-xs text-[#9E9EA8]">
              Correo actual: <strong className="text-[#F4F4F6]">{currentEmail}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#F4F4F6] mb-1">
              Nuevo correo electrónico
            </label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nuevo@correo.com"
              className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
            />
          </div>

          <button
            type="submit"
            disabled={savingEmail || !newEmail.trim()}
            className="px-4 py-2 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-xs font-bold text-[#BEC8FF] transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {savingEmail ? 'Actualizando...' : 'Cambiar mail'}
          </button>
        </div>
      </form>

      {/* 4. ELIMINAR CUENTA */}
      <section className="rounded-2xl bg-[#141418] border border-[#f87171]/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#f87171]/15 text-[#f87171] flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#F4F4F6]">Eliminar cuenta</h2>
            <p className="text-xs text-[#9E9EA8]">
              Da de baja de forma permanente tu cuenta y los datos asociados a tu comercio.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 rounded-xl bg-[#f87171]/15 hover:bg-[#f87171]/25 border border-[#f87171]/40 text-xs font-bold text-[#f87171] transition-colors cursor-pointer shrink-0"
        >
          Eliminar cuenta
        </button>
      </section>

      {/* Modal de confirmación para eliminar cuenta */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#f87171]">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-sm font-bold text-[#F4F4F6]">
                  ¿Eliminar cuenta definitivamente?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9E9EA8] leading-relaxed">
              Esta acción cerrará tu sesión y eliminará los datos del comercio{' '}
              <strong className="text-[#F4F4F6]">{name || business?.name}</strong>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-2 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-bold text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={handleConfirmDeleteAccount}
                className="px-4 py-2 rounded-xl bg-[#f87171] hover:bg-[#ef4444] text-[#0C0C0E] text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deletingAccount ? 'Eliminando...' : 'Sí, eliminar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
