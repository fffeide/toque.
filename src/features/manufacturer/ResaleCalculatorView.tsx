/**
 * Toque — Reventa y Calculadora de Ganancia (ResaleCalculatorView)
 * Características:
 * - Calculadora de ganancia: Precio por negocio × Cantidad de negocios − Costo plan = Ingreso mensual neto y margen
 * - Plantillas de mensajes comerciales listos para WhatsApp, Instagram, Email y Mostrador
 */

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Copy,
  Check,
  MessageSquare,
  Instagram,
  Mail,
  Store,
  Sparkles,
} from 'lucide-react';

export const ResaleCalculatorView: React.FC = () => {
  const { success } = useToast();

  // Variables de la calculadora
  const [pricePerBusiness, setPricePerBusiness] = useState<number>(7500); // $7.500 ARS por negocio/mes
  const [businessCount, setBusinessCount] = useState<number>(18);
  const [planCost] = useState<number>(24899); // Costo Plan Taller 50 ($24.899/mes)

  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  // Cálculos
  const grossRevenue = pricePerBusiness * businessCount;
  const netProfit = grossRevenue - planCost;
  const marginPercentage = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;
  const annualProfit = netProfit * 12;

  const templates = [
    {
      id: 'whatsapp_pitch',
      channel: 'WhatsApp para Negocios Gastronómicos',
      icon: MessageSquare,
      color: 'text-[#25D366]',
      text: `Hola Juan, ¿cómo estás? Te escribo de Cartelería Demo. Te quería mostrar los nuevos carteles para mesa con tecnología NFC + QR que fabricamos en acrílico grabado.

Lo diferencial es que el cliente solo apoya el celular y le abre en 1 segundo la ventana oficial de Google Maps para dejarte 5 estrellas. Además incluye un panel en vivo donde podés ver cuántos comensales tocaron cada mesa y cuántas reseñas sumaste en la semana.

¿Querés que te prepare un cartel de prueba para que lo mires en el local?`,
    },
    {
      id: 'instagram_dm',
      channel: 'Instagram DM para Comercios y Barberías',
      icon: Instagram,
      color: 'text-rose-500',
      text: `Hola equipo! Felicitaciones por el local, se ve increíble.

Les escribo porque diseñamos carteles físicos para mostrador con chip NFC integrado: el cliente apoya el teléfono y le abre directo la ficha de Google para dejarles una reseña sin tener que buscar el negocio ni escribir nada.

Viene con acceso a un tablero donde ven los toques en tiempo real. Si les interesa, les enviamos fotos de cómo quedan con su logo y los precios para el local.`,
    },
    {
      id: 'delivery_pitch',
      channel: 'Pitch en Mano (Al entregar el cartel físico)',
      icon: Store,
      color: 'text-[var(--brand)]',
      text: `Acá te traje los carteles para las mesas. Te dejamos el chip grabado y probado.

Fijate que atrás viene tu código para ingresar a tu panel: desde ahí vas a poder ver qué mesa rinde más, cuántas opiniones sumás por semana y descargar los reportes. Cualquier duda me avisás directo por WhatsApp que el soporte te lo damos nosotros.`,
    },
    {
      id: 'email_proposal',
      channel: 'Propuesta Formal por Email',
      icon: Mail,
      color: 'text-[var(--ultramar)]',
      text: `Asunto: Propuesta Cartelería Inteligente NFC + Google Reviews para [Nombre del Comercio]

Estimado/a [Nombre],

Nos comunicamos desde Cartelería Demo para presentarle nuestra solución de cartelería física inteligente para puntos de venta.

Nuestros carteles combinan microchips NFC de lectura por proximidad y códigos QR de alto contraste, permitiendo que sus clientes califiquen su atención en Google Maps en menos de 5 segundos.

El servicio incluye:
1. Fabricación de carteles en acrílico de alto impacto personalizados con su marca.
2. Panel de control en tiempo real con estadísticas de toques por mesa/caja.
3. Resumen semanal automatizado vía WhatsApp o Email.
4. Garantía de continuidad física: si un cartel se rompe, se reemplaza manteniendo todo el historial.

Quedamos a su disposición para coordinar una muestra sin costo en su establecimiento.`,
    },
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(id);
    setTimeout(() => setCopiedTemplate(null), 2000);
    success('Plantilla copiada', 'Lista para pegar y personalizar con los datos del cliente.');
  };

  return (
    <div className="space-y-6 text-white">
      {/* Encabezado */}
      <div>
        <h2 className="text-xl sm:text-2xl font-headline font-bold text-white">
          Reventa y Modelos de Negocio
        </h2>
        <p className="text-xs text-white/70 mt-0.5">
          Calculá tus ingresos mensuales recurrentes y utilizá plantillas probadas para comercializar el servicio.
        </p>
      </div>

      {/* 1. CALCULADORA DE GANANCIA */}
      <Card className="p-6 space-y-6 border-white/20">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-indigo-300" />
          <h3 className="text-sm font-semibold text-white">
            Calculadora de Ingreso Mensual Recurrente
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Controles de Entrada */}
          <div className="md:col-span-2 space-y-5">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-white">
                  Precio mensual que cobrás por negocio:
                </label>
                <span className="font-mono text-xs font-bold text-emerald-300">
                  ${formatNumber(pricePerBusiness)} /mes
                </span>
              </div>
              <input
                type="range"
                min={2000}
                max={25000}
                step={500}
                value={pricePerBusiness}
                onChange={(e) => setPricePerBusiness(Number(e.target.value))}
                className="w-full accent-[var(--brand)] cursor-pointer"
              />
              <span className="text-micro text-[var(--text-muted)] block mt-1">
                Sugerido: entre $5.000 y $12.000 ARS/mes por local con carteles incluidos.
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-small font-medium text-[var(--text-main)]">
                  Cantidad de negocios clientes activos:
                </label>
                <span className="font-mono text-small font-bold text-[var(--text-main)]">
                  {businessCount} negocios
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={businessCount}
                onChange={(e) => setBusinessCount(Number(e.target.value))}
                className="w-full accent-[var(--brand)] cursor-pointer"
              />
              <span className="text-micro text-[var(--text-muted)] block mt-1">
                Con tu plan actual tenés hasta 50 carteles para distribuir entre estos comercios.
              </span>
            </div>

            {/* Fórmula explicada */}
            <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] font-mono text-micro text-[var(--text-muted)] leading-relaxed">
              ({businessCount} negocios × ${formatNumber(pricePerBusiness)}) − ${formatNumber(planCost)} costo de tu plan Toque = <strong className="text-[var(--menta)]">${formatNumber(netProfit)} netos/mes</strong>
            </div>
          </div>

          {/* Resultado de la calculadora */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[var(--brand)]/10 via-[var(--bg-card)] to-[var(--menta)]/10 border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
            <div>
              <span className="text-micro font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Tu Ganancia Neta Mensual
              </span>
              <p className="font-display text-title-1 font-extrabold text-[var(--text-main)] mt-1">
                ${formatNumber(netProfit)}
                <span className="text-small font-normal text-[var(--text-muted)]"> /mes</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-micro font-bold px-2 py-0.5 rounded-md bg-[var(--menta)]/15 text-[var(--menta)]">
                  {marginPercentage}% de margen
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1">
              <span className="text-micro text-[var(--text-muted)] block">Proyección Anualizada:</span>
              <p className="font-display text-body font-bold text-[var(--text-main)]">
                ${formatNumber(annualProfit)} ARS /año
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Ingreso recurrente predecible independiente de la venta física del cartel.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. PLANTILLAS DE MENSAJES PARA VENDER EL SERVICIO */}
      <div className="space-y-4">
        <div>
          <h3 className="font-display text-small font-semibold text-[var(--text-main)]">
            Plantillas Comerciales Listas para Enviar
          </h3>
          <p className="text-micro text-[var(--text-muted)]">
            Textos persuasivos probados para captar nuevos comercios gastronómicos y de servicios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => {
            const Icon = tpl.icon;
            const isCopied = copiedTemplate === tpl.id;
            return (
              <Card key={tpl.id} className="p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${tpl.color}`} />
                      <h4 className="font-display text-small font-semibold text-[var(--text-main)]">
                        {tpl.channel}
                      </h4>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopy(tpl.id, tpl.text)}
                      icon={isCopied ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {isCopied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>

                  <p className="text-micro text-[var(--text-muted)] whitespace-pre-line leading-relaxed p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)]">
                    {tpl.text}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
