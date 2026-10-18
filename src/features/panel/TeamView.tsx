import React, { useState, useEffect } from 'react';
import { api, TeamMember, Cartel } from '../../api';
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
  Trash2,
  CreditCard,
  LayoutDashboard,
  Lock,
  CheckCircle2,
} from 'lucide-react';

const ROLE_META: Record<
  'owner' | 'manager' | 'cashier',
  {
    label: string;
    panelAccess: string;
    description: string;
    badgeClass: string;
  }
> = {
  owner: {
    label: 'Dueño',
    panelAccess: 'Acceso total (/panel, /panel/equipo y /caja)',
    description: 'Control completo del comercio, métricas, configuración, carteles y gestión de equipo.',
    badgeClass: 'bg-[#bec8ff] text-[#0c0c0c] border-[#bec8ff]',
  },
  manager: {
    label: 'Encargado',
    panelAccess: 'Panel operativo (/panel y /caja)',
    description: 'Acceso a Resumen, Carteles, Canales/Hub, Ventas, Club y Caja. Sin baja de titulares.',
    badgeClass: 'bg-[#2fb36a]/20 text-[#34d399] border-[#2fb36a]/40',
  },
  cashier: {
    label: 'Cajero',
    panelAccess: 'Exclusivo Terminal de Mostrador (/caja)',
    description: 'Opera únicamente la Pantalla de Caja asignada para emitir cobros y comprobantes.',
    badgeClass: 'bg-[#18181b] text-[#f1f1ee] border-[#343438]',
  },
};

