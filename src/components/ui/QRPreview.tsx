/**
 * Toque — Vista Previa de Código QR (QRPreview)
 * Renderizado de alta resolución para imprimir o probar en pantalla.
 */

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode as QrIcon } from 'lucide-react';
import { Button } from './Button';

export interface QRPreviewProps {
  url: string;
  shortCode?: string;
  cartelName?: string;
  size?: number;
}

export const QRPreview: React.FC<QRPreviewProps> = ({
  url,
  shortCode = '',
  cartelName,
  size = 200,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 2,
      color: {
        dark: '#0B1030',
        light: '#FFFFFF',
      },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [url, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `toque-qr-${shortCode}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-2xl border border-[var(--border-subtle)] shadow-xs text-center text-slate-900">
      <div className="relative p-2 bg-white rounded-xl">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`Código QR para el cartel ${cartelName || shortCode}`}
            style={{ width: size, height: size }}
            className="rounded-lg object-contain"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-slate-100 rounded-lg text-slate-400"
          >
            <QrIcon className="w-8 h-8 animate-pulse" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <span className="text-micro text-slate-500 block">Código del cartel</span>
        <span className="font-mono text-small font-bold text-slate-900 tracking-wider">
          {shortCode}
        </span>
      </div>

      <div className="mt-3 w-full">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDownload}
          leftIcon={<Download className="w-3.5 h-3.5" />}
          className="w-full text-xs"
        >
          Descargar QR en PNG
        </Button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
