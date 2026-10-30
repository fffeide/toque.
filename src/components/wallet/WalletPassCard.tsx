import React from 'react';
import { RealQrCode } from '../ui/RealQrCode';
import { ColorPreset, COLOR_PRESET_HEX } from '../../lib/walletwalletClient';
export type { ColorPreset };

export interface WalletPassCardProps {
  businessName: string;
  cardTitle?: string;
  memberName?: string;
  stamps: number;
  stampsRequired: number;
  rewardText: string;
  barcodeToken: string;
  shortCode?: string;
  colorPreset?: ColorPreset;
  customColor?: string;
  logoURL?: string;
  logoUrl?: string;
  wideLogoUrl?: string;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

export function resolvePassBackgroundColor(
  colorPreset: ColorPreset = 'dark',
  customColor?: string
): string {
  if (customColor && /^#[0-9A-Fa-f]{6}$/.test(customColor.trim())) {
    return customColor.trim();
  }
  return COLOR_PRESET_HEX[colorPreset] || COLOR_PRESET_HEX.dark;
}

/**
 * Tarjeta del cliente:
 * Muestra siempre el código corto debajo del QR y los campos fijos SELLOS, PREMIO y SOCIO.
 */
export const WalletPassCard: React.FC<WalletPassCardProps> = ({
  businessName,
  cardTitle,
  memberName,
  stamps,
  stampsRequired,
  rewardText,
  barcodeToken,
  shortCode,
  colorPreset = 'dark',
  customColor,
  logoURL,
  logoUrl,
  compact = false,
  onClick,
  className = '',
}) => {
  const effectiveLogo = logoURL || logoUrl;
  const bgColor = resolvePassBackgroundColor(colorPreset, customColor);
  const cleanTitle = (cardTitle || businessName || 'Comercio').slice(0, 44);
  const cleanMemberName = memberName ? memberName.trim().slice(0, 40) : '';
  const cleanRewardText = (rewardText || 'Beneficio al completar tus sellos').slice(0, 60);

  const immutableCode = (shortCode || barcodeToken || 'K7M2-9XQ4').trim().toUpperCase();

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ backgroundColor: bgColor }}
        className={`w-full text-left rounded-2xl p-4 border border-white/10 shadow-lg transition-transform active:scale-[0.99] hover:border-white/20 focus:outline-none ${className}`}
      >
        <div className="flex items-start justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {effectiveLogo ? (
              <img
                src={effectiveLogo}
                alt={cleanTitle}
                className="w-7 h-7 rounded-lg object-cover bg-black/20 shrink-0 border border-white/10"
              />
            ) : null}
            <span className="font-semibold text-white text-sm truncate">
              {cleanTitle}
            </span>
          </div>

          {cleanMemberName ? (
            <div className="text-right shrink-0">
              <div className="text-[9px] font-semibold tracking-wider text-white/60">
                SOCIO
              </div>
              <div className="text-[11px] font-medium text-white truncate max-w-[100px]">
                {cleanMemberName}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold tracking-wider text-white/60 mb-0.5">
              SELLOS
            </div>
            <div className="text-xl font-bold text-white tracking-tight leading-none">
              {stamps} / {stampsRequired}
            </div>
          </div>

          <div className="text-right min-w-0 flex-1">
            <div className="text-[9px] font-semibold tracking-wider text-white/60 mb-0.5">
              PREMIO
            </div>
            <div className="text-xs font-medium text-white/95 truncate">
              {cleanRewardText}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
          <span className="text-white/60">Código de tarjeta</span>
          <span className="font-mono font-bold tracking-wider text-white">{immutableCode}</span>
        </div>
      </button>
    );
  }

  return (
    <div
      style={{ backgroundColor: bgColor }}
      className={`w-full rounded-[24px] p-5 sm:p-6 text-white border border-white/15 shadow-2xl flex flex-col justify-between select-none ${className}`}
    >
      {/* Fila superior: Logo + Nombre de tarjeta/negocio a la izquierda | SOCIO + nombre a la derecha */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          {effectiveLogo ? (
            <img
              src={effectiveLogo}
              alt={cleanTitle}
              className="w-8 h-8 rounded-lg object-cover bg-black/25 shrink-0 border border-white/10"
            />
          ) : null}
          <span className="font-semibold text-[15px] leading-snug text-white truncate">
            {cleanTitle}
          </span>
        </div>

        {cleanMemberName ? (
          <div className="text-right shrink-0">
            <div className="text-[10px] font-semibold tracking-wider text-white/65">
              SOCIO
            </div>
            <div className="text-xs font-medium text-white truncate max-w-[120px] mt-0.5">
              {cleanMemberName}
            </div>
          </div>
        ) : null}
      </div>

      {/* Centro (primaryFields): SELLOS */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold tracking-wider text-white/65 mb-1">
          SELLOS
        </div>
        <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none">
          {stamps} / {stampsRequired}
        </div>
      </div>

      {/* Bloque secundario (secondaryFields): PREMIO */}
      <div className="mb-5">
        <div className="text-[10px] font-semibold tracking-wider text-white/65 mb-1">
          PREMIO
        </div>
        <div className="text-sm font-medium text-white/95 leading-snug break-words">
          {cleanRewardText}
        </div>
      </div>

      {/* Pie centrado: Código QR inmutable + Código corto SIEMPRE visible debajo del QR */}
      <div className="flex flex-col items-center justify-center pt-1 pb-1 space-y-2.5">
        <div className="bg-white p-3 rounded-2xl shadow-md inline-flex items-center justify-center">
          <RealQrCode
            value={immutableCode}
            size={140}
            darkColor="#000000"
            lightColor="#FFFFFF"
            margin={0}
            alt="Código QR de tu tarjeta de sellos"
          />
        </div>

        <div className="text-center">
          <span className="block text-xl sm:text-2xl font-mono font-extrabold tracking-widest text-white select-all">
            {immutableCode}
          </span>
          <span className="block text-[10px] text-white/65 font-medium mt-0.5">
            Código para mostrar o dictar en caja
          </span>
        </div>
      </div>
    </div>
  );
};

export default WalletPassCard;