export const TeamView: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario nuevo colaborador
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'manager' | 'cashier'>('cashier');
  const [assignedCartelId, setAssignedCartelId] = useState('');

  const canManageTeam = user?.role === 'owner' || user?.role === 'superadmin' || user?.isSuperAdmin;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [teamList, cartelesList] = await Promise.all([
        api.listTeamMembers(),
        api.listCarteles(),
      ]);
      setMembers(teamList);
      const activeCarteles = cartelesList.filter((c) => c.status !== 'trash');
      setCarteles(activeCarteles);
      if (activeCarteles.length > 0 && !assignedCartelId) {
        setAssignedCartelId(activeCarteles[0].id);
      }
    } catch (err) {
      toastError(
        'No pudimos cargar el equipo',
        err instanceof Error ? err.message : 'Verificá tus permisos.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toastError('Completá el nombre y el correo electrónico del colaborador.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.addTeamMember({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        assignedCartelId: assignedCartelId || undefined,
      });
      success(
        'Colaborador agregado al equipo',
        `${name.trim()} ya tiene acceso a su panel como ${ROLE_META[role].label}.`
      );
      setName('');
      setEmail('');
      setRole('cashier');
      await loadData();
    } catch (err) {
      toastError(
        'No pudimos agregar al colaborador',
        err instanceof Error ? err.message : 'Probá de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (member: TeamMember, nextRole: 'owner' | 'manager' | 'cashier') => {
    try {
      await api.updateTeamMember(member.id, { role: nextRole });
      success(
        'Permisos actualizados',
        `${member.name} ahora tiene el rol de ${ROLE_META[nextRole].label}.`
      );
      await loadData();
      if (member.email.toLowerCase() === user?.email.toLowerCase()) {
        await refreshProfile();
      }
    } catch (err) {
      toastError(
        'Error al actualizar rol',
        err instanceof Error ? err.message : 'No tenés permisos suficientes.'
      );
    }
  };

  const handleCartelChange = async (member: TeamMember, nextCartelId: string) => {
    try {
      await api.updateTeamMember(member.id, {
        assignedCartelId: nextCartelId || undefined,
      });
      success('Caja / cartel asignado', `Se actualizó el punto de cobro de ${member.name}.`);
      await loadData();
    } catch (err) {
      toastError(
        'Error al asignar cartel',
        err instanceof Error ? err.message : 'Intentá de nuevo.'
      );
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (member.email.toLowerCase() === user?.email.toLowerCase()) {
      toastError('No podés eliminar tu propio usuario en sesión activa.');
      return;
    }
    try {
      await api.removeTeamMember(member.id);
      success('Colaborador dado de baja', `Se revocó el acceso de ${member.name}.`);
      await loadData();
    } catch (err) {
      toastError(
        'No pudimos dar de baja al colaborador',
        err instanceof Error ? err.message : 'Intentá de nuevo.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 bg-[#111113]" />
        <Skeleton className="h-56 w-full rounded-2xl bg-[#111113]" />
        <Skeleton className="h-64 w-full rounded-2xl bg-[#111113]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="block text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold mb-1">
            CONTROL DE ACCESO Y PERMISOS (RLS)
          </span>
          <h1 className="font-bold text-2xl sm:text-3xl text-[#f1f1ee] tracking-tight">
            Equipo del Comercio
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Agregá colaboradores y asigná qué panel pueden operar según su rol (Dueño, Encargado o Cajero).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#111113] border border-[#242426] px-3.5 py-2 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-[#2fb36a] shrink-0" />
          <span className="text-xs font-medium text-[#f1f1ee]">
            RLS Activo · {members.length} integrante(s)
          </span>
        </div>
      </div>

      {/* Tarjetas explicativas de Roles y Alcance RLS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['owner', 'manager', 'cashier'] as const).map((rKey) => {
          const meta = ROLE_META[rKey];
          return (
            <div
              key={rKey}
              className="bg-[#111113] border border-[#242426] rounded-2xl p-5 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                  {rKey === 'cashier' ? (
                    <CreditCard className="w-4 h-4 text-[#bec8ff]" />
                  ) : (
                    <LayoutDashboard className="w-4 h-4 text-[#bec8ff]" />
                  )}
                </div>
                <p className="text-xs font-semibold text-[#f1f1ee] pt-1">{meta.panelAccess}</p>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">{meta.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Formulario para agregar colaborador (lg:col-span-5) */}
        <div className="lg:col-span-5">
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#242426]">
              <div className="w-9 h-9 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-base text-[#f1f1ee] tracking-tight">
                  Sumar colaborador
                </h2>
                <p className="text-[11px] text-[#a1a1aa]">
                  Al iniciar sesión con su correo, verá únicamente su panel asignado.
                </p>
              </div>
            </div>

            {!canManageTeam ? (
              <div className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] flex items-start gap-3 text-xs text-[#a1a1aa]">
                <Lock className="w-4 h-4 text-[#bec8ff] shrink-0 mt-0.5" />
                <span>
                  Solo el <strong className="text-[#f1f1ee]">Dueño</strong> del comercio puede dar de alta o modificar permisos de colaboradores.
                </span>
              </div>
            ) : (
              <form onSubmit={handleAddCollaborator} className="space-y-4 text-xs">
                <div>
                  <label
                    htmlFor="collab-name"
                    className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                  >
                    Nombre y apellido *
                  </label>
                  <input
                    id="collab-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Lucía Fernández"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="collab-email"
                    className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                  >
                    Correo electrónico de acceso *
                  </label>
                  <input
                    id="collab-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cajero@tulocal.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="collab-role"
                    className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                  >
                    Rol y nivel de acceso RLS *
                  </label>
                  <select
                    id="collab-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'owner' | 'manager' | 'cashier')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm font-semibold text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  >
                    <option value="cashier" className="bg-[#111113] text-[#f1f1ee]">
                      Cajero — Solo Pantalla de Caja (/caja)
                    </option>
                    <option value="manager" className="bg-[#111113] text-[#f1f1ee]">
                      Encargado — Panel Operativo y Caja
                    </option>
                    <option value="owner" className="bg-[#111113] text-[#f1f1ee]">
                      Dueño — Administración Total
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="collab-cartel"
                    className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                  >
                    Caja / Cartel asignado en mostrador
                  </label>
                  <select
                    id="collab-cartel"
                    value={assignedCartelId}
                    onChange={(e) => setAssignedCartelId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm font-semibold text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  >
                    <option value="" className="bg-[#111113] text-[#f1f1ee]">
                      Todas las cajas del local
                    </option>
                    {carteles.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#111113] text-[#f1f1ee]">
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="ultramar"
                    size="touch"
                    fullWidth
                    disabled={isSubmitting}
                    icon={<UserPlus className="w-4 h-4 text-[#0c0c0c]" />}
                  >
                    {isSubmitting ? 'Agregando colaborador…' : 'Agregar al equipo'}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>

        {/* Columna Derecha: Integrantes activos (lg:col-span-7) */}
        <div className="lg:col-span-7">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242426]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#bec8ff]" />
                <h2 className="font-bold text-base text-[#f1f1ee] tracking-tight">
                  Colaboradores activos ({members.length})
                </h2>
              </div>
              <span className="text-[11px] text-[#a1a1aa]">
                Sincronizado en tiempo real con Firestore
              </span>
            </div>

            {members.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#a1a1aa]">
                No hay colaboradores cargados en este comercio.
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => {
                  const meta = ROLE_META[member.role] || ROLE_META.cashier;
                  const isCurrentUser =
                    member.email.toLowerCase() === user?.email.toLowerCase();

                  return (
                    <div
                      key={member.id}
                      className="p-4 rounded-2xl bg-[#18181b] border border-[#28282a] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#f1f1ee]">
                            {member.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] font-semibold bg-[#2fb36a]/15 text-[#34d399] border border-[#2fb36a]/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Tu sesión
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-mono text-[#a1a1aa] truncate">
                          {member.email}
                        </p>

                        <p className="text-[11px] text-[#a1a1aa]">
                          Panel habilitado:{' '}
                          <strong className="text-[#f1f1ee]">{meta.panelAccess}</strong>
                          {member.assignedCartelCode && (
                            <>
                              {' '}
                              · Cartel:{' '}
                              <span className="font-mono text-[#bec8ff] font-semibold">
                                {member.assignedCartelCode}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="text-[10px] text-[#a1a1aa]">
                          Alta: {formatDate(member.addedAt)}
                        </p>
                      </div>

                      {canManageTeam && (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#28282a]">
                          <select
                            aria-label={`Cambiar rol de ${member.name}`}
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(
                                member,
                                e.target.value as 'owner' | 'manager' | 'cashier'
                              )
                            }
                            className="bg-[#111113] border border-[#28282a] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                          >
                            <option value="owner">Dueño</option>
                            <option value="manager">Encargado</option>
                            <option value="cashier">Cajero</option>
                          </select>

                          <select
                            aria-label={`Cambiar caja de ${member.name}`}
                            value={member.assignedCartelId || ''}
                            onChange={(e) => handleCartelChange(member, e.target.value)}
                            className="bg-[#111113] border border-[#28282a] rounded-xl px-2.5 py-1.5 text-xs text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                          >
                            <option value="">Todas las cajas</option>
                            {carteles.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code}
                              </option>
                            ))}
                          </select>

                          {!isCurrentUser && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              title="Revocar acceso"
                              aria-label={`Revocar acceso de ${member.name}`}
                              className="p-2 rounded-xl border border-[#28282a] bg-[#111113] hover:bg-[#2a1515] hover:border-red-500/40 text-[#a1a1aa] hover:text-red-300 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
