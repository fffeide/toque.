import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Cartel, CartelRole } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { generateQrSvg, downloadSvg, downloadPng } from '../../lib/qrGenerator';
import { buildPublicShortUrl } from '../../lib/urls';
import {
  QrCode,
  Plus,
  ExternalLink,
  Download,
  Copy,
  Check,
  Edit3,
  Trash2,
  RotateCcw,
  CreditCard,
  Star,
} from 'lucide-react';

export const CartelesManagementView: React.FC = () => {
  const { user } = useAuth();
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQrCartel, setSelectedQrCartel] = useState<Cartel | null>(null);
  const [editingCartel, setEditingCartel] = useState<Cartel | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<CartelRole>('caja');
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<CartelRole>('caja');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'activos' | 'papelera'>('activos');
  const { showToast } = useToast();

  const canManage = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'superadmin';

  const loadCarteles = async () => {
    try {
      const data = await api.listCarteles();
      setCarteles(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCarteles();
  }, []);

  const handleOpenEdit = (cartel: Cartel) => {
    setEditingCartel(cartel);
    setEditName(cartel.name);
    setEditRole(cartel.role);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCartel || !editName.trim()) return;

    setIsSaving(true);
    try {
      const updated = await api.updateCartel(editingCartel.id, {
        name: editName.trim(),
        role: editRole,
      });
      setCarteles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast('Cartel actualizado en tiempo real', 'success');
      setEditingCartel(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al actualizar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCartel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSaving(true);
    try {
      const created = await api.createCartelForBusiness({
        name: newName.trim(),
        role: newRole,
      });
      setCarteles((prev) => [created, ...prev]);
      setNewName('');
      setNewRole('caja');
      setIsCreatingModalOpen(false);
      showToast(`Cartel ${created.code} creado y vinculado a tu comercio`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear cartel', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTrash = async (cartel: Cartel) => {
    const isMovingToTrash = cartel.status !== 'trash';
    const nextStatus = isMovingToTrash ? 'trash' : 'active';
    try {
      const updated = await api.updateCartel(cartel.id, { status: nextStatus });
      setCarteles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(
        isMovingToTrash ? 'Cartel movido a la papelera' : 'Cartel restaurado con éxito',
        'info'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo actualizar el cartel', 'error');
    }
  };

  const handleCopyUrl = async (cartel: Cartel) => {
    const url = buildPublicShortUrl(cartel.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(cartel.id);
      showToast('Enlace del Hub copiado al portapapeles', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('No se pudo copiar el enlace', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56 bg-[#111113]" />
        <Skeleton className="h-36 w-full bg-[#111113]" />
        <Skeleton className="h-36 w-full bg-[#111113]" />
      </div>
    );
  }

  const activeCarteles = carteles.filter((c) => c.status !== 'trash');
  const trashedCarteles = carteles.filter((c) => c.status === 'trash');
  const displayedCarteles = activeTab === 'activos' ? activeCarteles : trashedCarteles;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="block text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold mb-1">
            PUNTOS DE CONTACTO NFC + QR
          </span>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">Mis Carteles</h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Administrá tus carteles conectados en tiempo real con la Caja y el Hub del cliente.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreatingModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nuevo cartel
            </Button>
          )}
        </div>
      </div>

      {/* Pestañas: Activos vs Papelera */}
      <div className="flex items-center gap-2 border-b border-[#242426] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('activos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'activos'
              ? 'bg-[#bec8ff] text-[#0c0c0c]'
              : 'bg-[#111113] text-[#a1a1aa] hover:text-[#f1f1ee] border border-[#242426]'
          }`}
        >
          Activos ({activeCarteles.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('papelera')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'papelera'
              ? 'bg-[#bec8ff] text-[#0c0c0c]'
              : 'bg-[#111113] text-[#a1a1aa] hover:text-[#f1f1ee] border border-[#242426]'
          }`}
        >
          Papelera ({trashedCarteles.length})
        </button>
      </div>

      {displayedCarteles.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏷️"
            title={
              activeTab === 'activos'
                ? 'Todavía no tenés carteles activos'
                : 'La papelera está vacía'
            }
            description={
              activeTab === 'activos'
                ? 'Creá un cartel para conectarlo con tu Caja y empezar a emitir recibos digitales y sumar reseñas.'
                : 'Los carteles que archives aparecerán acá para que puedas restaurarlos cuando quieras.'
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayedCarteles.map((cartel) => {
            const publicUrl = buildPublicShortUrl(cartel.code);
            const isCaja = cartel.role === 'caja';

            return (
              <Card key={cartel.id} className="hover:border-[#343438] transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-[#f1f1ee]">{cartel.name}</h2>
                      <span className="font-mono text-xs bg-[#18181b] text-[#bec8ff] px-2.5 py-0.5 rounded-lg border border-[#28282a] font-bold">
                        {cartel.code}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border inline-flex items-center gap-1 ${
                          isCaja
                            ? 'bg-[#bec8ff]/15 text-[#bec8ff] border-[#bec8ff]/30'
                            : 'bg-[#2fb36a]/15 text-[#34d399] border-[#2fb36a]/30'
                        }`}
                      >
                        {isCaja ? (
                          <>
                            <CreditCard className="w-3 h-3" />
                            <span>Rol: Caja + Recibo en vivo</span>
                          </>
                        ) : (
                          <>
                            <Star className="w-3 h-3" />
                            <span>Rol: Reseñas + Club</span>
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-[#a1a1aa] font-mono break-all">{publicUrl}</p>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#a1a1aa]">
                      <span>
                        Escaneos reales:{' '}
                        <strong className="text-[#f1f1ee] font-mono">
                          {cartel.scansCount || 0}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Clics a reseñas:{' '}
                        <strong className="text-[#34d399] font-mono">
                          {cartel.reviewClicksCount || 0}
                        </strong>
                      </span>
                      {cartel.activeReceiptId && (
                        <>
                          <span>·</span>
                          <span className="text-[#34d399] font-semibold">
                            ● Recibo activo en mostrador ({cartel.activeReceiptId})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/h/${cartel.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#28282a] text-xs font-semibold text-[#f1f1ee] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#bec8ff]" />
                      <span>Abrir Hub</span>
                    </Link>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyUrl(cartel)}
                    >
                      {copiedId === cartel.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-[#34d399]" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copiar link
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedQrCartel(cartel)}
                    >
                      <QrCode className="w-3.5 h-3.5 mr-1" />
                      Descargar QR
                    </Button>

                    {canManage && activeTab === 'activos' && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(cartel)}
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleTrash(cartel)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}

                    {canManage && activeTab === 'papelera' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleTrash(cartel)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Restaurar
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Crear Nuevo Cartel */}
      <Modal
        isOpen={isCreatingModalOpen}
        onClose={() => setIsCreatingModalOpen(false)}
        title="Crear nuevo cartel NFC + QR"
      >
        <form onSubmit={handleCreateCartel} className="space-y-4">
          <Input
            label="Nombre o ubicación del cartel"
            placeholder="Ej: Caja Principal, Mostrador 2, Terraza"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#f1f1ee]">
              Función principal del cartel
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setNewRole('caja')}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  newRole === 'caja'
                    ? 'bg-[#bec8ff]/15 border-[#bec8ff] text-[#f1f1ee]'
                    : 'bg-[#18181b] border-[#28282a] text-[#a1a1aa]'
                }`}
              >
                <p className="font-bold text-sm text-[#f1f1ee]">Caja y Comprobantes</p>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Sincroniza recibos en vivo con la terminal de Caja y suma puntos.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setNewRole('resena')}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  newRole === 'resena'
                    ? 'bg-[#2fb36a]/15 border-[#2fb36a] text-[#f1f1ee]'
                    : 'bg-[#18181b] border-[#28282a] text-[#a1a1aa]'
                }`}
              >
                <p className="font-bold text-sm text-[#f1f1ee]">Reseñas y Mesas</p>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Ideal para mesas o vidrieras: prioriza Google Maps, Wi-Fi y Club.
                </p>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreatingModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Crear Cartel Activo
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal QR */}
      <Modal
        isOpen={!!selectedQrCartel}
        onClose={() => setSelectedQrCartel(null)}
        title={selectedQrCartel ? `Código QR — ${selectedQrCartel.name}` : ''}
      >
        {selectedQrCartel && (
          <div className="text-center space-y-5">
            <div
              className="w-56 h-56 mx-auto p-4 bg-[#f1f1ee] rounded-2xl border border-[#28282a] flex items-center justify-center"
              dangerouslySetInnerHTML={{
                __html: generateQrSvg(buildPublicShortUrl(selectedQrCartel.code), 220),
              }}
            />
            <div>
              <p className="font-mono text-sm font-bold text-[#bec8ff]">
                {selectedQrCartel.code}
              </p>
              <p className="text-xs text-[#a1a1aa] mt-1 font-mono break-all">
                {buildPublicShortUrl(selectedQrCartel.code)}
              </p>
              <p className="text-xs text-[#34d399] mt-2 font-medium">
                Grabar este enlace como registro URI NDEF en el chip NFC NTAG213/215.
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const svg = generateQrSvg(buildPublicShortUrl(selectedQrCartel.code), 600);
                  downloadSvg(svg, `toque-${selectedQrCartel.code}.svg`);
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Descargar SVG
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const svg = generateQrSvg(buildPublicShortUrl(selectedQrCartel.code), 800);
                  downloadPng(svg, `toque-${selectedQrCartel.code}.png`, 800);
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Descargar PNG Alta Res
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={!!editingCartel}
        onClose={() => setEditingCartel(null)}
        title="Editar Cartel"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Nombre descriptivo"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#f1f1ee]">Rol del cartel</label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as CartelRole)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm focus:outline-none focus:ring-2 focus:ring-[#bec8ff]"
            >
              <option value="caja">Caja (Emitir recibos digitales en vivo + Hub)</option>
              <option value="resena">Reseña (Priorizar Google Maps y Club)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" onClick={() => setEditingCartel(null)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
