/**
 * Toque — Vista de Documentos Legales (LegalPageView)
 * Renderiza textos en Markdown con reemplazo dinámico de variables legales,
 * diseño sobrio, navegación entre documentos, tipografía legible y botón de regreso.
 */

import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LEGAL_CONFIG, LEGAL_DOCUMENTS, LegalDocument } from '../../config/legal';
import { BrandLogo } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import {
  FileText,
  ShieldCheck,
  Cookie,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Building,
  Mail,
  Printer,
  ChevronRight,
} from 'lucide-react';

interface LegalPageViewProps {
  forcedDocId?: 'terminos' | 'privacidad' | 'cookies' | 'reembolso';
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({ forcedDocId }) => {
  const { docId: paramDocId } = useParams<{ docId?: string }>();
  const activeId = forcedDocId || paramDocId || 'terminos';

  const doc: LegalDocument = useMemo(() => {
    return LEGAL_DOCUMENTS[activeId] || LEGAL_DOCUMENTS['terminos'];
  }, [activeId]);

  // Reemplazo dinámico de variables legales
  const renderedContent = useMemo(() => {
    let raw = doc.markdownContent;
    raw = raw.replace(/\[TITULAR\]/g, LEGAL_CONFIG.TITULAR);
    raw = raw.replace(/\[CUIT\]/g, LEGAL_CONFIG.CUIT);
    raw = raw.replace(/\[DOMICILIO\]/g, LEGAL_CONFIG.DOMICILIO);
    raw = raw.replace(/\[EMAIL LEGAL\]/g, LEGAL_CONFIG.EMAIL_LEGAL);
    raw = raw.replace(/\[EMAIL_LEGAL\]/g, LEGAL_CONFIG.EMAIL_LEGAL);
    raw = raw.replace(/\[FECHA\]/g, LEGAL_CONFIG.FECHA_ACTUALIZACION);
    raw = raw.replace(/\[JURISDICCION\]/g, LEGAL_CONFIG.JURISDICCION);
    return raw;
  }, [doc]);

  // Parser simple y confiable de Markdown a elementos React seguros
  const renderedBlocks = useMemo(() => {
    const lines = renderedContent.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];

    const flushList = (keyPrefix: number) => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`ul-${keyPrefix}`} className="my-3 space-y-1.5 list-disc list-inside text-small text-[var(--text-main)] pl-2">
            {currentList.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {parseInlineFormatting(item)}
              </li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        currentList.push(trimmed.slice(2));
        return;
      }

      flushList(index);

      if (!trimmed) {
        return;
      }

      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-h2 font-bold text-[var(--text-main)] mt-6 mb-2 tracking-tight">
            {trimmed.slice(2)}
          </h1>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-h3 font-semibold text-[var(--text-main)] mt-8 mb-2 pb-1 border-b border-[var(--border-subtle)]">
            {trimmed.slice(3)}
          </h2>
        );
      } else if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-body font-semibold text-[var(--text-main)] mt-6 mb-1.5">
            {trimmed.slice(4)}
          </h3>
        );
      } else if (trimmed === '---') {
        elements.push(
          <hr key={index} className="my-6 border-t border-[var(--border-subtle)]" />
        );
      } else {
        elements.push(
          <p key={index} className="text-small text-[var(--text-muted)] leading-relaxed my-2.5">
            {parseInlineFormatting(trimmed)}
          </p>
        );
      }
    });

    flushList(9999);
    return elements;
  }, [renderedContent]);

  return (
    <div className="aurora-stage min-h-screen text-white flex flex-col">
      {/* Header institucional */}
      <header className="sticky top-0 z-30 bg-[var(--bg-card)]/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 group text-small font-medium text-[var(--text-muted)] hover:text-[var(--brand)] transition"
              title="Volver a la portada de Toque"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Volver a Toque</span>
            </Link>
            <div className="h-4 w-px bg-[var(--border-subtle)]" />
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo name="Toque" size="sm" />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
              className="hidden sm:flex"
            >
              Imprimir
            </Button>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Ingresar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Document Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-3 border-b border-[var(--border-subtle)]">
          <Link
            to="/terminos"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-small font-medium transition ${
              activeId === 'terminos'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Términos y Condiciones</span>
          </Link>
          <Link
            to="/privacidad"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-small font-medium transition ${
              activeId === 'privacidad'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Privacidad</span>
          </Link>
          <Link
            to="/cookies"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-small font-medium transition ${
              activeId === 'cookies'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)]'
            }`}
          >
            <Cookie className="w-4 h-4" />
            <span>Cookies</span>
          </Link>
          <Link
            to="/reembolso"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-small font-medium transition ${
              activeId === 'reembolso'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)]'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reembolso y Garantía</span>
          </Link>
          <Link
            to="/arrepentimiento"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-small font-semibold text-[var(--coral)] bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition ml-auto"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Botón de Arrepentimiento</span>
          </Link>
        </div>

        {/* Warning Banner: Borrador */}
        <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-small leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-micro bg-amber-500/20 px-2 py-0.5 rounded-full inline-block mr-2 text-amber-700 dark:text-amber-300">
              {doc.badge}
            </span>
            Este texto constituye una versión preliminar de trabajo sujeta a revisión formal por asesores legales de la República Argentina antes de la salida de la fase beta. Para consultas jurídicas, comunicarse a{' '}
            <a
              href={`mailto:${LEGAL_CONFIG.EMAIL_LEGAL}`}
              className="underline font-medium hover:text-[var(--brand)]"
            >
              {LEGAL_CONFIG.EMAIL_LEGAL}
            </a>
            .
          </div>
        </div>

        {/* Legal Document Container */}
        <article className="p-6 sm:p-10 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-micro text-[var(--text-muted)] pb-6 mb-6 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>{LEGAL_CONFIG.TITULAR}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono">CUIT: {LEGAL_CONFIG.CUIT}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Vigencia: {LEGAL_CONFIG.FECHA_ACTUALIZACION}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{LEGAL_CONFIG.EMAIL_LEGAL}</span>
            </div>
          </div>

          {/* Rendered Markdown Content */}
          <div className="prose prose-slate max-w-none dark:prose-invert">
            {renderedBlocks}
          </div>
        </article>

        {/* Back Link */}
        <div className="mt-8 flex justify-between items-center text-small text-[var(--text-muted)]">
          <Link
            to="/"
            className="flex items-center gap-1.5 hover:text-[var(--brand)] transition font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a toque.com</span>
          </Link>
          <Link
            to="/arrepentimiento"
            className="text-[var(--coral)] hover:underline flex items-center gap-1 font-medium"
          >
            <span>Revocar servicio (Arrepentimiento)</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>

      {/* Footer legal */}
      <footer className="mt-auto border-t border-[var(--border-subtle)] bg-[var(--bg-card)] py-6 text-micro text-[var(--text-muted)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {LEGAL_CONFIG.TITULAR}. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link to="/terminos" className="hover:text-[var(--brand)]">Términos</Link>
            <Link to="/privacidad" className="hover:text-[var(--brand)]">Privacidad</Link>
            <Link to="/cookies" className="hover:text-[var(--brand)]">Cookies</Link>
            <Link to="/reembolso" className="hover:text-[var(--brand)]">Reembolso</Link>
            <Link to="/arrepentimiento" className="text-[var(--coral)] hover:underline">Arrepentimiento</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Helper simple para parsear negrita e itálica inline
function parseInlineFormatting(text: string): React.ReactNode[] {
  // Maneja **negrita** y *cursiva*
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} className="font-semibold text-[var(--text-main)]">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index} className="italic">{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
