import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { MenuBranding } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { CreditCard, Users, ShieldCheck, Settings, Palette, Check } from 'lucide-react';

const PRESET_COLORS: Array<{ key: MenuBranding['colorPreset']; hex: string; label: string }> = [
  { key: 'dark', hex: '#141418', label: 'Grafito oscuro' },
  { key: 'blue', hex: '#2563EB', label: 'Azul cobalto' },
  { key: 'green', hex: '#059669', label: 'Verde bosque' },
  { key: 'red', hex: '#DC2626', label: 'Rojo borgoña' },
  { key: 'purple', hex: '#7C3AED', label: 'Violeta café' },
  { key: 'orange', hex: '#D97706', label: 'Ámbar cálido' },
];

export const MenuMoreView: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const [branding, setBranding] = useState<MenuBranding>({ colorPreset: 'dark' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listMenu().then((res) => {
      if (res.branding) setBranding(res.branding);
    }).catch(() => {});
  }, []);

  const handleSelectColor = async (colorKey: MenuBranding['colorPreset']) => {
    try {
      setSaving(true);
      const updated = await api.updateMenuBranding({ colorPreset: colorKey });
      setBranding(updated);
      showToast('Color de la carta actualizado', 'success');
    } catch {
      showToast('No pudimos guardar el color', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Personalización visual de la Carta */}
      <div className="bg-[#141418] border border-[#282830] rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-[#F4F4F6]">
            Personalización de tu carta digital
          </h2>
        </div>

        {/* Logo o Imagen del Comercio */}
        <div className="flex items-center gap-3 border-b border-[#282830] pb-4">
          <div className="w-12 h-12 rounded-xl bg-[#202028] border border-[#30303C] flex items-center justify-center text-sm font-bold text-[#F4F4F6] shrink-0 overflow-hidden">
            {business?.name ? business.name.slice(0, 2).toUpperCase() : 'TQ'}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-[#F4F4F6]">{business?.name || 'Tu comercio'}</div>
            <p className="text-[11px] text-[#9E9EA8]">El logo y nombre aparecen en el encabezado de la carta.</p>
          </div>
        </div>

        {/* 6 Presets de Color */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#9E9EA8]">
            Color de acento en la carta del cliente
          </label>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                disabled={saving}
                onClick={() => handleSelectColor(preset.key)}
                style={{ backgroundColor: preset.hex }}
                className="h-10 rounded-xl flex items-center justify-center border border-white/10 hover:scale-105 transition-transform"
                title={preset.label}
              >
                {branding.colorPreset === preset.key && (
                  <Check className="w-4 h-4 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Accesos Directos a Secciones Existentes de Toque */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-[#9E9EA8]">Accesos de Toque</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/caja"
            className="p-4 bg-[#141418] border border-[#282830] hover:border-[#383844] rounded-2xl flex flex-col justify-between transition-colors"
          >
            <CreditCard className="w-5 h-5 text-emerald-400 mb-2" />
            <div>
              <div className="text-xs font-semibold text-[#F4F4F6]">Caja (POS)</div>
              <div className="text-[11px] text-[#9E9EA8]">Cobros, vueltos y sellos</div>
            </div>
          </Link>

          <Link
            to="/panel/equipo"
            className="p-4 bg-[#141418] border border-[#282830] hover:border-[#383844] rounded-2xl flex flex-col justify-between transition-colors"
          >
            <Users className="w-5 h-5 text-blue-400 mb-2" />
            <div>
              <div className="text-xs font-semibold text-[#F4F4F6]">Equipo</div>
              <div className="text-[11px] text-[#9E9EA8]">Mozos, cajeros y roles</div>
            </div>
          </Link>

          <Link
            to="/panel/cuenta"
            className="p-4 bg-[#141418] border border-[#282830] hover:border-[#383844] rounded-2xl flex flex-col justify-between transition-colors"
          >
            <ShieldCheck className="w-5 h-5 text-amber-400 mb-2" />
            <div>
              <div className="text-xs font-semibold text-[#F4F4F6]">Plan y suscripción</div>
              <div className="text-[11px] text-[#9E9EA8]">Facturación y vigencia</div>
            </div>
          </Link>

          <Link
            to="/panel/cuenta"
            className="p-4 bg-[#141418] border border-[#282830] hover:border-[#383844] rounded-2xl flex flex-col justify-between transition-colors"
          >
            <Settings className="w-5 h-5 text-[#9E9EA8] mb-2" />
            <div>
              <div className="text-xs font-semibold text-[#F4F4F6]">Cuenta</div>
              <div className="text-[11px] text-[#9E9EA8]">Datos y seguridad</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
