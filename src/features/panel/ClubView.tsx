import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ClubConfig, ClubMember } from '../../api';
import { ClubLocal } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/formatters';
import {
  Wallet,
  Award,
  Download,
  CheckCircle2,
  Search,
  X,
  Gift,
  AlertCircle,
} from 'lucide-react';

export const ClubView: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [walletConfigured, setWalletConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [localFilter, setLocalFilter] = useState('ALL');
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(-1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const canModify =
    user?.role === 'owner' || user?.role === 'manager' || user?.role === 'superadmin';

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [cfg, mems, walletSt, locs] = await Promise.all([
        api.getClubConfig(),
        api.listMembers(),
        api.getWalletStatus(),
        api.listLocals(),
      ]);
      setConfig(cfg);
      setMembers(mems);
      setWalletConfigured(walletSt.configured);
      setLocals(locs);
      if (selectedMember) {
        setSelectedMember(mems.find((m) => m.id === selectedMember.id) || null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [searchParams]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      const updated = await api.updateClubConfig(config);
      setConfig(updated);
      showToast('Configuración del Club guardada', 'success');
    } catch {
      showToast('Error al guardar la configuración', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjustMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setAdjustError('');

    if (!canModify) {
      setAdjustError('Solo dueños y encargados pueden anular o ajustar sellos.');
      return;
    }
    if (adjustReason.trim().length < 10) {
      setAdjustError('Escribí un motivo obligatorio de al menos 10 caracteres.');
      return;
    }

    setSubmittingAdjust(true);
    try {
      if (adjustDelta === -1) {
        await api.voidStamp({
          stampId: `stamp-${Date.now()}`,
          memberId: selectedMember.id,
          reason: adjustReason.trim(),
        });
      } else {
        await api.adjustBalance({
          memberId: selectedMember.id,
          delta: adjustDelta,
          reason: adjustReason.trim(),
        });
      }
      setAdjustReason('');
      showToast('Corrección registrada en el historial', 'success');
      await loadAll();
    } catch (err: any) {
      setAdjustError(err?.message || 'No se pudo aplicar el ajuste.');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csvContent = await api.exportClubMembersCsv();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `miembros-club-toque-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Archivo CSV descargado', 'success');
    } catch {
      showToast('Error al exportar CSV', 'error');
    }
  };

  if (isLoading || !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56 bg-[#111113]" />
        <Skeleton className="h-64 w-full bg-[#111113]" />
      </div>
    );
  }

  const targetStamps = config.targetStamps || 10;

  const filteredMembers = members.filter((m) => {
    if (localFilter !== 'ALL' && m.localCode !== localFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (m.name || '').toLowerCase().includes(q);
      const matchMail = (m.maskedEmail || m.contact || '').toLowerCase().includes(q);
      return matchName || matchMail;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="block text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold mb-1">
            FIDELIZACIÓN + PASES DIGITALES WALLET
          </span>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Club del Negocio & Clientes
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Tus clientes suman sellos en cada visita y guardan su tarjeta en el celular.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-[#111113] border border-[#242426] flex items-center gap-2 text-xs">
            <Wallet className="w-4 h-4 text-[#34d399]" />
            <span className="text-[#a1a1aa]">Wallet:</span>
            <span className="font-bold text-[#34d399]">
              {walletConfigured ? 'Conectada' : 'Disponible al conectar servidor'}
            </span>
          </div>
          {members.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar CSV ({members.length})
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <h2 className="text-base font-bold text-[#f1f1ee] mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#bec8ff]" />
              <span>Reglas y Diseño de Tarjeta</span>
            </h2>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#242426]">
                <span className="text-sm font-medium text-[#f1f1ee]">Club Activo</span>
                <input
                  type="checkbox"
                  checked={Boolean(config.enabled ?? config.active)}
                  onChange={(e) =>
                    setConfig({ ...config, enabled: e.target.checked, active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-[#28282a] text-[#bec8ff] focus:ring-[#bec8ff]"
                />
              </div>

              <Input
                label="Nombre de tu programa"
                value={config.name || config.clubName || ''}
                onChange={(e) =>
                  setConfig({ ...config, name: e.target.value, clubName: e.target.value })
                }
                placeholder="Ej: Club Café La Esquina"
                required
              />

              <Input
                label="Premio al completar la tarjeta"
                value={config.rewardText || config.welcomeBenefitText || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rewardText: e.target.value,
                    welcomeBenefitText: e.target.value,
                  })
                }
                placeholder="Ej: 1 Café + Medialuna sin cargo"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Sellos para el premio"
                  type="number"
                  min={3}
                  max={20}
                  value={config.targetStamps || 10}
                  onChange={(e) =>
                    setConfig({ ...config, targetStamps: Number(e.target.value) || 10 })
                  }
                  required
                />

                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                    Color de tarjeta
                  </label>
                  <input
                    type="color"
                    value={config.brandColor || '#3A3FE0'}
                    onChange={(e) => setConfig({ ...config, brandColor: e.target.value })}
                    className="w-full h-10 rounded-xl bg-[#18181b] border border-[#28282a] p-1 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Modo de suma de sellos
                </label>
                <select
                  value={config.mode || 'per_visit'}
                  onChange={(e) =>
                    setConfig({ ...config, mode: e.target.value as 'per_visit' | 'per_amount' })
                  }
                  className="w-full bg-[#18181b] border border-[#28282a] rounded-xl px-3 py-2.5 text-xs font-semibold text-[#f1f1ee]"
                >
                  <option value="per_visit">1 sello por visita</option>
                  <option value="per_amount">Por monto de compra ($)</option>
                </select>
              </div>

              {config.mode === 'per_amount' && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="1 sello cada ($)"
                    type="number"
                    min={100}
                    value={config.amountPerStamp || 4000}
                    onChange={(e) =>
                      setConfig({ ...config, amountPerStamp: Number(e.target.value) || 4000 })
                    }
                  />
                  <Input
                    label="Tope por visita"
                    type="number"
                    min={1}
                    max={20}
                    value={config.maxStampsPerVisit || 3}
                    onChange={(e) =>
                      setConfig({ ...config, maxStampsPerVisit: Number(e.target.value) || 3 })
                    }
                  />
                </div>
              )}

              <div className="pt-2 border-t border-[#242426] space-y-2 text-xs text-[#a1a1aa]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.allowCashierScan)}
                    onChange={(e) => setConfig({ ...config, allowCashierScan: e.target.checked })}
                    className="rounded border-[#28282a]"
                  />
                  <span>Escanea el comercio (cajero)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.allowSelfScan)}
                    onChange={(e) => setConfig({ ...config, allowSelfScan: e.target.checked })}
                    className="rounded border-[#28282a]"
                  />
                  <span>Escanea el cliente (máx. 1 por día)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.rotatingQrEnabled)}
                    onChange={(e) =>
                      setConfig({ ...config, rotatingQrEnabled: e.target.checked })
                    }
                    className="rounded border-[#28282a]"
                  />
                  <span>QR de mostrador rotativo (cada 30s)</span>
                </label>
              </div>

              <Button type="submit" fullWidth isLoading={isSaving}>
                Guardar reglas del Club
              </Button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-[#242426] bg-[#141416] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#f1f1ee]">
                  Clientes adheridos ({filteredMembers.length})
                </h2>
                <span className="text-xs text-[#a1a1aa]">
                  Mail parcialmente oculto y cumpleaños (día/mes)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="bg-[#111113] border border-[#28282a] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
                <select
                  value={localFilter}
                  onChange={(e) => setLocalFilter(e.target.value)}
                  aria-label="Filtrar por local"
                  className="bg-[#111113] border border-[#28282a] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#f1f1ee]"
                >
                  <option value="ALL">Todos los locales</option>
                  {locals.map((loc) => (
                    <option key={loc.id} value={loc.code}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredMembers.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon="🪪"
                  title="Todavía no hay socios registrados"
                  description="Cuando un cliente active su tarjeta en /club/:codigoLocal aparecerá en esta tabla."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#242426] bg-[#111113] text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
                      <th className="py-3 px-4">Cliente / Mail protegido</th>
                      <th className="py-3 px-4">Cumpleaños</th>
                      <th className="py-3 px-4">Sellos</th>
                      <th className="py-3 px-4">Alta</th>
                      <th className="py-3 px-4 text-right">Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242426] text-sm">
                    {filteredMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-[#18181b]/60">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#f1f1ee] flex items-center gap-2">
                            <span>{m.name || 'Cliente sin datos'}</span>
                            {m.anonymous && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#18181b] border border-[#28282a] text-[#a1a1aa]">
                                Sin datos
                              </span>
                            )}
                            {m.isSample && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#bec8ff]/15 text-[#bec8ff]">
                                Ejemplo
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#a1a1aa] font-mono">
                            {m.maskedEmail || 'Sin mail'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#a1a1aa]">
                          {m.birthDay && m.birthMonth
                            ? `${String(m.birthDay).padStart(2, '0')}/${String(m.birthMonth).padStart(2, '0')}`
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#bec8ff]/15 text-[#bec8ff] border border-[#bec8ff]/30">
                            {m.stamps} / {targetStamps} sellos
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#a1a1aa]">
                          {formatDate(m.joinedAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="secundario"
                            size="sm"
                            onClick={() => {
                              setSelectedMember(m);
                              setAdjustError('');
                            }}
                          >
                            Ver ficha
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal con ficha del cliente e historial + ajuste con motivo obligatorio */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#242426] pb-3">
              <div>
                <h2 className="font-bold text-base text-[#f1f1ee]">
                  {selectedMember.name || 'Cliente sin datos'}
                </h2>
                <p className="text-xs text-[#a1a1aa] font-mono">
                  {selectedMember.maskedEmail} · Cumpleaños:{' '}
                  {selectedMember.birthDay && selectedMember.birthMonth
                    ? `${selectedMember.birthDay}/${selectedMember.birthMonth}`
                    : 'No informado'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-[#18181b] border border-[#28282a]">
                <div className="text-xl font-bold text-[#f1f1ee]">
                  {selectedMember.stamps} / {targetStamps}
                </div>
                <div className="text-[11px] text-[#a1a1aa]">Sellos actuales</div>
              </div>
              <div className="p-3 rounded-xl bg-[#18181b] border border-[#28282a]">
                <div className="text-xl font-bold text-[#f1f1ee]">
                  {(selectedMember.stampHistory || []).length}
                </div>
                <div className="text-[11px] text-[#a1a1aa]">Movimientos</div>
              </div>
              <div className="p-3 rounded-xl bg-[#18181b] border border-[#28282a]">
                <div className="text-xl font-bold text-[#34d399]">
                  {selectedMember.rewardsRedeemed || 0}
                </div>
                <div className="text-[11px] text-[#a1a1aa]">Premios</div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-[#f1f1ee]">Historial de sellos</p>
              {(selectedMember.stampHistory || []).length === 0 ? (
                <p className="text-xs text-[#a1a1aa]">Sin movimientos registrados.</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {(selectedMember.stampHistory || []).map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#f1f1ee]">
                          {h.count > 0 ? `+${h.count}` : h.count} sello(s)
                        </span>{' '}
                        <span className="text-[#a1a1aa]">· {h.localName}</span>
                        {h.voidReason && (
                          <span className="block text-[11px] text-[#a1a1aa]">
                            Motivo: {h.voidReason}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#a1a1aa]">{formatDate(h.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={handleAdjustMember}
              className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-[#f1f1ee]">
                <Gift className="w-4 h-4 text-[#bec8ff]" />
                <span>Anular sello o ajustar saldo (queda en Correcciones)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[#a1a1aa] mb-1">Sellos (+/-)</label>
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(parseInt(e.target.value || '-1', 10))}
                    className="w-full bg-[#111113] border border-[#28282a] rounded-xl px-3 py-2 text-xs font-bold text-[#f1f1ee]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-[#a1a1aa] mb-1">
                    Motivo obligatorio (mín. 10 caracteres)
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ej: Error de carga en mostrador"
                    className="w-full bg-[#111113] border border-[#28282a] rounded-xl px-3 py-2 text-xs text-[#f1f1ee]"
                  />
                </div>
              </div>

              {adjustError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{adjustError}</span>
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="ultramar"
                  size="sm"
                  loading={submittingAdjust}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Confirmar ajuste
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
