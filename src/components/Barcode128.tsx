import React, { useMemo } from 'react';

export interface Barcode128Props {
  value: string;
  height?: number;
  className?: string;
}

/**
 * Tabla estándar ISO/IEC 15417 para Code 128 Subset B (caracteres ASCII 32..127)
 * Cada símbolo tiene 11 módulos (3 barras y 3 espacios), salvo el Stop (106) que tiene 13 módulos.
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

function encodeCode128B(rawText: string): string {
  const clean = (rawText || '48291037').trim();
  const startCodeB = 104;
  let checksum = startCodeB;
  let bits = CODE128_PATTERNS[startCodeB];

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const codeValue = charCode >= 32 && charCode <= 126 ? charCode - 32 : 16; // default '0'
    checksum += codeValue * (i + 1);
    bits += CODE128_PATTERNS[codeValue];
  }

  const checksumIndex = checksum % 103;
  bits += CODE128_PATTERNS[checksumIndex];
  bits += CODE128_PATTERNS[106]; // Stop pattern
  return bits;
}

export const Barcode128: React.FC<Barcode128Props> = ({
  value,
  height = 56,
  className = '',
}) => {
  const displayValue = useMemo(() => {
    const raw = (value || '').trim();
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length === 8) return digitsOnly;
    return raw || '48291037';
  }, [value]);

  const barsBitString = useMemo(() => encodeCode128B(displayValue), [displayValue]);

  const barRects = useMemo(() => {
    const rects: Array<{ x: number; w: number }> = [];
    let i = 0;
    while (i < barsBitString.length) {
      if (barsBitString[i] === '1') {
        let w = 0;
        const startX = i;
        while (i < barsBitString.length && barsBitString[i] === '1') {
          w++;
          i++;
        }
        rects.push({ x: startX, w });
      } else {
        i++;
      }
    }
    return rects;
  }, [barsBitString]);

  const totalUnits = barsBitString.length + 16; // quiet zones

  return (
    <div
      className={`bg-white p-3 rounded-xl flex flex-col items-center justify-center w-full max-w-[290px] mx-auto shadow-sm ${className}`}
    >
      <svg
        viewBox={`0 0 ${totalUnits} ${height}`}
        className="w-full h-14 block"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Código de barras ${displayValue}`}
      >
        <rect x="0" y="0" width={totalUnits} height={height} fill="#FFFFFF" />
        {barRects.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x + 8}
            y={2}
            width={bar.w}
            height={height - 4}
            fill="#0F172A"
          />
        ))}
      </svg>
      <div className="text-xl font-mono font-bold tracking-[0.25em] text-slate-900 mt-1.5 text-center select-all">
        {displayValue}
      </div>
    </div>
  );
};

export default Barcode128;
