import React, { useState, useEffect } from 'react';
import { api, ClubConfig, ClubMember } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/formatters';
import { Wallet, Award, Download, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';

export const ClubView: React.FC = () => {
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [walletConfigured, setWalletConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingWallet, setIsTestingWallet] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([api.getClubConfig(), api.listClubMembers(), api.getWalletStatus()])
      .then(([cfg, mems, walletSt]) => {
        setConfig(cfg);
        setMembers(mems);
        setWalletConfigured(walletSt.configured);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      const updated = await api.updateClubConfig(config);
      setConfig(updated);
      showToast('Configuración del Club guardada en Firestore', 'success');
    } catch {
      showToast('Error al guardar la configuración', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWalletPass = async (member: ClubMember) => {
    setIsTestingWallet(true);
    try {
      const res = await api.createWalletPass({
        memberId: member.id,
        customerName: member.name || member.contact,
        contact: member.contact,
        points: member.points,
      });
      // Recargar miembros para reflejar el nuevo pase
      const updatedMembers = await api.listClubMembers();
      setMembers(updatedMembers);
      showToast(`Pase WalletWallet emitido (${res.passId})`, 'success');
    } catch {
      showToast('No se pudo emitir el pase Wallet', 'error');
    } finally {
      setIsTestingWallet(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="block text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold mb-1">
            FIDELIZACIÓN + PASES DIGITALES WALLETWALLET
          </span>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Club del Negocio & Wallet
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Tus clientes suman puntos desde el recibo digital y guardan su tarjeta en Apple Wallet o Google Wallet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-[#111113] border border-[#242426] flex items-center gap-2 text-xs">
            <Wallet className="w-4 h-4 text-[#34d399]" />
            <span className="text-[#a1a1aa]">API WalletWallet:</span>
            <span className="font-bold text-[#34d399]">
              {walletConfigured ? 'Conectada (Proxy Seguro)' : 'Modo Local'}
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
              <span>Reglas del Club</span>
            </h2>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#242426]">
                <span className="text-sm font-medium text-[#f1f1ee]">Club Activo en el Hub</span>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-[#28282a] text-[#bec8ff] focus:ring-[#bec8ff]"
                />
              </div>

              <Input
                label="Nombre de tu programa"
                value={config.clubName}
                onChange={(e) => setConfig({ ...config, clubName: e.target.value })}
                placeholder="Ej: Club Café La Esquina"
                required
              />

              <Input
                label="Beneficio de bienvenida / meta"
                value={config.welcomeBenefitText}
                onChange={(e) => setConfig({ ...config, welcomeBenefitText: e.target.value })}
                placeholder="Ej: 10% OFF en tu próxima visita"
                required
              />

              <Input
                label="Puntos otorgados por cada visita/compra"
                type="number"
                min={1}
                max={100}
                value={config.pointsPerVisit}
                onChange={(e) =>
                  setConfig({ ...config, pointsPerVisit: Number(e.target.value) || 1 })
                }
                required
              />

              <Button type="submit" fullWidth isLoading={isSaving}>
                Guardar reglas del Club
              </Button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-[#242426] bg-[#141416] flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#f1f1ee]">
                Clientes adheridos ({members.length})
              </h2>
              <span className="text-xs text-[#a1a1aa]">
                Datos reales con consentimiento explícito
              </span>
            </div>

            {members.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon="🪪"
                  title="Todavía no hay socios registrados"
                  description="Cuando un cliente deje su WhatsApp o email en el Hub público de tu cartel, aparecerá en esta tabla con su pase Wallet."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#242426] bg-[#111113] text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
                      <th className="py-3 px-4">Cliente / Contacto</th>
                      <th className="py-3 px-4">Puntos</th>
                      <th className="py-3 px-4">Alta</th>
                      <th className="py-3 px-4 text-right">Pase WalletWallet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242426] text-sm">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-[#18181b]/60">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#f1f1ee]">
                            {m.name || 'Cliente Toque'}
                          </div>
                          <div className="text-xs text-[#a1a1aa] font-mono">{m.contact}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#bec8ff]/15 text-[#bec8ff] border border-[#bec8ff]/30">
                            {m.points} pts
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#a1a1aa]">
                          {formatDate(m.joinedAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {m.walletPassUrl ? (
                            <a
                              href={m.walletPassUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-[#34d399] hover:underline"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Pase activo</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              isLoading={isTestingWallet}
                              onClick={() => handleTestWalletPass(m)}
                            >
                              <Sparkles className="w-3.5 h-3.5 mr-1 text-[#bec8ff]" />
                              Emitir Pase Wallet
                            </Button>
                          )}
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
    </div>
  );
};
