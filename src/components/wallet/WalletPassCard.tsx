import React from 'react';
import { Barcode128 } from '../Barcode128';
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

export function ensure8DigitBarcode(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return digits;
  if (digits.length > 8) return digits.slice(0, 8);
  let hash = 48291037;
  const str = String(raw || '48291037');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 90000000;
  }
  return String(10000000 + Math.abs(hash));
}

/**
 * Tarjeta visual del cliente sincronizada con el diseño del comercio:
 * Muestra el logo, nombre del comercio, Sellos, Premio, Cliente y el código de barras CODE128 con los 8 números grandes debajo.
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

  const numericCode = ensure8DigitBarcode(barcodeToken || shortCode);

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
            ) : (
              <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
                {cleanTitle.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-white text-sm truncate">
              {cleanTitle}
            </span>
          </div>

          {cleanMemberName ? (
            <div className="text-right shrink-0">
              <div className="text-[10px] font-medium text-white/65">
                Cliente
              </div>
              <div className="text-xs font-medium text-white truncate max-w-[100px]">
                {cleanMemberName}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium text-white/65 mb-0.5">
              Sellos acumulados
            </div>
            <div className="text-xl font-bold text-white tracking-tight leading-none">
              {stamps} de {stampsRequired}
            </div>
          </div>

          <div className="text-right min-w-0 flex-1">
            <div className="text-[10px] font-medium text-white/65 mb-0.5">
              Premio disponible
            </div>
            <div className="text-xs font-medium text-white/95 truncate">
              {cleanRewardText}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
          <span className="text-white/65">Código de barras</span>
          <span className="font-mono font-bold tracking-wider text-white">{numericCode}</span>
        </div>
      </button>
    );
  }

  return (
    <div
      style={{ backgroundColor: bgColor }}
      className={`w-full rounded-[24px] p-5 sm:p-6 text-white border border-white/15 shadow-2xl flex flex-col justify-between select-none ${className}`}
    >
      {/* Fila superior: Logo + Nombre del comercio a la izquierda | Cliente a la derecha */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          {effectiveLogo ? (
            <img
              src={effectiveLogo}
              alt={cleanTitle}
              className="w-8 h-8 rounded-lg object-cover bg-black/25 shrink-0 border border-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {cleanTitle.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-[15px] leading-snug text-white truncate">
            {cleanTitle}
          </span>
        </div>

        {cleanMemberName ? (
          <div className="text-right shrink-0">
            <div className="text-[11px] font-medium text-white/65">
              Cliente
            </div>
            <div className="text-xs font-medium text-white truncate max-w-[120px] mt-0.5">
              {cleanMemberName}
            </div>
          </div>
        ) : null}
      </div>

      {/* Centro (primaryFields): Sellos */}
      <div className="mb-4">
        <div className="text-xs font-medium text-white/70 mb-1">
          Sellos: {stamps} / {stampsRequired}
        </div>
        <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none">
          {stamps} / {stampsRequired}
        </div>
      </div>

      {/* Bloque secundario (secondaryFields): Premio */}
      <div className="mb-5">
        <div className="text-xs font-medium text-white/70 mb-1">
          Premio
        </div>
        <div className="text-sm font-medium text-white/95 leading-snug break-words">
          {cleanRewardText}
        </div>
      </div>

      {/* Pie centrado: Código de barras CODE128 en SVG real + número de 8 dígitos grande debajo */}
      <div className="pt-1 pb-1">
        <Barcode128 value={numericCode} />
      </div>
    </div>
  );
};

export default WalletPassCard;
