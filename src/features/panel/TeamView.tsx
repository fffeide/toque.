import React, { useState, useEffect } from 'react';
import { api, TeamMember, Cartel } from '../../api';
import { ClubLocal } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/formatters';
import {
  Users,
  UserPlus,
  ShieldCheck,
  QrCode,
  Trash2,
  CheckCircle2,
  CreditCard,
  X,
} from 'lucide-react';

export const TeamView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'cashier' | 'manager' | 'owner'>('cashier');
  const [assignedCartelId, setAssignedCartelId] = useState<string>('');
  const [selectedLocalIds, setSelectedLocalIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [teamList, cartelesList, localsList] = await Promise.all([
        api.listTeamMembers(),
        api.listCarteles(),
        api.listLocals(),
      ]);
      setMembers(teamList);
      setCarteles(cartelesList);
      setLocals(localsList);
    } catch {
      showToast('No se pudo cargar el equipo', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleLocalSelection = (localId: string) => {
    setSelectedLocalIds((prev) =>
      prev.includes(localId) ? prev.filter((id) => id !== localId) : [...prev, localId]
    );
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Ingresá el nombre y apellido', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const created = await api.addTeamMember({
        name: name.trim(),
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        role,
        assignedCartelId: assignedCartelId || undefined,
        assignedLocalIds: selectedLocalIds.length > 0 ? selectedLocalIds : locals.map((l) => l.id),
      });
      setMembers((prev) => [...prev, created]);
      showToast(`${created.name} sumado al equipo`, 'success');
      setShowAddModal(false);
      setName('');
      setEmail('');
      setRole('cashier');
      setAssignedCartelId('');
    } catch (err: any) {
      showToast(err.message || 'Error al agregar colaborador', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeCartel = async (member: TeamMember, newCartelId: string) => {
    try {
      const updated = await api.updateTeamMember(member.id, {
        assignedCartelId: newCartelId || '',
      });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
      showToast(`Caja actualizada para ${member.name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo actualizar la caja', 'error');
    }
  };

  const handleChangeRole = async (
    member: TeamMember,
    newRole: 'owner' | 'manager' | 'cashier'
  ) => {
    try {
      const updated = await api.updateTeamMember(member.id, { role: newRole });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
      showToast(`Rol actualizado para ${member.name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo actualizar el rol', 'error');
    }
  };

  const handleRemove = async (member: TeamMember) => {
    try {
      await api.removeTeamMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      showToast(`${member.name} fue quitado del equipo`, 'info');
    } catch {
      showToast('No se pudo eliminar al colaborador', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Equipo del comercio
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Sumá cajeros o encargados por mail y definí el nivel de acceso y locales de cada integrante.
          </p>
        </div>

        <Button
          variant="ultramar"
          size="sm"
          icon={<UserPlus className="w-4 h-4" />}
          onClick={() => {
            setName('');
            setEmail('');
            setRole('cashier');
            setAssignedCartelId('');
            setSelectedLocalIds(locals.map((l) => l.id));
            setShowAddModal(true);
          }}
        >
          Sumar colaborador
        </Button>
      </div>

      {/* Explicación rápida de roles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#111113] border border-[#242426] flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#f1f1ee]">Dueño</p>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Acceso total al panel, métricas, productos, carteles, club, correcciones, equipo y caja.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111113] border border-[#242426] flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2fb36a]/15 text-[#34d399] flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#f1f1ee]">Encargado</p>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Gestiona el resumen, carteles, club, avisos, correcciones con motivo y opera la caja.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111113] border border-[#242426] flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#18181b] text-[#f1f1ee] flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#f1f1ee]">Cajero</p>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Opera la caja y suma sellos / canjea premios en Escanear sin poder anular ni borrar.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Miembros */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-5 border-b border-[#242426] flex items-center justify-between">
          <h2 className="font-bold text-sm text-[#f1f1ee]">
            Integrantes activos ({members.length})
          </h2>
          <span className="text-xs text-[#a1a1aa]">
            Sincronización en tiempo real con Caja y Club
          </span>
        </div>

        <div className="divide-y divide-[#242426]">
          {members.map((member) => {
            const isSelfOwner =
              member.id === 'team-owner-default' ||
              (Boolean(user?.email) &&
                member.email.toLowerCase() === user?.email.toLowerCase() &&
                member.role === 'owner');

            const roleLabel =
              member.role === 'owner'
                ? 'Dueño'
                : member.role === 'manager'
                ? 'Encargado'
                : 'Cajero';

            return (
              <div
                key={member.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#161619] transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center font-bold text-sm text-[#bec8ff] shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#f1f1ee]">{member.name}</p>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          member.role === 'owner'
                            ? 'bg-[#bec8ff]/15 text-[#bec8ff]'
                            : member.role === 'manager'
                            ? 'bg-[#2fb36a]/15 text-[#34d399]'
                            : 'bg-[#18181b] text-[#a1a1aa] border border-[#28282a]'
                        }`}
                      >
                        {roleLabel}
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] mt-0.5">
                      {member.email} · Alta: {formatDate(member.addedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isSelfOwner ? (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-xl bg-[#161619] border border-[#28282a] text-xs font-semibold text-[#f1f1ee]">
                        Dueño
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-[#161619] border border-[#28282a] text-xs font-semibold text-[#a1a1aa] flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-[#bec8ff]" />
                        Todos los locales y cajas
                      </span>
                    </div>
                  ) : (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleChangeRole(
                            member,
                            e.target.value as 'owner' | 'manager' | 'cashier'
                          )
                        }
                        aria-label="Rol del integrante"
                        className="bg-[#161619] border border-[#28282a] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff] cursor-pointer"
                      >
                        <option value="cashier">Cajero</option>
                        <option value="manager">Encargado</option>
                        <option value="owner">Dueño</option>
                      </select>

                      <div className="flex items-center gap-1.5 bg-[#161619] border border-[#28282a] rounded-xl px-3 py-1.5">
                        <QrCode className="w-3.5 h-3.5 text-[#bec8ff]" />
                        <select
                          value={member.assignedCartelId || ''}
                          onChange={(e) => handleChangeCartel(member, e.target.value)}
                          aria-label="Caja asignada"
                          className="bg-transparent text-xs font-medium text-[#f1f1ee] focus:outline-none cursor-pointer"
                        >
                          <option value="" className="bg-[#111113]">
                            Todas las cajas
                          </option>
                          {carteles.map((c) => (
                            <option key={c.id} value={c.id} className="bg-[#111113]">
                              {c.code} · {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemove(member)}
                        title="Quitar del equipo"
                        className="p-2 rounded-lg text-[#a1a1aa] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Modal para sumar colaborador */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-[#f1f1ee]">Sumar al equipo</h2>
                  <p className="text-xs text-[#a1a1aa]">
                    Ingresá nombre, mail y asignale su rol y locales.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Nombre y apellido
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Lucas Martínez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Mail de acceso (para recibir código de 6 dígitos)
                </label>
                <input
                  type="email"
                  placeholder="Ej: lucas@comercio.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                    Rol
                  </label>
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as 'cashier' | 'manager' | 'owner')
                    }
                    className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  >
                    <option value="cashier">Cajero</option>
                    <option value="manager">Encargado</option>
                    <option value="owner">Dueño</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                    Caja asignada
                  </label>
                  <select
                    value={assignedCartelId}
                    onChange={(e) => setAssignedCartelId(e.target.value)}
                    className="w-full bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  >
                    <option value="">Todas las cajas</option>
                    {carteles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {locals.length > 0 && (
                <div>
                  <span className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                    Locales habilitados
                  </span>
                  <div className="space-y-1.5">
                    {locals.map((loc) => (
                      <label
                        key={loc.id}
                        className="flex items-center gap-2 text-xs text-[#f1f1ee] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLocalIds.includes(loc.id)}
                          onChange={() => toggleLocalSelection(loc.id)}
                          className="rounded border-[#28282a]"
                        />
                        <span>
                          {loc.name} ({loc.code})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secundario"
                  size="sm"
                  fullWidth
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="ultramar"
                  size="sm"
                  fullWidth
                  loading={isSaving}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Guardar integrante
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
