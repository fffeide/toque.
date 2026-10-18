import React, { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogOut,
  Save,
} from 'lucide-react';

export const AccountSettingsView: React.FC = () => {
  const { user, business, logout, refreshProfile } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(business?.name || '');
  const [reviewUrl, setReviewUrl] = useState(business?.reviewUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toastError('El nombre del comercio no puede estar vacío');
      return;
    }

    setIsSaving(true);
    try {
      await api.updateBusinessProfile({
        name: name.trim(),
        reviewUrl: reviewUrl.trim(),
      });
      await refreshProfile();
      success('Datos actualizados', 'Se guardó la información de tu comercio.');
    } catch (err) {
      toastError(
        'No pudimos guardar los cambios',
        err instanceof Error ? err.message : 'Probá de nuevo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <span className="block text-[11px] uppercase tracking-wider text-[#8E8E93] font-semibold mb-1">
          CONFIGURACIÓN DEL COMERCIO
        </span>
        <h1 className="font-bold text-2xl sm:text-3xl text-white tracking-tight">
          Mi Cuenta
        </h1>
        <p className="text-xs text-[#8E8E93] mt-0.5">
          Configuración general de tu local en la plataforma Toque.
        </p>
      </div>

      {/* Estado del Plan y Prueba Beta de 30 Días */}
      <Card padding="md" className="p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              • Gratis · Prueba Beta Activa
            </span>
            <span className="text-xs font-semibold text-white">30 días sin costo</span>
          </div>
          <Link
            to="/precios"
            className="text-xs font-bold text-[#bec8ff] hover:text-[#d6daf6]"
          >
            Ver planes y precios →
          </Link>
        </div>
        <p className="text-xs text-[#8E8E93] leading-relaxed">
          Tu comercio cuenta con 30 días de prueba beta gratuita para usar el módulo Recibo y carteles inteligentes. Finalizado el período de prueba, el abono del plan{' '}
          <strong className="text-white">Comercio Pro es de $7.899/mes</strong>.
        </p>
      </Card>

      <Card padding="lg" className="space-y-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              className="block text-[11px] uppercase tracking-wider font-semibold text-[#8E8E93] mb-1.5"
              htmlFor="bName"
            >
              Nombre comercial del local
            </label>
            <input
              id="bName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] text-sm text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#bec8ff]"
            />
          </div>

          <div>
            <label
              className="block text-[11px] uppercase tracking-wider font-semibold text-[#8E8E93] mb-1.5"
              htmlFor="rUrl"
            >
              Enlace oficial de Google Reviews
            </label>
            <input
              id="rUrl"
              type="url"
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] text-xs text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#bec8ff]"
            />
            <p className="text-[11px] text-[#8E8E93] mt-1">
              Es el destino que se abre cuando un cliente presiona &ldquo;Dejar reseña en Google&rdquo;.
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="estrella"
              size="touch"
              disabled={isSaving}
              icon={<Save className="w-4 h-4" />}
            >
              {isSaving ? 'Guardando…' : 'Guardar perfil'}
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="md" className="space-y-3">
        <h3 className="font-bold text-sm text-white tracking-tight">
          Información del Usuario
        </h3>
        <div className="space-y-1.5 text-xs text-[#8E8E93]">
          <p>
            Titular: <strong className="text-white">{user?.name}</strong>
          </p>
          <p>
            Correo de acceso: <strong className="text-white">{user?.email}</strong>
          </p>
          <p>
            Rol: <strong className="text-[#bec8ff]">Dueño</strong>
          </p>
        </div>

        <div className="pt-2 border-t border-[#242424]">
          <Button
            variant="peligro"
            size="sm"
            onClick={handleLogout}
            icon={<LogOut className="w-3.5 h-3.5" />}
          >
            Cerrar sesión
          </Button>
        </div>
      </Card>
    </div>
  );
};
