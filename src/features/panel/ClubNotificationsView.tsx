import React, { useState, useEffect } from 'react';
import {
  api,
  NotificationTemplate,
  NotificationLimits,
  PlanState,
} from '../../api';
import { useAuth } from '../../lib/authContext';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Bell,
  Calendar,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Users,
} from 'lucide-react';

export const ClubNotificationsView: React.FC = () => {
  const { user } = useAuth();
  const isOwner =
    user?.role === 'owner' || user?.role === 'superadmin' || Boolean(user?.isSuperAdmin);

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [limits, setLimits] = useState<NotificationLimits>({
    maxPerClientDays: 7,
    quietHoursStart: '21:00',
    quietHoursEnd: '09:00',
  });
  const [subscribedCount, setSubscribedCount] = useState(0);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Plantilla seleccionada para editar / previsualizar
  const [selectedId, setSelectedId] = useState<string>('tpl-birthday');
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editActive, setEditActive] = useState(true);

  // Nuevo aviso programado
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customDateTime, setCustomDateTime] = useState('2026-10-30T11:00');

  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [res, plan] = await Promise.all([
        api.listNotificationTemplates(),
        api.getPlanState(),
      ]);
      setTemplates(res.templates);
      setLimits(res.limits);
      setSubscribedCount(res.subscribedClientsCount);
      setPlanState(plan);

      const first = res.templates[0];
      if (first) {
        setSelectedId(first.id);
        setEditTitle(first.title);
        setEditMessage(first.message);
        setEditActive(first.active);
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'No pudimos cargar los avisos.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectTemplate = (tpl: NotificationTemplate) => {
    setSelectedId(tpl.id);
    setEditTitle(tpl.title);
    setEditMessage(tpl.message);
    setEditActive(tpl.active);
    setStatusMsg(null);
    setErrorMsg(null);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    if (!isOwner) {
      setErrorMsg('Solo el dueño puede configurar avisos.');
      return;
    }

    if (!editTitle.trim() || !editMessage.trim()) {
      setErrorMsg('Completá el título y el texto del aviso.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.updateTemplate(
        selectedId,
        {
          title: editTitle.trim(),
          message: editMessage.trim(),
          active: editActive,
        },
        limits
      );
      setTemplates(res.templates);
      setLimits(res.limits);
      setStatusMsg('Se guardaron los cambios del aviso y los límites de envío.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos guardar el aviso.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    if (!isOwner) {
      setErrorMsg('Solo el dueño puede programar avisos.');
      return;
    }

    if (!customTitle.trim() || !customMessage.trim()) {
      setErrorMsg('Completá el título y el mensaje del aviso programado.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await api.scheduleNotification({
        title: customTitle.trim(),
        message: customMessage.trim(),
        scheduledFor: customDateTime,
      });
      setTemplates((prev) => [...prev, created]);
      handleSelectTemplate(created);
      setCustomTitle('');
      setCustomMessage('');
      setStatusMsg('Aviso propio programado correctamente.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos programar el aviso.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-2">
        <h1 className="text-xl font-bold text-[#f1f1ee]">Avisos</h1>
        <p className="text-sm text-[#a1a1aa]">
          Solo el dueño del comercio puede configurar y programar avisos para los socios.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 rounded-xl bg-[#111113]" />
        <Skeleton className="h-80 w-full rounded-2xl bg-[#111113]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
        <AlertCircle className="w-8 h-8 text-[#f87171]" />
        <p className="text-base text-[#f1f1ee]">{loadError}</p>
        <button
          type="button"
          onClick={loadData}
          className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-sm cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const isExpired = planState?.status === 'expired';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">Avisos</h1>
          <p className="text-base text-[#d4d4d8]">
            Mensajes automáticos de cumpleaños, cercanía al local y avisos programados.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#111113] border border-[#242426] flex items-center gap-3 text-sm">
          <Users className="w-5 h-5 text-[#34d399] shrink-0" />
          <span>
            Lo recibirían{' '}
            <strong className="font-mono text-[#f1f1ee] tabular-nums">
              {subscribedCount} cliente(s)
            </strong>{' '}
            que tildaron recibir avisos de este local
          </span>
        </div>
      </div>

      {isExpired && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-base text-[#fde68a] flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" />
          <span>
            Tu suscripción está vencida: el cartel y las tarjetas de tus clientes siguen funcionando, pero los avisos están pausados hasta reactivar tu plan.
          </span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/40 text-base text-[#fca5a5] flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-[#f87171] shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {statusMsg && (
        <div
          role="status"
          className="p-4 rounded-xl bg-[#2fb36a]/15 border border-[#2fb36a]/40 text-base text-[#86efac] flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-[#34d399] shrink-0 mt-0.5" />
          <span>{statusMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Avisos y Editor */}
        <div className="lg:col-span-7 space-y-6">
          {/* Selección de Avisos */}
          <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
            <h2 className="font-bold text-lg text-[#f1f1ee]">
              Mensajes predeterminados y programados
            </h2>

            <div className="space-y-2.5">
              {templates.map((tpl) => {
                const isSelected = tpl.id === selectedId;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`w-full min-h-[56px] p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#bec8ff] bg-[#18181b]'
                        : 'border-[#28282a] bg-[#141416] hover:border-[#3f3f46]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-base text-[#f1f1ee]">
                        {tpl.type === 'birthday'
                          ? 'Cumpleaños'
                          : tpl.type === 'nearby'
                          ? 'Cerca del local'
                          : tpl.title}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          tpl.active ? 'text-[#34d399]' : 'text-[#a1a1aa]'
                        }`}
                      >
                        {tpl.active ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] mt-1">{tpl.scheduleInfo}</p>
                  </button>
                );
              })}
            </div>

            {/* Editor del aviso seleccionado */}
            <form onSubmit={handleSaveTemplate} className="pt-4 border-t border-[#242426] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-[#f1f1ee]">Editar aviso seleccionado</h3>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#f1f1ee] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="w-5 h-5 rounded border-[#28282a] text-[#bec8ff]"
                  />
                  <span>Aviso activo</span>
                </label>
              </div>

              <div>
                <label
                  htmlFor="tpl-title-input"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Título del aviso
                </label>
                <input
                  id="tpl-title-input"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee]"
                />
              </div>

              <div>
                <label
                  htmlFor="tpl-msg-input"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Texto del mensaje
                </label>
                <textarea
                  id="tpl-msg-input"
                  rows={3}
                  required
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  className="w-full p-4 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee]"
                />
              </div>

              {/* Límites para no molestar (editables) */}
              <div className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#f1f1ee]">
                  <ShieldCheck className="w-4 h-4 text-[#34d399]" />
                  <span>Límites para no molestar (editables)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="limit-days"
                      className="block text-xs font-semibold text-[#a1a1aa] mb-1"
                    >
                      Máximo 1 aviso cada (días)
                    </label>
                    <input
                      id="limit-days"
                      type="number"
                      min={1}
                      max={60}
                      value={limits.maxPerClientDays}
                      onChange={(e) =>
                        setLimits({
                          ...limits,
                          maxPerClientDays: Math.max(1, Number(e.target.value) || 7),
                        })
                      }
                      className="w-full min-h-[48px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#111113] text-sm text-[#f1f1ee]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="quiet-start"
                      className="block text-xs font-semibold text-[#a1a1aa] mb-1"
                    >
                      Horario silencioso desde
                    </label>
                    <input
                      id="quiet-start"
                      type="time"
                      value={limits.quietHoursStart}
                      onChange={(e) =>
                        setLimits({ ...limits, quietHoursStart: e.target.value })
                      }
                      className="w-full min-h-[48px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#111113] text-sm text-[#f1f1ee]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="quiet-end"
                      className="block text-xs font-semibold text-[#a1a1aa] mb-1"
                    >
                      Horario silencioso hasta
                    </label>
                    <input
                      id="quiet-end"
                      type="time"
                      value={limits.quietHoursEnd}
                      onChange={(e) =>
                        setLimits({ ...limits, quietHoursEnd: e.target.value })
                      }
                      className="w-full min-h-[48px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#111113] text-sm text-[#f1f1ee]"
                    />
                  </div>
                </div>
                <p className="text-xs text-[#a1a1aa]">
                  Solo se envía a clientes que tildaron recibir avisos de este comercio.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSaving || isExpired}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-base cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar aviso y límites'}
              </button>
            </form>
          </div>

          {/* Crear aviso propio programado */}
          <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
            <h2 className="font-bold text-lg text-[#f1f1ee] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#bec8ff]" />
              <span>Crear un aviso propio con fecha y hora programadas</span>
            </h2>

            <form onSubmit={handleScheduleCustom} className="space-y-4">
              <div>
                <label
                  htmlFor="custom-title"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Título del aviso
                </label>
                <input
                  id="custom-title"
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ej. Esta semana 2x1 en medialunas"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee]"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-msg"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Mensaje para tus clientes
                </label>
                <textarea
                  id="custom-msg"
                  rows={2}
                  required
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Pasá por el local y mostrá tu tarjeta."
                  className="w-full p-4 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee]"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-dt"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Fecha y hora programada
                </label>
                <input
                  id="custom-dt"
                  type="datetime-local"
                  required
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee]"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving || isExpired}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-[#bec8ff] text-[#0c0c0c] font-bold text-base cursor-pointer disabled:opacity-50"
              >
                Programar aviso
              </button>
            </form>
          </div>
        </div>

        {/* Vista previa en el celular */}
        <div className="lg:col-span-5">
          <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-4 sticky top-24">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-[#f1f1ee] flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#bec8ff]" />
                <span>Así se ve en el celular</span>
              </h2>
              <span className="text-xs text-[#a1a1aa]">Vista previa</span>
            </div>

            {/* Simulación de pantalla de bloqueo del celular */}
            <div className="rounded-3xl bg-[#000000] border-2 border-[#28282a] p-5 space-y-6">
              <div className="text-center space-y-1 pt-2">
                <span className="font-mono text-3xl font-bold text-[#f1f1ee] tabular-nums block">
                  10:00
                </span>
                <span className="text-xs text-[#a1a1aa] block">Pantalla de bloqueo</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#18181b] border border-[#343438] space-y-2 shadow-lg">
                <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                  <span className="font-bold text-[#bec8ff]">TARJETA DEL LOCAL</span>
                  <span>ahora</span>
                </div>
                <p className="font-bold text-base text-[#f1f1ee]">
                  {editTitle || 'Título del aviso'}
                </p>
                <p className="text-sm text-[#d4d4d8] leading-relaxed">
                  {editMessage || 'Texto del aviso en el celular del cliente.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#111113] border border-[#242426] space-y-1.5 text-xs text-[#a1a1aa]">
                <div className="flex items-center gap-2 text-[#f1f1ee] font-semibold">
                  <Clock className="w-4 h-4 text-[#34d399]" />
                  <span>Destinatarios estimados: {subscribedCount} cliente(s)</span>
                </div>
                <p>
                  Respeta el límite de máximo 1 aviso cada {limits.maxPerClientDays} días y el
                  horario silencioso de {limits.quietHoursStart} a {limits.quietHoursEnd}.
                </p>
                <p>
                  En el aviso de cercanía, la billetera del celular detecta el local sin enviar la
                  ubicación del cliente a Toque.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
