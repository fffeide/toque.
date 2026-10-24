import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface RealQrCodeProps {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
  margin?: number;
  className?: string;
  alt?: string;
}

/**
 * Generador de Código QR 100% Real y escaneable usando la librería `qrcode`.
 */
export const RealQrCode: React.FC<RealQrCodeProps> = ({
  value,
  size = 200,
  darkColor = '#0C0C0E',
  lightColor = '#FFFFFF',
  margin = 1,
  className = '',
  alt,
}) => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const safeValue = value?.trim() || 'https://toque.ar';

  useEffect(() => {
    let active = true;
    QRCode.toString(
      safeValue,
      {
        type: 'svg',
        width: size,
        margin,
        errorCorrectionLevel: 'M',
        color: {
          dark: darkColor,
          light: lightColor,
        },
      },
      (err, svg) => {
        if (!active) return;
        if (!err && svg) {
          setSvgMarkup(svg);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [safeValue, size, darkColor, lightColor, margin]);

  if (!svgMarkup) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-white rounded-lg flex items-center justify-center text-[10px] font-mono text-zinc-500 ${className}`}
      >
        QR...
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`inline-block leading-none select-none [&>svg]:w-full [&>svg]:h-full [&>svg]:block ${className}`}
      role="img"
      aria-label={alt || `Código QR para ${safeValue}`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};

/**
 * Patrones estándar CODE128-B (valores ASCII 32..126 + Start B [104] + Stop [106])
 * Permite que cualquier pistola lectora de código de barras USB/Bluetooth lea el código de socio.
 */
const CODE128_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011',
];

function encodeCode128B(text: string): string {
  const clean = (text || 'TOQUE01').replace(/[^\x20-\x7E]/g, '');
  let checksum = 104; // Start Code B
  let bits = CODE128_PATTERNS[104];

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    const validCode = code >= 0 && code < 95 ? code : 0;
    checksum += validCode * (i + 1);
    bits += CODE128_PATTERNS[validCode];
  }

  const checkIndex = checksum % 103;
  bits += CODE128_PATTERNS[checkIndex];
  bits += CODE128_PATTERNS[106]; // Stop pattern
  return bits;
}

export interface RealBarcode128Props {
  value: string;
  height?: number;
  showLabel?: boolean;
  className?: string;
}

export const RealBarcode128: React.FC<RealBarcode128Props> = ({
  value,
  height = 54,
  showLabel = true,
  className = '',
}) => {
  const cleanValue = (value || 'TQ-0001').trim().toUpperCase();
  const bits = encodeCode128B(cleanValue);
  const quietZone = 10;
  const totalWidth = bits.length + quietZone * 2;

  return (
    <div className={`inline-flex flex-col items-center bg-white px-3 py-2 rounded-xl ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full max-w-[260px] h-12 block"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Código de barras ${cleanValue}`}
      >
        <rect x="0" y="0" width={totalWidth} height={height} fill="#FFFFFF" />
        {Array.from(bits).map((bit, idx) =>
          bit === '1' ? (
            <rect
              key={idx}
              x={quietZone + idx}
              y={0}
              width={1}
              height={height}
              fill="#0C0C0E"
            />
          ) : null
        )}
      </svg>
      {showLabel && (
        <span className="mt-1 font-mono text-[11px] font-bold tracking-[0.22em] text-[#0C0C0E]">
          {cleanValue}
        </span>
      )}
    </div>
  );
};

export default RealQrCode;
