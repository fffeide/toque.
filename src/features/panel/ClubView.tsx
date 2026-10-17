import React, { useState, useEffect } from 'react';
import { api, ClubConfig, ClubMember, ClubReward } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/formatters';
import {
  Award,
  Plus,
  Trash2,
  Users,
  Check,
  Sparkles,
  Save,
} from 'lucide-react';

export const ClubView: React.FC = () => {
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { success, error: toastError } = useToast();

  // Formulario de nuevo premio
  const [newRewardLabel, setNewRewardLabel] = useState('');
  const [newRewardTarget, setNewRewardTarget] = useState('5');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cfg, mems] = await Promise.all([
        api.getClubConfig(),
        api.listClubMembers(),
      ]);
      setConfig(cfg);
      setMembers(mems);
    } catch {
      // Ignorar
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await api.updateClubConfig(config);
      success('Programa de fidelidad guardado', 'La configuración del Club se actualizó.');
    } catch (err) {
      toastError('Error al guardar Club', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddReward = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(newRewardTarget, 10);
    if (!newRewardLabel.trim() || isNaN(target) || target <= 0 || !config) return;

    const newRew: ClubReward = {
      id: `rew-${Date.now()}`,
      label: newRewardLabel.trim(),
      target,
    };

    setConfig({
      ...config,
      rewards: [...config.rewards, newRew],
    });
    setNewRewardLabel('');
    setNewRewardTarget('5');
  };

  const handleRemoveReward = (id: string) => {
    if (!config) return;
    setConfig({
      ...config,
      rewards: config.rewards.filter(r => r.id !== id),
    });
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm('¿Eliminar a este socio del Club? Se borrarán sus puntos acumulados.')) return;
    try {
      await api.deleteClubMember(id);
      success('Socio eliminado');
      loadData();
    } catch {
      toastError('Error al borrar socio');
    }
  };

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-white/10" />
        <Skeleton className="h-44 w-full rounded-2xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Club
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Fidelizá a tus clientes con sellos y beneficios digitales sin papel ni tarjetas físicas.
          </p>
        </div>

        <Button
          variant="estrella"
          size="touch"
          onClick={handleSaveConfig}
          disabled={isSaving}
          icon={<Save className="w-4 h-4 text-[#0B1030]" />}
        >
          {isSaving ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Reglas y Premios (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/15">
              <h2 className="font-display font-bold text-base text-white">
                Programa y Regla de Acumulación
              </h2>
              <button
                type="button"
                onClick={() => setConfig({ ...config, active: !config.active })}
                className={`text-xs px-3 py-1 rounded-full font-bold transition cursor-pointer border ${
                  config.active
                    ? 'bg-[#19C37D]/20 text-[#19C37D] border-[#19C37D]/40'
                    : 'bg-white/10 text-white/60 border-white/15'
                }`}
              >
                {config.active ? 'Club Activo' : 'Pausado'}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-white/80 font-semibold mb-1" htmlFor="clubTitle">
                  Nombre del programa
                </label>
                <input
                  id="clubTitle"
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="Ej. Club La Esquina"
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/40 text-sm focus:bg-white/15 focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-white/80 font-semibold mb-2">
                  Forma de sumar puntos
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfig({
                      ...config,
                      rule: { type: 'per_visit', value: 1 },
                    })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      config.rule.type === 'per_visit'
                        ? 'bg-white/15 border-white/30 text-white font-bold shadow-xs'
                        : 'bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="block text-xs text-white">1 Sello por visita</span>
                    <span className="block text-[10px] font-normal text-white/60 mt-0.5">Al apoyar el celular</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({
                      ...config,
                      rule: { type: 'per_amount', value: 1000 },
                    })}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      config.rule.type === 'per_amount'
                        ? 'bg-white/15 border-white/30 text-white font-bold shadow-xs'
                        : 'bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="block text-xs text-white">Puntos por importe</span>
                    <span className="block text-[10px] font-normal text-white/60 mt-0.5">1 punto cada $1.000</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Premios y Metas */}
          <Card className="space-y-4">
            <h2 className="font-display font-bold text-base text-white">
              Premios configurados
            </h2>

            <div className="space-y-2">
              {config.rewards.map((rew) => (
                <div
                  key={rew.id}
                  className="p-3 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-between text-xs text-white"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-bold text-[#FFC21A]">
                      {rew.target}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{rew.label}</p>
                      <p className="text-[10px] text-white/60">
                        Requiere {rew.target} {config.rule.type === 'per_visit' ? 'sellos' : 'puntos'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveReward(rew.id)}
                    className="text-[#FF6B6B] p-1.5 hover:bg-white/10 rounded-lg transition"
                    title="Eliminar premio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddReward} className="pt-2 border-t border-white/15 space-y-2 text-xs">
              <span className="font-semibold text-white block">Agregar nuevo beneficio</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newRewardLabel}
                  onChange={(e) => setNewRewardLabel(e.target.value)}
                  placeholder="Premio (ej. Porción de torta)"
                  className="flex-1 px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/40 focus:bg-white/15 focus:outline-none"
                />
                <input
                  type="number"
                  required
                  min={1}
                  value={newRewardTarget}
                  onChange={(e) => setNewRewardTarget(e.target.value)}
                  placeholder="Sellos"
                  className="w-20 px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-center focus:bg-white/15 focus:outline-none"
                />
                <Button type="submit" variant="secundario" size="sm" icon={<Plus className="w-3.5 h-3.5" />} className="bg-white/10 text-white border-white/20 hover:bg-white/15">
                  Sumar
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Columna Derecha: Lista de Socios Registrados (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/15">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FFC21A]" />
                <h2 className="font-display font-bold text-base text-white">
                  Socios del Club ({members.length})
                </h2>
              </div>
              <span className="text-[10px] text-white/60">
                Consentimiento explícito verificado
              </span>
            </div>

            {members.length === 0 ? (
              <div className="py-12 text-center text-xs text-white/60 space-y-2">
                <p>Todavía no tenés socios registrados.</p>
                <p className="text-[11px] text-white/50">
                  Cuando tus clientes escaneen el cartel y acepten sumarse al Club, aparecerán acá.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-between text-xs text-white"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {member.name || 'Cliente sin nombre'}
                      </p>
                      <p className="text-[11px] font-mono text-white/60">
                        {member.contact} · {formatDate(member.joinedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-sm text-[#FFC21A] bg-white/10 px-2.5 py-1 rounded-lg border border-white/20 tabular-nums">
                        {member.points} pts
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-[#FF6B6B] p-1.5 hover:bg-white/10 rounded-lg transition"
                        title="Eliminar socio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
