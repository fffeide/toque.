import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Cartel, CartelRole } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import {
  QrCode,
  Plus,
  Copy,
  Check,
  Settings2,
  Eye,
  Star,
} from 'lucide-react';

export const CartelesManagementView: React.FC = () => {
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';
  const { showToast } = useToast();
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal de nuevo cartel
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newRole, setNewRole] = useState<CartelRole>('caja');
  const [newReviewUrl, setNewReviewUrl] = useState('https://maps.google.com');
  const [isCreating, setIsCreating] = useState(false);

  // Modal de edición
  const [editingCartel, setEditingCartel] = useState<Cartel | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<CartelRole>('caja');
  const [editReviewUrl, setEditReviewUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadCarteles = async () => {
    setIsLoading(true);
    try {
      const list = await api.listCarteles();
      setCarteles(list);
    } catch {
      showToast('No se pudieron cargar los carteles', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCarteles();
  }, []);

  const handleCopyUrl = async (code: string) => {
    const url = `${window.location.origin}/h/${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    showToast(`Enlace de ${code} copiado al portapapeles`, 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateCartel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast('Ingresá un nombre para el cartel', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const created = await api.createCartelForBusiness({
        name: newName.trim(),
        code: newCode.trim() || undefined,
        role: newRole,
        reviewUrl: newReviewUrl.trim() || 'https://maps.google.com',
      });
      setCarteles((prev) => [...prev, created]);
      showToast(`Cartel ${created.code} creado y activo`, 'success');
      setShowCreateModal(false);
      setNewName('');
      setNewCode('');
    } catch (err: any) {
      showToast(err.message || 'Error al crear cartel', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (cartel: Cartel) => {
    setEditingCartel(cartel);
    setEditName(cartel.name);
    setEditRole(cartel.role);
    setEditReviewUrl(cartel.reviewUrl || 'https://maps.google.com');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCartel) return;

    setIsUpdating(true);
    try {
      const updated = await api.updateCartel(editingCartel.id, {
        name: editName.trim() || editingCartel.name,
        role: editRole,
        reviewUrl: editReviewUrl.trim(),
      });
      setCarteles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(`Cartel ${updated.code} actualizado`, 'success');
      setEditingCartel(null);
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar cartel', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            {isCashier ? 'Carteles' : 'Mis Carteles'}
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {isCashier
              ? 'Carteles habilitados en el mostrador del comercio.'
              : 'Administrá tus carteles NFC/QR de mostrador, mesas o vidriera.'}
          </p>
        </div>

        {!isCashier && (
          <div className="flex items-center gap-2.5">
            <Link to="/activar">
              <Button variant="secundario" size="sm">
                Activar cartel físico
              </Button>
            </Link>
            <Button
              variant="ultramar"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              Sumar cartel
            </Button>
          </div>
        )}
      </div>

      {/* Grilla de Carteles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {carteles.map((cartel) => (
          <Card key={cartel.id} className="p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#bec8ff]/15 border border-[#bec8ff]/30 flex items-center justify-center text-[#bec8ff] shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-[#f1f1ee]">
                        {cartel.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cartel.status === 'active'
                            ? 'bg-[#2fb36a]/15 text-[#34d399]'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {cartel.status === 'active' ? 'Activo' : 'Sin activar'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-[#f1f1ee] mt-0.5">
                      {cartel.name}
                    </h3>
                  </div>
                </div>

                {!isCashier && (
                  <button
                    type="button"
                    onClick={() => openEditModal(cartel)}
                    className="p-2 rounded-lg bg-[#18181b] hover:bg-[#242429] text-[#a1a1aa] hover:text-[#f1f1ee] border border-[#28282a] transition-colors cursor-pointer"
                    title="Configurar cartel"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className={`grid ${isCashier ? 'grid-cols-2' : 'grid-cols-3'} gap-2 pt-2`}>
                <div className="p-3 rounded-xl bg-[#161619] border border-[#242426]">
                  <span className="text-[10px] text-[#a1a1aa] block">Ubicación</span>
                  <span className="text-xs font-bold text-[#f1f1ee] capitalize">
                    {cartel.role}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#161619] border border-[#242426]">
                  <span className="text-[10px] text-[#a1a1aa] flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Escaneos
                  </span>
                  <span className="text-xs font-bold text-[#f1f1ee] font-mono">
                    {cartel.scansCount || 0}
                  </span>
                </div>
                {!isCashier && (
                  <div className="p-3 rounded-xl bg-[#161619] border border-[#242426]">
                    <span className="text-[10px] text-[#a1a1aa] flex items-center gap-1">
                      <Star className="w-3 h-3" /> Reseñas
                    </span>
                    <span className="text-xs font-bold text-[#34d399] font-mono">
                      {cartel.reviewClicksCount || 0}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!isCashier && (
              <div className="pt-4 border-t border-[#242426] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyUrl(cartel.code)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#18181b] hover:bg-[#242429] text-xs font-medium text-[#f1f1ee] border border-[#28282a] transition-colors cursor-pointer"
                >
                  {copiedCode === cartel.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#a1a1aa]" />
                      <span>Copiar enlace</span>
                    </>
                  )}
                </button>

                {cartel.status === 'sin_activar' && (
                  <Link
                    to={`/activar/${cartel.code}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#bec8ff] hover:opacity-90 text-xs font-bold text-[#0c0c0c] transition-colors"
                  >
                    <span>Activar (PIN: {cartel.pin})</span>
                  </Link>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Modal: Crear Nuevo Cartel */}
      {!isCashier && showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5">
            <div>
              <h2 className="font-bold text-lg text-[#f1f1ee]">Sumar nuevo cartel</h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Creá un punto digital para otra caja, mostrador o mesa.
              </p>
            </div>

            <form onSubmit={handleCreateCartel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Nombre identificatorio
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Caja 2 (Terraza)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                    Código (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: CAJA02"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                    Ubicación
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as CartelRole)}
                    className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  >
                    <option value="caja">Caja</option>
                    <option value="mostrador">Mostrador</option>
                    <option value="mesa">Mesa</option>
                    <option value="entrada">Entrada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Enlace de Google Maps
                </label>
                <input
                  type="url"
                  value={newReviewUrl}
                  onChange={(e) => setNewReviewUrl(e.target.value)}
                  className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secundario"
                  size="sm"
                  fullWidth
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="ultramar" size="sm" fullWidth loading={isCreating}>
                  Crear cartel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Cartel */}
      {!isCashier && editingCartel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5">
            <div>
              <h2 className="font-bold text-lg text-[#f1f1ee]">
                Configurar {editingCartel.code}
              </h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Actualizá el nombre, rol o enlace de Google Maps de este cartel.
              </p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Nombre del cartel
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Ubicación en el local
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as CartelRole)}
                  className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                >
                  <option value="caja">Caja</option>
                  <option value="mostrador">Mostrador</option>
                  <option value="mesa">Mesa</option>
                  <option value="entrada">Entrada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Enlace de Google Maps
                </label>
                <input
                  type="url"
                  value={editReviewUrl}
                  onChange={(e) => setEditReviewUrl(e.target.value)}
                  className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secundario"
                  size="sm"
                  fullWidth
                  onClick={() => setEditingCartel(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="ultramar" size="sm" fullWidth loading={isUpdating}>
                  Guardar cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
