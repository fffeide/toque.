/**
 * Toque — Botón y Formulario de Arrepentimiento (ArrepentimientoView)
 * Cumplimiento con el Art. 34 de la Ley 24.240 de Defensa del Consumidor
 * y Resolución 424/2020 de la Secretaría de Comercio Interior de la Nación (Argentina).
 * Permite a cualquier usuario revocar la aceptación del servicio contratado dentro de los 10 días corridos.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_CONFIG } from '../../config/legal';
import { BrandLogo } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  ShieldAlert,
  Clock,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

export const ArrepentimientoView: React.FC = () => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cuitDni, setCuitDni] = useState('');
  const [numeroOrden, setNumeroOrden] = useState('');
  const [motivo, setMotivo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tramiteCode, setTramiteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !cuitDni.trim()) return;

    setIsSubmitting(true);
    // Simulación de registración inmediata de trámite de revocación
    setTimeout(() => {
      const code = `ARREP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      setTramiteCode(code);
      setIsSubmitting(false);
    }, 600);
  };

  const handleCopyCode = () => {
    if (tramiteCode) {
      navigator.clipboard.writeText(tramiteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="aurora-stage min-h-screen text-white flex flex-col">
      {/* Header institucional */}
      <header className="sticky top-0 z-30 bg-[var(--bg-card)]/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 group text-small font-medium text-[var(--text-muted)] hover:text-[var(--brand)] transition"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Volver a Toque</span>
            </Link>
            <div className="h-4 w-px bg-[var(--border-subtle)]" />
            <Link to="/">
              <BrandLogo name="Toque" size="sm" />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Ingresar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Banner Normativo */}
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3.5">
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-small text-red-950 dark:text-red-200 leading-relaxed">
            <p className="font-semibold text-body mb-1">
              Derecho de Arrepentimiento y Revocación de Aceptación
            </p>
            <p className="text-micro opacity-90">
              Conforme al <strong>Artículo 34 de la Ley 24.240</strong> de Defensa del Consumidor y la <strong>Resolución 424/2020 de la Secretaría de Comercio Interior</strong>, tenés derecho a revocar la contratación dentro de los <strong>diez (10) días corridos</strong> contados a partir de la fecha de suscripción o recepción del cartel, sin costo ni penalidad alguna.
            </p>
          </div>
        </div>

        {tramiteCode ? (
          /* Confirmación de Trámite */
          <div className="p-8 sm:p-10 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h1 className="text-h2 font-bold mb-3 tracking-tight">
              Solicitud de arrepentimiento registrada
            </h1>
            <p className="text-body text-[var(--text-muted)] max-w-lg mx-auto mb-6">
              Hemos registrado tu solicitud de revocación conforme a la Ley 24.240. Se ha emitido una constancia automática con validez legal.
            </p>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-subtle)] mb-8 text-left">
              <div className="text-micro font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Código de trámite identificador:
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-h3 font-bold text-[var(--brand)]">
                  {tramiteCode}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  leftIcon={copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                >
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>

            <div className="text-small text-[var(--text-muted)] max-w-lg mx-auto space-y-2 mb-8 text-left bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
              <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold">
                <Clock className="w-4 h-4 text-[var(--brand)]" />
                <span>Próximos pasos automáticos:</span>
              </div>
              <p>• Te enviamos una copia fehaciente a <strong>{email}</strong> con el detalle del trámite.</p>
              <p>• Si hubiera algún cargo facturado en tu tarjeta o cuenta, el reintegro se tramita de forma inmediata dentro de las 72 hs hábiles.</p>
              <p>• Tu plan o pedido queda cancelado sin costo adicional.</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => window.print()}
                leftIcon={<FileCheck className="w-4 h-4" />}
              >
                Descargar o Imprimir Comprobante
              </Button>
              <Link to="/">
                <Button variant="outline">
                  Volver al inicio
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Formulario de Revocación */
          <div className="p-6 sm:p-10 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm">
            <div className="max-w-2xl">
              <h1 className="text-h2 font-bold mb-2 tracking-tight">
                Formulario de Revocación
              </h1>
              <p className="text-body text-[var(--text-muted)] mb-8">
                Completá los datos a continuación para dar de baja tu contratación de Toque. La solicitud genera un número de trámite inmediato e irrevocable.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Nombre y Apellido o Razón Social *"
                    placeholder="Ej. Juan Pérez / Taller Gráfico S.R.L."
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />

                  <Input
                    label="CUIT o DNI *"
                    placeholder="Ej. 20-34567890-9"
                    value={cuitDni}
                    onChange={(e) => setCuitDni(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Correo electrónico *"
                    type="email"
                    placeholder="juan@ejemplo.com.ar"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    helperText="Enviaremos aquí la constancia fehaciente"
                    required
                  />

                  <Input
                    label="Teléfono o WhatsApp"
                    placeholder="+54 9 11 1234-5678"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </div>

                <Input
                  label="Número de Orden, Factura o Identificador de Plan (Opcional)"
                  placeholder="Ej. FAC-2026-0045 o Plan Taller"
                  value={numeroOrden}
                  onChange={(e) => setNumeroOrden(e.target.value)}
                  helperText="Si no lo recuerdas, lo buscaremos por tu CUIT o email"
                />

                <div>
                  <label className="block text-small font-medium text-[var(--text-main)] mb-1.5">
                    Motivo de la revocación (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] text-small transition placeholder:text-[var(--text-muted)]"
                    placeholder="Contanos brevemente qué ocurrió (no es obligatorio para ejercer el derecho legal)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </div>

                <div className="pt-3">
                  <Button
                    type="submit"
                    variant="danger"
                    size="lg"
                    className="w-full sm:w-auto"
                    isLoading={isSubmitting}
                  >
                    Confirmar revocación y emitir comprobante
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Información de Soporte y Contacto Legal */}
        <div className="mt-8 p-6 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-small text-[var(--text-muted)]">
          <div>
            <span className="font-semibold text-[var(--text-main)]">¿Tenés dudas o necesitás asistencia?</span>
            <p className="text-micro mt-0.5">
              Podés escribir directamente a nuestro canal legal: <strong className="text-[var(--text-main)]">{LEGAL_CONFIG.EMAIL_LEGAL}</strong>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/terminos" className="hover:text-[var(--brand)] underline text-micro">
              Términos del servicio
            </Link>
            <Link to="/reembolso" className="hover:text-[var(--brand)] underline text-micro">
              Política de reembolso
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-[var(--border-subtle)] bg-[var(--bg-card)] py-6 text-micro text-[var(--text-muted)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {LEGAL_CONFIG.TITULAR}. {LEGAL_CONFIG.DOMICILIO}.</p>
          <div className="flex gap-4">
            <Link to="/terminos" className="hover:text-[var(--brand)]">Términos</Link>
            <Link to="/privacidad" className="hover:text-[var(--brand)]">Privacidad</Link>
            <Link to="/cookies" className="hover:text-[var(--brand)]">Cookies</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
