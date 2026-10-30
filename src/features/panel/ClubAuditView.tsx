import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { AuditLogEntry, ClubMember } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ShieldAlert, Download, Filter, PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ClubAuditView: React.FC = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState('ALL');
  const [filterDays, setFilterDays] = useState<'ALL' | '7' | '30'>('ALL');

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [actionType, setActionType] = useState<'ANULAR_SELLO' | 'AJUSTE_SALDO'>('ANULAR_SELLO');
  const [delta, setDelta] = useState<number>(-1);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canModify =
    user?.role === 'owner' || user?.role === 'manager' || user?.role === 'superadmin';
  const isOwner =
    user?.role === 'owner' || user?.role === 'superadmin' || Boolean(user?.isSuperAdmin);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportReason, setExportReason] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [auditList, memberList] = await Promise.all([
        api.listAuditLog(),
        api.listMembers(),
      ]);
      setEntries(auditList);
      setMembers(memberList);
      if (memberList.length > 0 && !selectedMemberId) {
        setSelectedMemberId(memberList[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const actors = Array.from(new Set(entries.map((e) => e.actorName)));

  const filteredEntries = entries.filter((entry) => {
    if (filterActor !== 'ALL' && entry.actorName !== filterActor) return false;
    if (filterDays !== 'ALL') {
      const daysMs = parseInt(filterDays, 10) * 86400000;
      if (Date.now() - new Date(entry.createdAt).getTime() > daysMs) return false;
    }
    return true;
  });

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!canModify) {
      setErrorMsg('El cajero no puede anular ni ajustar. Pedile a un encargado o dueño.');
      return;
    }

    if (reason.trim().length < 10) {
      setErrorMsg('El motivo es obligatorio y debe tener al menos 10 caracteres.');
      return;
    }

    if (!selectedMemberId) {
      setErrorMsg('Elegí un cliente de la lista.');
      return;
    }

    setSubmitting(true);
    try {
      if (actionType === 'ANULAR_SELLO') {
        await api.voidStamp({
          stampId: `stamp-${Date.now()}`,
          memberId: selectedMemberId,
          reason: reason.trim(),
        });
      } else {
        await api.adjustBalance({
          memberId: selectedMemberId,
          delta,
          reason: reason.trim(),
        });
      }
      setReason('');
      setSuccessMsg('Corrección registrada en la lista de correcciones.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo registrar la corrección.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    if (exportReason.trim().length < 10) {
      setErrorMsg('El motivo para exportar debe tener al menos 10 caracteres.');
      return;
    }
    setExportingCsv(true);
    try {
      const csvContent = await api.exportStampLogsCsv('all', exportReason.trim());
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `correcciones-toque-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      setExportReason('');
      setSuccessMsg('Exportación descargada y registrada en la lista de correcciones.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo exportar el archivo CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Encabezado fijo obligatorio */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#f1f1ee]">
              Correcciones (registro de cambios)
            </h1>
            <p className="text-sm text-[#a1a1aa] leading-relaxed">
              Toda acción de anular, ajustar, exportar o borrar pide un motivo y queda registrada acá: quién, cuándo y por qué. No se puede editar ni borrar.
            </p>
          </div>
        </div>
      </Card>

      {/* Formulario para registrar una anulación o ajuste (solo dueño / encargado) */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold text-[#f1f1ee] flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-[#bec8ff]" />
            Anular sello o ajustar saldo de un cliente
          </h2>
          {!canModify && (
            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
              Solo dueños y encargados pueden hacer correcciones
            </span>
          )}
        </div>

        <p className="text-xs text-[#a1a1aa]">
          Para anular un sello o ajustar un saldo hay que escribir el motivo. Así cualquier corrección queda explicada.
        </p>

        {canModify ? (
          <form onSubmit={handleApplyAdjustment} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                Cliente
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full min-h-[48px] px-3 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm font-medium focus:outline-none focus:border-[#bec8ff]"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || 'Cliente'} ({m.stamps} sellos)
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                Tipo de corrección
              </label>
              <select
                value={actionType}
                onChange={(e) => {
                  const next = e.target.value as 'ANULAR_SELLO' | 'AJUSTE_SALDO';
                  setActionType(next);
                  if (next === 'ANULAR_SELLO') setDelta(-1);
                }}
                className="w-full min-h-[48px] px-3 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm font-medium focus:outline-none focus:border-[#bec8ff]"
              >
                <option value="ANULAR_SELLO">Anular 1 sello (-1)</option>
                <option value="AJUSTE_SALDO">Ajustar saldo manual</option>
              </select>
            </div>

            {actionType === 'AJUSTE_SALDO' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                  Sellos (+/-)
                </label>
                <input
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(parseInt(e.target.value || '0', 10))}
                  className="w-full min-h-[48px] px-3 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm font-bold focus:outline-none focus:border-[#bec8ff]"
                />
              </div>
            )}

            <div className={actionType === 'AJUSTE_SALDO' ? 'md:col-span-4' : 'md:col-span-6'}>
              <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                Motivo obligatorio (mínimo 10 caracteres)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Se cargó dos veces el mismo ticket por error"
                className="w-full min-h-[48px] px-3 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm focus:outline-none focus:border-[#bec8ff]"
              />
            </div>

            <div className="md:col-span-12 flex items-center justify-between flex-wrap gap-3 pt-1">
              <span className="text-xs text-[#a1a1aa]">
                Caracteres del motivo: <strong className="text-[#f1f1ee]">{reason.trim().length}</strong> / 10 mínimo
              </span>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Confirmar corrección'}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-[#a1a1aa]">
            Tu cuenta tiene rol de Cajero. Solo encargados y dueños pueden registrar correcciones.
          </p>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#2fb36a]/10 border border-[#2fb36a]/30 text-[#2fb36a] text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </Card>

      {/* Filtros y exportar (solo dueño puede exportar) */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#f1f1ee]">
            <Filter className="w-4 h-4 text-[#bec8ff]" />
            <span>Filtrar:</span>
          </div>
          <select
            value={filterDays}
            onChange={(e) => setFilterDays(e.target.value as any)}
            aria-label="Filtrar por fecha"
            className="min-h-[48px] px-3 rounded-xl border border-[#28282a] bg-[#18181b] text-sm font-medium text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
          >
            <option value="ALL">Todas las fechas</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
          </select>

          <select
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            aria-label="Filtrar por persona"
            className="min-h-[48px] px-3 rounded-xl border border-[#28282a] bg-[#18181b] text-sm font-medium text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
          >
            <option value="ALL">Todas las personas</option>
            {actors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>
        </div>

        {isOwner && (
          <Button
            variant="secondary"
            onClick={() => {
              setExportReason('');
              setShowExportModal(true);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        )}
      </Card>

      {/* Modal para pedir motivo antes de exportar CSV */}
      {showExportModal && isOwner && (
        <Card className="p-5 border border-[#D95B26]/50 space-y-4">
          <h3 className="text-base font-bold text-[#f1f1ee]">
            Motivo para exportar el historial en CSV
          </h3>
          <form onSubmit={handleExportCsvSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              minLength={10}
              value={exportReason}
              onChange={(e) => setExportReason(e.target.value)}
              placeholder="Ej: Control contable de fin de mes (mínimo 10 caracteres)"
              className="flex-1 min-h-[48px] px-3 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowExportModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={exportingCsv}>
                {exportingCsv ? 'Exportando...' : 'Confirmar y descargar'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabla de solo lectura */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-[#a1a1aa]">Cargando registro...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-[#a1a1aa]">
            No hay correcciones registradas con ese filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#242426] bg-[#18181b]/50 text-xs font-bold text-[#a1a1aa]">
                  <th className="py-3.5 px-6">Fecha y hora</th>
                  <th className="py-3.5 px-6">Quién lo hizo</th>
                  <th className="py-3.5 px-6">Acción</th>
                  <th className="py-3.5 px-6">Detalle / Cliente</th>
                  <th className="py-3.5 px-6">Cambio</th>
                  <th className="py-3.5 px-6">Motivo declarado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242426] text-sm">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#18181b]/40 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap font-medium text-[#f1f1ee]">
                      {new Date(entry.createdAt).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-[#f1f1ee]">{entry.actorName}</div>
                      <div className="text-xs text-[#a1a1aa]">
                        {entry.actorRole}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-[#f1f1ee]">
                      {entry.actionLabel}
                    </td>
                    <td className="py-4 px-6 font-medium text-[#f1f1ee]">
                      {entry.memberName}
                    </td>
                    <td className="py-4 px-6 font-bold">
                      {entry.delta === 0 ? (
                        <span className="text-[#a1a1aa]">—</span>
                      ) : (
                        <span
                          className={
                            entry.delta < 0
                              ? 'text-[#ef4444]'
                              : 'text-[#2fb36a]'
                          }
                        >
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta} sellos
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-[#a1a1aa] max-w-md">
                      {entry.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
