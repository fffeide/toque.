import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ClubConfig, ClubMember, ClubLocal } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Users,
  Download,
  Search,
  QrCode,
  Gift,
  Plus,
  Sliders,
  X,
  Check,
  Palette,
} from 'lucide-react';

export const ClubView: React.FC = () => {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLocalId, setSelectedLocalId] = useState('all');

  // Configuración de tarjeta
  const [savingConfig, setSavingConfig] = useState(false);
  const [rewardText, setRewardText] = useState('');
  const [brandColor, setBrandColor] = useState('#1e1b4b');
  const [howToEarn, setHowToEarn] = useState('1 sello por visita o compra');

  // Modal de Ajuste Manual (con motivo obligatorio >= 10 caracteres)
  const [adjustTarget, setAdjustTarget] = useState<ClubMember | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cfg, mems, locs] = await Promise.all([
        api.getClubConfig(),
        api.listMembers(),
        api.listLocals(),
      ]);
      setConfig(cfg);
      setMembers(mems);
      setLocals(locs);
      setRewardText(
        cfg.loyaltyReward || cfg.rewardText || 'Beneficio exclusivo en instrumentos y accesorios'
      );
      setBrandColor(cfg.cardThemeColor || cfg.brandColor || '#1e1b4b');
      setHowToEarn(cfg.howToEarn || '1 sello por visita o compra');
    } catch (err: any) {
      showToast(err?.message || 'Error al cargar clientes del Club', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportMembersCsv = async () => {
    try {
      const csv = await api.exportClubMembersCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'socios-club-toque.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Listado de socios descargado en CSV', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al exportar socios', 'error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const updated = await api.updateClubConfig({
        rewardText: rewardText.trim(),
        loyaltyReward: rewardText.trim(),
        brandColor,
        cardThemeColor: brandColor,
        howToEarn: howToEarn.trim(),
      });
      setConfig(updated);
      showToast('Configuración de la tarjeta guardada', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar configuración', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    try {
      setSubmittingAdjust(true);
      const res = await api.adjustBalance({
        memberId: adjustTarget.id,
        delta: adjustDelta,
        reason: adjustReason,
      });
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setAdjustTarget(null);
      setAdjustReason('');
      showToast('Saldo de sellos ajustado y registrado en Correcciones', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al ajustar sellos', 'error');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl bg-[#111113]" />
        <Skeleton className="h-80 rounded-2xl bg-[#111113]" />
      </div>
    );
  }

  const filteredMembers = members.filter((m) => {
    if (selectedLocalId !== 'all' && m.localId !== selectedLocalId) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.memberCode || '').toLowerCase().includes(q) ||
      (m.maskedEmail || m.contact || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee]">Clientes y Tarjeta de Sellos</h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Socios registrados en tu programa de fidelización y ajustes de tu tarjeta.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportMembersCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-semibold text-[#f1f1ee] cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#bec8ff]" />
            <span>Exportar Socios CSV</span>
          </button>

          <Link
            to="/panel/escanear"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2fb36a] hover:bg-[#269a59] text-[#08120c] font-bold text-xs"
          >
            <QrCode className="w-4 h-4" />
            <span>Sumar Sello en Mostrador</span>
          </Link>
        </div>
      </div>

      {/* Configuración Rápida de la Tarjeta */}
      <form
        onSubmit={handleSaveConfig}
        className="rounded-2xl bg-[#111113] border border-[#242426] p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-[#f1f1ee]">
          <Palette className="w-4 h-4 text-[#bec8ff]" />
          <span>Configuración de la Tarjeta de 10 Sellos</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1">
              Premio al juntar 10 sellos
            </label>
            <input
              type="text"
              value={rewardText}
              onChange={(e) => setRewardText(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1">
              Regla de acumulación
            </label>
            <input
              type="text"
              value={howToEarn}
              onChange={(e) => setHowToEarn(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1">
              Color de fondo (Hex)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-10 h-9 rounded-lg bg-transparent border border-[#28282a] cursor-pointer"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs font-mono text-[#f1f1ee]"
              />
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-2 rounded-xl bg-[#bec8ff] text-[#0c0c0c] font-bold text-xs cursor-pointer"
              >
                {savingConfig ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Buscador y filtro por local */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar socio por código (ej. MM-1234), nombre o correo parcial..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111113] border border-[#242426] text-sm text-[#f1f1ee]"
          />
        </div>

        <select
          value={selectedLocalId}
          onChange={(e) => setSelectedLocalId(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-[#111113] border border-[#242426] text-xs font-semibold text-[#f1f1ee]"
        >
          <option value="all">Todos los locales</option>
          {locals.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.code})
            </option>
          ))}
        </select>
      </div>

      {/* Tabla de Socios */}
      <div className="rounded-2xl bg-[#111113] border border-[#242426] overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Users className="w-8 h-8 text-[#a1a1aa] mx-auto" />
            <p className="text-sm font-bold text-[#f1f1ee]">
              Todavía no hay socios registrados en este período
            </p>
            <p className="text-xs text-[#a1a1aa] max-w-md mx-auto">
              Cuando tus clientes escaneen el Cartel QR de mostrador o ingresen a tu enlace público,
              aparecerán aquí automáticamente en tiempo real.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#242426] bg-[#161619] text-[#a1a1aa]">
                  <th className="py-3 px-4 font-semibold">Código</th>
                  <th className="py-3 px-4 font-semibold">Socio</th>
                  <th className="py-3 px-4 font-semibold">Correo (Protegido)</th>
                  <th className="py-3 px-4 font-semibold">Sellos</th>
                  <th className="py-3 px-4 font-semibold">Premios</th>
                  <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e22]">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-[#18181b]/60">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#bec8ff]">
                      {m.memberCode || m.id.slice(0, 7).toUpperCase()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#f1f1ee]">
                      {m.name || 'Socio'}
                    </td>
                    <td className="py-3.5 px-4 text-[#a1a1aa]">
                      {m.maskedEmail || m.contact}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#bec8ff]/15 text-[#bec8ff] font-bold">
                        <Check className="w-3 h-3" />
                        {m.stamps} / {m.targetStamps || 10}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[#2fb36a] font-bold">
                        <Gift className="w-3.5 h-3.5" />
                        {m.rewardsRedeemed || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustTarget(m);
                          setAdjustDelta(1);
                          setAdjustReason('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-semibold text-[#f1f1ee] cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-[#bec8ff]" />
                        <span>Ajustar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ajuste Manual Auditable */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#111113] border border-[#28282c] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#f1f1ee]">
                Ajustar sellos de {adjustTarget.name || adjustTarget.memberCode}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1 text-[#a1a1aa] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#f1f1ee] mb-1">
                  Cantidad de sellos a sumar o descontar (ej. 1 o -1)
                </label>
                <input
                  type="number"
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#2c2c30] text-sm text-[#f1f1ee]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#f1f1ee] mb-1">
                  Motivo obligatorio (mínimo 10 caracteres para el registro de Correcciones)
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Explicá por qué se realiza este ajuste manual..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#2c2c30] text-xs text-[#f1f1ee]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 rounded-xl bg-[#18181b] text-xs font-semibold text-[#a1a1aa] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="px-4 py-2 rounded-xl bg-[#2fb36a] text-[#08120c] text-xs font-bold cursor-pointer"
                >
                  {submittingAdjust ? 'Guardando...' : 'Confirmar ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
