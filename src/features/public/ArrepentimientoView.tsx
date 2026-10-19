import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, CheckCircle2, FileText } from 'lucide-react';

export const ArrepentimientoView: React.FC = () => {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [trackingCode, setTrackingCode] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const code = `ARR-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    setTrackingCode(code);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#000000]/90 backdrop-blur-md border-b border-[#242426]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f1f1ee] flex items-center justify-center">
              <img src="/assets/logo.svg" alt="" className="w-4 h-4 object-contain" />
            </div>
            <span className="font-bold text-lg tracking-tight text-[#f1f1ee]">toque™</span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#343438] text-[#f1f1ee] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al inicio</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
        <div className="rounded-3xl bg-[#111113] border border-[#242426] p-6 sm:p-8 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#bec8ff]/15 text-[#bec8ff] text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Ley 24.240 (Art. 34) · Resolución SCI 424/2020</span>
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f1f1ee]">
            Botón de Arrepentimiento
          </h1>
          <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
            Podés revocar la aceptación del servicio o equipamiento contratado dentro del plazo de
            diez (10) días corridos contados a partir de la celebración del contrato o de la
            entrega del bien, lo último que ocurra, sin costo ni responsabilidad alguna. Emitiremos
            tu código de identificación de gestión en el acto.
          </p>

          {trackingCode ? (
            <div className="p-5 rounded-2xl bg-[#18181b] border border-[#2fb36a]/40 space-y-3">
              <div className="flex items-center gap-2 text-[#2fb36a] font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Solicitud de revocación registrada</span>
              </div>
              <p className="text-xs text-[#c4c2c3]">
                Conservá tu código de identificación de trámite conforme a la Resolución 424/2020:
              </p>
              <div className="p-3 rounded-xl bg-[#0c0c0c] border border-[#28282c] font-mono text-base font-bold text-[#bec8ff] text-center">
                {trackingCode}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                  Nombre del comercio o titular
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej. Café La Esquina"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282c] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                  Correo electrónico de contacto
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@comercio.com.ar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282c] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                  Detalle opcional (plan o cartel a revocar)
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Opcional: indicá el código de pedido o comentario"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282c] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-[#f1f1ee] hover:bg-white text-[#0c0c0c] font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Solicitar baja y generar código de arrepentimiento
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[#a1a1aa]">
          <Link to="/terminos" className="inline-flex items-center gap-1 hover:text-[#f1f1ee]">
            <FileText className="w-3.5 h-3.5" />
            <span>Términos y Condiciones</span>
          </Link>
          <span>·</span>
          <Link to="/privacidad" className="hover:text-[#f1f1ee]">
            Política de Privacidad
          </Link>
          <span>·</span>
          <Link to="/cookies" className="hover:text-[#f1f1ee]">
            Cookies y Clarity
          </Link>
          <span>·</span>
          <Link to="/reembolso" className="hover:text-[#f1f1ee]">
            Política de Reembolso
          </Link>
        </div>
      </main>
    </div>
  );
};
