import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { ClubMember, ClubConfig, ClubLocal } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import {
  QrCode,
  Search,
  CheckCircle2,
  Gift,
  Plus,
  Store,
  Check,
  UserCheck,
} from 'lucide-react';

export const ClubScannerView: React.FC = () => {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [amountArs, setAmountArs] = useState('');
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadScannerContext = async () => {
    try {
      const [cfg, locs, mems] = await Promise.all([
        api.getClubConfig(),
        api.listLocals(),
        api.listMembers(),
      ]);
      setConfig(cfg);
      setLocals(locs);
      setMembers(mems);
      if (locs[0] && !selectedLocalId) {
        setSelectedLocalId(locs[0].id);
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al cargar escáner', 'error');
    }
  };

  useEffect(() => {
    loadScannerContext();
  }, []);

  const handleFindMember = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;

    const found = members.find(
      (m) =>
        m.id.toLowerCase() === q ||
        (m.memberCode || '').toLowerCase() === q ||
        (m.email || '').toLowerCase() === q ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.maskedEmail || m.contact || '').toLowerCase().includes(q)
    );

    if (found) {
      setSelectedMember(found);
    } else {
      showToast(
        'No encontramos un socio con ese código o correo. Pedile que active su tarjeta escaneando el cartel del mostrador.',
        'error'
      );
    }
  };

  const handleAddStamp = async () => {
    const targetQuery = selectedMember?.id || query.trim();
    if (!targetQuery) {
      showToast('Ingresá el código o correo del socio primero.', 'error');
      return;
    }

    try {
      setProcessing(true);
      const res = await api.addStampByCashier({
        memberId: selectedMember?.id,
        email: !selectedMember ? query.trim() : undefined,
        localId: selectedLocalId || locals[0]?.id,
        amount: amountArs ? Number(amountArs) : undefined,
      });
      setSelectedMember(res.member);
      await loadScannerContext();
      showToast(
        res.rewardReady
          ? `¡Se sumó ${res.stampsAdded} sello(s) y el cliente completó los 10 sellos para su premio!`
          : `¡Se sumó +${res.stampsAdded} sello a ${res.member.name || res.member.memberCode}!`,
        'success'
      );
      setAmountArs('');
    } catch (err: any) {
      showToast(err?.message || 'Error al sumar sello', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleRedeemReward = async () => {
    if (!selectedMember) return;
    try {
      setProcessing(true);
      const res = await api.redeemReward(selectedMember.id);
      setSelectedMember(res.member);
      await loadScannerContext();
      showToast('¡Premio canjeado con éxito! El contador se reinició para una nueva tarjeta.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Todavía no alcanza los sellos requeridos', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const targetStamps = selectedMember?.targetStamps || config?.targetStamps || 10;
  const canRedeem = selectedMember && selectedMember.stamps >= targetStamps;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee]">Escanear y Sumar Sellos</h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Ingresá el código de la tarjeta del socio (ej. <code className="text-[#bec8ff]">MM-1234</code>) o su correo electrónico.
          </p>
        </div>

        {locals.length > 0 && (
          <div className="flex items-center gap-2 bg-[#111113] border border-[#242426] rounded-xl px-3 py-2">
            <Store className="w-4 h-4 text-[#bec8ff]" />
            <select
              value={selectedLocalId}
              onChange={(e) => setSelectedLocalId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#f1f1ee] focus:outline-none"
            >
              {locals.map((l) => (
                <option key={l.id} value={l.id} className="bg-[#111113]">
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Buscador de Socio / Lector de Código */}
      <div className="rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-4">
        <form onSubmit={handleFindMember} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Código QR del cliente (ej. MM-4821) o correo electrónico..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none focus:border-[#bec8ff]"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-[#bec8ff] hover:bg-[#a9b6ff] text-[#0c0c0c] font-bold text-xs transition-colors cursor-pointer shrink-0"
          >
            Buscar Socio
          </button>
        </form>

        {/* Si hay socios registrados recientemente, permitir seleccionarlos con 1 toque */}
        {members.length > 0 && (
          <div className="pt-2 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Socios recientes en el local
            </span>
            <div className="flex flex-wrap gap-2">
              {members.slice(0, 6).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMember(m);
                    setQuery(m.memberCode || m.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                    selectedMember?.id === m.id
                      ? 'bg-[#bec8ff]/20 border-[#bec8ff] text-[#f1f1ee]'
                      : 'bg-[#18181b] border-[#28282a] text-[#a1a1aa] hover:text-[#f1f1ee]'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#2fb36a]" />
                  <span>{m.name || m.maskedEmail}</span>
                  <span className="font-mono text-[10px] text-[#bec8ff]">
                    ({m.stamps}/{m.targetStamps || 10})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ficha del Socio Seleccionado para Sumar Sello o Canjear Premio */}
      {selectedMember && (
        <div className="rounded-3xl bg-[#111113] border-2 border-[#bec8ff]/40 p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono font-bold text-[#bec8ff]">
                {selectedMember.memberCode || selectedMember.id}
              </span>
              <h2 className="text-lg font-bold text-[#f1f1ee]">
                {selectedMember.name || 'Socio del Club'}
              </h2>
              <p className="text-xs text-[#a1a1aa]">{selectedMember.maskedEmail || selectedMember.contact}</p>
            </div>

            <div className="text-right">
              <span className="block text-[10px] uppercase tracking-wider text-[#a1a1aa]">
                Sellos actuales
              </span>
              <span className="text-3xl font-extrabold text-[#f1f1ee]">
                {selectedMember.stamps} / {targetStamps}
              </span>
            </div>
          </div>

          {/* Grilla visual de los 10 sellos del cliente */}
          <div className="grid grid-cols-5 gap-2 p-4 rounded-2xl bg-[#18181b] border border-[#242426]">
            {Array.from({ length: 10 }).map((_, idx) => {
              const slot = idx + 1;
              const earned = slot <= selectedMember.stamps;
              return (
                <div
                  key={slot}
                  className={`h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                    earned
                      ? 'bg-[#2fb36a] text-[#07150d]'
                      : 'bg-[#111113] border border-[#2c2c30] text-[#71717a]'
                  }`}
                >
                  {earned ? <Check className="w-4 h-4 stroke-[3]" /> : slot}
                </div>
              );
            })}
          </div>

          {config?.mode === 'per_amount' && (
            <div>
              <label className="block text-xs font-medium text-[#f1f1ee] mb-1">
                Monto del ticket (ARS)
              </label>
              <input
                type="number"
                value={amountArs}
                onChange={(e) => setAmountArs(e.target.value)}
                placeholder="Ej: 15000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#2c2c30] text-sm text-[#f1f1ee]"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={processing}
              onClick={handleAddStamp}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#2fb36a] hover:bg-[#269a59] text-[#07150d] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{processing ? 'Procesando...' : 'Sumar +1 Sello'}</span>
            </button>

            <button
              type="button"
              disabled={processing || !canRedeem}
              onClick={handleRedeemReward}
              className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                canRedeem
                  ? 'bg-[#bec8ff] hover:bg-[#a9b6ff] text-[#0c0c0c]'
                  : 'bg-[#18181b] border border-[#28282a] text-[#71717a] cursor-not-allowed'
              }`}
            >
              <Gift className="w-4 h-4" />
              <span>Canjear Premio (10 sellos)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
