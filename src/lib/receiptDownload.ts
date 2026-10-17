/**
 * Toque — Generador y Descarga Local de Comprobante (Imagen PNG y PDF)
 * No requiere llamadas externas ni librerías pesadas. Funciona 100% en el navegador.
 */

import { Receipt } from '../api/types';
import { formatCurrency, formatDate } from './formatters';

export async function downloadReceiptAsImage(receipt: Receipt): Promise<void> {
  const canvas = document.createElement('canvas');
  const width = 600;
  const padding = 40;
  const lineHeight = 28;
  const itemsCount = receipt.items.length;
  const height = 480 + itemsCount * lineHeight;

  canvas.width = width * 2; // Alta resolución retina
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(2, 2);

  // Fondo Papel
  ctx.fillStyle = '#F7F4EE';
  ctx.fillRect(0, 0, width, height);

  // Borde
  ctx.strokeStyle = '#E3DDD2';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Cabecera
  ctx.fillStyle = '#0B1030';
  ctx.font = 'bold 24px Sora, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(receipt.businessName, width / 2, 70);

  ctx.fillStyle = '#5E6072';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText(formatDate(receipt.createdAt), width / 2, 100);

  // Línea divisoria
  ctx.beginPath();
  ctx.strokeStyle = '#E3DDD2';
  ctx.setLineDash([4, 4]);
  ctx.moveTo(padding, 125);
  ctx.lineTo(width - padding, 125);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ítems
  let currentY = 160;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillStyle = '#5E6072';
  ctx.fillText('CONCEPTO', padding, currentY);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL', width - padding, currentY);

  currentY += 20;

  for (const item of receipt.items) {
    ctx.textAlign = 'left';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillStyle = '#0B1030';
    const label = item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name;
    ctx.fillText(label, padding, currentY);

    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(item.price * item.quantity), width - padding, currentY);
    currentY += lineHeight;
  }

  // Línea divisoria total
  currentY += 10;
  ctx.beginPath();
  ctx.strokeStyle = '#E3DDD2';
  ctx.moveTo(padding, currentY);
  ctx.lineTo(width - padding, currentY);
  ctx.stroke();

  // Total
  currentY += 35;
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px Sora, sans-serif';
  ctx.fillStyle = '#0B1030';
  ctx.fillText('TOTAL', padding, currentY);

  ctx.textAlign = 'right';
  ctx.font = 'bold 26px Sora, sans-serif';
  ctx.fillText(formatCurrency(receipt.total), width - padding, currentY);

  // Medio de pago y cartel
  currentY += 30;
  ctx.textAlign = 'left';
  ctx.font = '13px Inter, sans-serif';
  ctx.fillStyle = '#5E6072';
  const methodLabel = receipt.method === 'mp_qr' ? 'Mercado Pago QR' : receipt.method === 'cash' ? 'Efectivo' : 'Posnet / Tarjeta';
  ctx.fillText(`Medio: ${methodLabel}`, padding, currentY);
  ctx.textAlign = 'right';
  ctx.font = '13px JetBrains Mono, monospace';
  ctx.fillText(`Cartel: ${receipt.cartelCode}`, width - padding, currentY);

  // Pie legal obligatorio (Regla de Oro 6)
  currentY += 45;
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillStyle = '#B8332A'; // Coral suave
  ctx.fillText('Comprobante de compra. No es una factura.', width / 2, currentY);

  currentY += 25;
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = '#5E6072';
  ctx.fillText('Toque · Tu cartel, con datos', width / 2, currentY);

  // Descarga del archivo
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `comprobante-${receipt.cartelCode}-${receipt.id.slice(-4)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadReceiptAsPdf(receipt: Receipt): void {
  // Construcción de documento imprimible como PDF nativo del navegador
  const methodLabel = receipt.method === 'mp_qr' ? 'Mercado Pago QR' : receipt.method === 'cash' ? 'Efectivo' : 'Posnet / Tarjeta';
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html lang="es-AR">
      <head>
        <meta charset="utf-8">
        <title>Comprobante ${receipt.businessName}</title>
        <style>
          @page { size: 80mm 160mm; margin: 4mm; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #F7F4EE;
            color: #0B1030;
            margin: 0;
            padding: 16px;
            font-size: 13px;
          }
          .title { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 4px; }
          .date { text-align: center; color: #5E6072; font-size: 11px; margin-bottom: 12px; }
          .divider { border-top: 1px dashed #E3DDD2; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 12px; }
          .legal { color: #B8332A; font-weight: bold; font-size: 11px; text-align: center; margin-top: 18px; }
          .footer { color: #5E6072; font-size: 10px; text-align: center; margin-top: 6px; }
        </style>
      </head>
      <body>
        <div class="title">${receipt.businessName}</div>
        <div class="date">${formatDate(receipt.createdAt)}</div>
        <div class="divider"></div>
        ${receipt.items.map(it => `
          <div class="item">
            <span>${it.quantity > 1 ? `${it.quantity}x ` : ''}${it.name}</span>
            <span>${formatCurrency(it.price * it.quantity)}</span>
          </div>
        `).join('')}
        <div class="divider"></div>
        <div class="total">
          <span>TOTAL</span>
          <span>${formatCurrency(receipt.total)}</span>
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: #5E6072; display: flex; justify-content: space-between;">
          <span>Medio: ${methodLabel}</span>
          <span style="font-family: monospace;">${receipt.cartelCode}</span>
        </div>
        <div class="legal">Comprobante de compra. No es una factura.</div>
        <div class="footer">Toque · Tu cartel, con datos</div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
