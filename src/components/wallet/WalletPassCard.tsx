import React from 'react';
import { RealQrCode } from '../ui/RealQrCode';
import { ColorPreset, COLOR_PRESET_HEX } from '../../lib/walletwalletClient';

export interface WalletPassCardProps {
  businessName: string;
  memberName?: string;
  stamps: number;
  stampsRequired: number;
  rewardText: string;
  barcodeToken: string;
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
 * Espejo exacto de la tarjeta generada por WalletWallet (buildBody).
 * Se usa tanto en la vista del cliente (Toquecitos y Hub público) como en la vista previa del comercio.
 * Solo las 3 etiquetas nativas de Wallet (SOCIO, SELLOS, PREMIO) van en mayúsculas.
 * El QR nunca muestra texto ni código debajo (barcodeAltText: '').
 */
export const WalletPassCard: React.FC<WalletPassCardProps> = ({
  businessName,
  memberName,
  stamps,
  stampsRequired,
  rewardText,
  barcodeToken,
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
  const cleanBusinessName = (businessName || 'Comercio').slice(0, 40);
  const cleanMemberName = memberName ? memberName.trim().slice(0, 40) : '';
  const cleanRewardText = (rewardText || 'Beneficio al completar tus sellos').slice(0, 60);
  const safeToken =
    barcodeToken && barcodeToken.trim().length >= 16
      ? barcodeToken.trim()
      : 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ backgroundColor: bgColor }}
        className={`w-full text-left rounded-2xl p-5 border border-white/10 shadow-lg transition-transform active:scale-[0.99] hover:border-white/20 focus:outline-none ${className}`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {effectiveLogo ? (
              <img
                src={effectiveLogo}
                alt={cleanBusinessName}
                className="w-8 h-8 rounded-lg object-cover bg-black/20 shrink-0 border border-white/10"
              />
            ) : null}
            <span className="font-semibold text-white text-base truncate">
              {cleanBusinessName}
            </span>
          </div>

          {cleanMemberName ? (
            <div className="text-right shrink-0">
              <div className="text-[10px] font-semibold tracking-wider text-white/60">
                SOCIO
              </div>
              <div className="text-xs font-medium text-white truncate max-w-[110px]">
                {cleanMemberName}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-white/60 mb-0.5">
              SELLOS
            </div>
            <div className="text-2xl font-bold text-white tracking-tight leading-none">
              {stamps} / {stampsRequired}
            </div>
          </div>

          <div className="text-right min-w-0 flex-1">
            <div className="text-[10px] font-semibold tracking-wider text-white/60 mb-0.5">
              PREMIO
            </div>
            <div className="text-xs font-medium text-white/95 truncate">
              {cleanRewardText}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      style={{ backgroundColor: bgColor }}
      className={`w-full rounded-[24px] p-6 text-white border border-white/15 shadow-2xl flex flex-col justify-between select-none ${className}`}
    >
      {/* Fila superior: Logo + Nombre del negocio a la izquierda | SOCIO + nombre a la derecha */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5 min-w-0">
          {effectiveLogo ? (
            <img
              src={effectiveLogo}
              alt={cleanBusinessName}
              className="w-9 h-9 rounded-lg object-cover bg-black/25 shrink-0 border border-white/10"
            />
          ) : null}
          <span className="font-semibold text-[15px] leading-snug text-white truncate">
            {cleanBusinessName}
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
      <div className="mb-5">
        <div className="text-[11px] font-semibold tracking-wider text-white/65 mb-1">
          SELLOS
        </div>
        <div className="text-4xl font-bold text-white tracking-tight leading-none">
          {stamps} / {stampsRequired}
        </div>
      </div>

      {/* Bloque secundario (secondaryFields): PREMIO */}
      <div className="mb-7">
        <div className="text-[11px] font-semibold tracking-wider text-white/65 mb-1">
          PREMIO
        </div>
        <div className="text-sm font-medium text-white/95 leading-snug break-words">
          {cleanRewardText}
        </div>
      </div>

      {/* Pie centrado: Código QR real sobre contenedor blanco limpio, SIN texto debajo */}
      <div className="flex justify-center pt-1 pb-1">
        <div className="bg-white p-3.5 rounded-2xl shadow-md inline-flex items-center justify-center">
          <RealQrCode
            value={safeToken}
            size={148}
            darkColor="#000000"
            lightColor="#FFFFFF"
            margin={0}
            alt="Código QR de tu tarjeta de sellos"
          />
        </div>
      </div>
    </div>
  );
};

export default WalletPassCard;
