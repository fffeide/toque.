/**
 * Toque — Reportes Semanales y Mensuales (ReportsView)
 * Características:
 * - Vista previa del resumen semanal en 3 líneas
 * - UNA sola acción sugerida accionable
 * - Historial consolidado mensual
 * - Descarga y vista imprimible en PDF
 * - Configuración de entrega (día, hora, Email / WhatsApp)
 */

import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { api, Report, WeeklyReportPreview, ReportConfig } from '../../api';
import { useDataQuery } from '../../hooks/useDataQuery';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  Smartphone,
  QrCode,
  Calendar,
  Settings,
  Mail,
  MessageSquare,
  Lightbulb,
  Check,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { tenant } = useAuth();
  const { success, error: toastError } = useToast();
  const businessId = tenant?.type === 'business' ? tenant.id : 'biz-esquina';

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedReportForPdf, setSelectedReportForPdf] = useState<Report | null>(null);

  // Configuración de reportes
  const [deliveryDay, setDeliveryDay] = useState<'monday' | 'friday' | 'sunday'>('monday');
  const [deliveryHour, setDeliveryHour] = useState('09:00');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('both');
  const [emailRecipient, setEmailRecipient] = useState(tenant?.contactEmail || 'hola@cafedelaesquina.ar');
  const [whatsappPhone, setWhatsappPhone] = useState('+54 9 11 4455-8899');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // 1. Resumen semanal en 3 líneas + acción sugerida
  const {
    data: weeklyPreview,
    isLoading: isLoadingWeekly,
    refetch: refetchWeekly,
  } = useDataQuery<WeeklyReportPreview>({
    queryFn: () => api.getWeeklyReportPreview(businessId),
  });

  // 2. Historial de reportes mensuales
  const {
    data: reports,
    isLoading: isLoadingReports,
    isError: isErrorReports,
    error: errorReports,
    refetch: refetchReports,
  } = useDataQuery<Report[]>({
    queryFn: () => api.listReports(businessId),
  });

  // 3. Configuración actual
  const {
    data: configData,
    refetch: refetchConfig,
  } = useDataQuery<ReportConfig>({
    queryFn: async () => {
      const cfg = await api.getReportConfig(businessId);
      setDeliveryDay(cfg.deliveryDay);
      setDeliveryHour(cfg.deliveryHour);
      setChannel(cfg.channel);
      setEmailRecipient(cfg.emailRecipient);
      setWhatsappPhone(cfg.whatsappPhone);
      return cfg;
    },
  });

  const monthNames: Record<string, string> = {
    '2026-09': 'Septiembre 2026',
    '2026-08': 'Agosto 2026',
    '2026-07': 'Julio 2026',
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await api.updateReportConfig(businessId, {
        deliveryDay,
        deliveryHour,
        channel,
        emailRecipient,
        whatsappPhone,
      });
      success('Configuración de reportes guardada', 'Recibirás el resumen en el día y horario elegido.');
      setIsConfigOpen(false);
      refetchConfig();
    } catch (err) {
      toastError('No se pudo guardar la configuración', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  if (isErrorReports) {
    return (
      <div className="py-12">
        <ErrorState
          title="No pudimos cargar los reportes"
          message={errorReports?.message}
          onRetry={refetchReports}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera y botón de configuración */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight">
            Reportes del Negocio
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Resumen semanal condensado y rendimiento histórico mensual.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => setIsConfigOpen(true)}
            icon={<Settings className="w-4 h-4 text-white" />}
          >
            Configurar envíos
          </Button>
        </div>
      </div>

      {/* 1. VISTA PREVIA DEL RESUMEN SEMANAL EN 3 LÍNEAS + ACCIÓN SUGERIDA */}
      <Card className="p-6 relative overflow-hidden border-white/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
            <Calendar className="w-4 h-4" />
            <span className="uppercase tracking-wider font-semibold">Resumen Semanal Condensado</span>
            <span className="text-white/60">• {weeklyPreview?.period || 'Últimos 7 días'}</span>
          </div>

          <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
            Se envía cada lunes a las 09:00 h
          </span>
        </div>

        {isLoadingWeekly || !weeklyPreview ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Las 3 líneas claras */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
              <p className="text-small font-medium text-white flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/20 text-white font-bold text-micro flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>{weeklyPreview.line1}</span>
              </p>
              <p className="text-small font-medium text-white flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/20 text-white font-bold text-micro flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>{weeklyPreview.line2}</span>
              </p>
              <p className="text-small font-medium text-white flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/20 text-white font-bold text-micro flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>{weeklyPreview.line3}</span>
              </p>
            </div>

            {/* UNA ACCIÓN SUGERIDA */}
            <div className="p-4 rounded-xl bg-amber-400/10 border border-amber-300/30 flex items-start gap-3 backdrop-blur-md">
              <Lightbulb className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-micro uppercase font-semibold text-amber-300 tracking-wider">
                  Acción sugerida para esta semana
                </p>
                <p className="text-small font-medium text-white/90 mt-0.5">
                  {weeklyPreview.suggestedAction}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 2. HISTORIAL DE REPORTES MENSUALES */}
      <div className="space-y-4">
        <h3 className="font-headline text-lg font-semibold text-white">
          Historial Mensual Consolidado
        </h3>

        {isLoadingReports ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : !reports || reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="Aún no hay reportes mensuales"
            description="El primer reporte se consolidará al cierre del ciclo del mes corriente."
          />
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Card key={report.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--brand)]" />
                    <h4 className="font-display text-body font-semibold text-[var(--text-main)]">
                      {monthNames[report.month] || report.month}
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-[var(--text-muted)]">
                    <span>Total: <strong className="text-[var(--text-main)]">{formatNumber(report.totalScans)}</strong> toques</span>
                    <span>•</span>
                    <span>NFC: <strong className="text-[var(--text-main)]">{formatNumber(report.nfcScans)}</strong></span>
                    <span>•</span>
                    <span>QR: <strong className="text-[var(--text-main)]">{formatNumber(report.qrScans)}</strong></span>
                    <span>•</span>
                    <span>Reseñas estimadas: <strong className="text-[var(--menta)]">~{report.estimatedReviews}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedReportForPdf(report)}
                    icon={<Download className="w-3.5 h-3.5" />}
                  >
                    Descargar PDF
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: VISTA PREVIA IMPRIMIBLE DE PDF */}
      {selectedReportForPdf && (
        <Dialog
          isOpen={!!selectedReportForPdf}
          onClose={() => setSelectedReportForPdf(null)}
          title={`Reporte de ${monthNames[selectedReportForPdf.month] || selectedReportForPdf.month}`}
          size="md"
        >
          <div className="space-y-6 pt-2">
            {/* Hoja de reporte formateada estilo documento */}
            <div className="printable-sheet p-6 rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-slate-200">
                <div>
                  <h2 className="font-display text-title-2 font-bold text-slate-900">
                    Toque — Informe Mensual
                  </h2>
                  <p className="text-small text-slate-600 mt-0.5">
                    {tenant?.name || 'Café & Bistro La Esquina'}
                  </p>
                </div>
                <div className="text-right text-micro text-slate-500 font-mono">
                  {monthNames[selectedReportForPdf.month] || selectedReportForPdf.month}
                </div>
              </div>

              {/* Métricas clave */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-micro text-slate-500 uppercase font-semibold">Total Toques</p>
                  <p className="font-display text-title-2 font-bold text-slate-900 mt-1">
                    {formatNumber(selectedReportForPdf.totalScans)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-micro text-slate-500 uppercase font-semibold">NFC vs QR</p>
                  <p className="font-display text-body font-bold text-slate-900 mt-1">
                    {Math.round((selectedReportForPdf.nfcScans / selectedReportForPdf.totalScans) * 100)}% NFC
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {Math.round((selectedReportForPdf.qrScans / selectedReportForPdf.totalScans) * 100)}% QR
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-micro text-slate-500 uppercase font-semibold">Reseñas Est.</p>
                  <p className="font-display text-title-2 font-bold text-emerald-600 mt-1">
                    ~{selectedReportForPdf.estimatedReviews}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-small text-slate-700 space-y-2">
                <p className="font-semibold text-slate-900">Conclusión del período:</p>
                <p className="text-micro leading-relaxed text-slate-600">
                  Durante este mes se canalizaron {selectedReportForPdf.totalScans} aperturas directas a la ficha oficial de Google Maps sin fricción. La tecnología NFC continúa siendo el canal preferido por los comensales.
                </p>
              </div>

              <div className="text-micro text-slate-400 text-center border-t pt-3 border-slate-100">
                Generado por Toque SaaS • "Tu cartel, con datos."
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  window.print();
                  success('Impresión preparada', 'Guardá como PDF o enviá a tu impresora.');
                }}
                icon={<Printer className="w-4 h-4" />}
              >
                Imprimir o Guardar PDF
              </Button>
              <Button variant="ghost" onClick={() => setSelectedReportForPdf(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL 2: CONFIGURACIÓN DE ENVÍOS */}
      <Dialog
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        title="Configurar entrega del reporte"
        description="Elegí cuándo y cómo querés que te llegue el resumen a tu celular o casilla."
        size="md"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
          {/* Día de la semana */}
          <div>
            <label className="block text-small font-medium text-[var(--text-main)] mb-1.5">
              Día de entrega
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'monday', label: 'Lunes' },
                { id: 'friday', label: 'Viernes' },
                { id: 'sunday', label: 'Domingo' },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDeliveryDay(d.id as any)}
                  className={`py-2 px-3 rounded-xl border text-small font-medium transition cursor-pointer ${
                    deliveryDay === d.id
                      ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--text-main)] font-semibold'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horario */}
          <Input
            label="Hora de entrega"
            type="time"
            value={deliveryHour}
            onChange={(e) => setDeliveryHour(e.target.value)}
          />

          {/* Canal de entrega */}
          <div>
            <label className="block text-small font-medium text-[var(--text-main)] mb-1.5">
              Medio de notificación
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'email', label: 'Email', icon: Mail },
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                { id: 'both', label: 'Ambos', icon: Smartphone },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id as any)}
                    className={`py-2 px-3 rounded-xl border text-small font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      channel === c.id
                        ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--text-main)] font-semibold'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(channel === 'email' || channel === 'both') && (
            <Input
              label="Email de entrega"
              type="email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder="dueño@minegocio.ar"
              required
            />
          )}

          {(channel === 'whatsapp' || channel === 'both') && (
            <Input
              label="WhatsApp de entrega"
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+54 9 11 4455-8899"
              required
            />
          )}

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsConfigOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSavingConfig}
            >
              Guardar configuración
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
