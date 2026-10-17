import React, { useState } from 'react';
import { api, BusinessProfile } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useNavigate, Link } from 'react-router-dom';
import {
  Store,
  ExternalLink,
  LogOut,
  Save,
  CheckCircle2,
  Sparkles,
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
      toastError('No pudimos guardar los cambios', err instanceof Error ? err.message : 'Probá de nuevo.');
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
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
          Cuenta
        </h1>
        <p className="text-xs text-white/70 mt-0.5">
          Configuración general de tu local en la plataforma Toque.
        </p>
      </div>

      {/* Estado del Plan y Prueba Beta de 30 Días en Liquid Glass */}
      <Card padding="md" className="p-5 bg-white/[0.08] border border-white/15 space-y-3 text-white">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#FFC21A] text-[#0B1030] rounded-full">
              Prueba Beta Activa
            </span>
            <span className="text-xs font-semibold text-white">30 días sin costo</span>
          </div>
          <Link
            to="/precios"
            className="text-xs font-bold text-[#FFC21A] hover:underline"
          >
            Ver planes y precios →
          </Link>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">
          Tu comercio cuenta con 30 días de prueba beta gratuita para usar el módulo Recibo y carteles inteligentes. Finalizado el período de prueba, el abono del plan <strong>Comercio Pro es de $7.899/mes</strong>.
        </p>
      </Card>

      <Card padding="lg" className="space-y-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5" htmlFor="bName">
              Nombre comercial del local
            </label>
            <input
              id="bName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-white/10 text-sm text-white placeholder-white/40 focus:bg-white/15 focus:outline-none focus:border-[#FFC21A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5" htmlFor="rUrl">
              Enlace oficial de Google Reviews
            </label>
            <input
              id="rUrl"
              type="url"
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-white/10 text-xs text-white placeholder-white/40 focus:bg-white/15 focus:outline-none focus:border-[#FFC21A]"
            />
            <p className="text-[11px] text-white/60 mt-1">
              Es el destino que se abre cuando un cliente presiona "Dejar reseña en Google".
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="estrella"
              size="touch"
              disabled={isSaving}
              icon={<Save className="w-4 h-4 text-[#0B1030]" />}
            >
              {isSaving ? 'Guardando…' : 'Guardar perfil'}
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="md" className="space-y-3">
        <h3 className="font-display font-bold text-sm text-white">
          Información del Usuario
        </h3>
        <div className="space-y-1.5 text-xs text-white/70">
          <p>Titular: <strong className="text-white">{user?.name}</strong></p>
          <p>Correo de acceso: <strong className="text-white">{user?.email}</strong></p>
          <p>Plataforma: <strong className="text-[#FFC21A]">Toque™ Oficial</strong></p>
        </div>

        <div className="pt-3 border-t border-white/10">
          <Button
            variant="secundario"
            size="sm"
            onClick={handleLogout}
            icon={<LogOut className="w-3.5 h-3.5 text-[#FF6B6B]" />}
            className="text-[#FF6B6B] bg-white/10 border-white/20 hover:bg-white/15"
          >
            Cerrar sesión
          </Button>
        </div>
      </Card>
    </div>
  );
};
