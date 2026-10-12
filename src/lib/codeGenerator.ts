/**
 * Toque — Generador Centralizado de Iniciales y Códigos Únicos Relacionales
 * Genera iniciales reales dinámicas a partir del nombre del cliente o fabricante.
 * 
 * Reglas:
 * 1. Toma las iniciales de las palabras significativas del nombre.
 *    Ejemplo:
 *    - "Rexi Tecnologies" -> "RT" -> "RT-01"
 *    - "Vanish Helados" -> "VH" -> "VH-01"
 *    - "Café Martínez" -> "CM" -> "CM-01"
 *    - "La Esquina Bar" -> "LE" o "EB" -> "LE-01"
 *    - "Pizzería Nápoles" -> "PN" -> "PN-01"
 *    - "Toque SaaS" -> "TS" -> "TS-01"
 * 2. Código de cartel: [Código Fabricante]-[Código Negocio]-[Número Correlativo]
 *    Ejemplo: RT-VH-01, RT-VH-02, CM-PN-01
 * 3. Código de pago: PAG-[Código Fabricante]-[Código Negocio]-[Número Correlativo]
 */

export function generateAccountCode(name: string, existingCount = 1): string {
  if (!name || !name.trim()) return `TQ-${String(existingCount).padStart(2, '0')}`;
  
  if (name.toLowerCase().includes('toque')) {
    return `TQ-${String(existingCount).padStart(2, '0')}`;
  }

  // Limpiar caracteres especiales y tildes
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();

  const words = clean.split(/\s+/).filter(w => w.length > 0);
  
  let initials = '';
  if (words.length >= 2) {
    // Primer letra de las dos primeras palabras significativas
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1) {
    // Si es una sola palabra, primeras dos o tres consonantes/letras
    initials = words[0].slice(0, 2).toUpperCase();
  }

  if (initials.length < 2) {
    initials = (clean.slice(0, 2) || 'TQ').toUpperCase();
  }

  return `${initials}-${String(existingCount).padStart(2, '0')}`;
}

export function generateCartelCode(
  mfgAccountCode: string,
  bizAccountCode: string,
  cartelIndex: number
): string {
  const mfg = mfgAccountCode ? mfgAccountCode.split('-')[0] : 'TQ';
  const biz = bizAccountCode ? bizAccountCode.split('-')[0] : 'CL';
  return `${mfg}-${biz}-${String(cartelIndex).padStart(2, '0')}`;
}

export function generatePaymentCode(
  mfgAccountCode: string,
  bizAccountCode: string,
  paymentIndex = 1
): string {
  const mfg = mfgAccountCode ? mfgAccountCode.split('-')[0] : 'TQ';
  const biz = bizAccountCode ? bizAccountCode.split('-')[0] : 'CL';
  return `PAG-${mfg}-${biz}-${String(paymentIndex).padStart(2, '0')}`;
}
