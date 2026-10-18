/**
 * Generador determinístico de matriz QR en SVG y exportación a SVG/PNG
 * Sin dependencias externas pesadas ni llamadas de red.
 */

function hashChar(str: string, index: number): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i) + index * 31;
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function generateQrSvg(text: string, size = 220): string {
  const grid = 25;
  const quietZone = 2;
  const totalModules = grid + quietZone * 2;
  const matrix: boolean[][] = Array.from({ length: grid }, () => Array(grid).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[r0 + r][c0 + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, grid - 7);
  drawFinder(grid - 7, 0);

  // Patrones de sincronización
  for (let i = 8; i < grid - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Datos determinísticos basados en el texto/URL
  let bitIdx = 0;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= grid - 8;
      const inBottomLeft = r >= grid - 8 && c < 8;
      const isTiming = r === 6 || c === 6;
      if (inTopLeft || inTopRight || inBottomLeft || isTiming) continue;

      const h = hashChar(text, bitIdx++);
      matrix[r][c] = h % 2 === 0;
    }
  }

  let rects = '';
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + quietZone}" y="${r + quietZone}" width="1" height="1" rx="0.15" fill="#0c0c0c"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${totalModules}" height="${totalModules}" fill="#f1f1ee" rx="1.5"/>${rects}</svg>`;
}

export function downloadSvg(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPng(svgContent: string, filename: string, size = 800): void {
  const img = new Image();
  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f1f1ee';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename;
      a.click();
    }
    URL.revokeObjectURL(url);
  };

  img.src = url;
}
