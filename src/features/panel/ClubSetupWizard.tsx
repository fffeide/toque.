import React, { useState, useEffect } from 'react';
import { api, SetupProgress, ClubConfig, ClubLocal } from '../../api';
import { CheckCircle2, Circle, Printer, X, ArrowRight } from 'lucide-react';

interface ClubSetupWizardProps {
  onProgressUpdated?: () => void;
}

export const ClubSetupWizard: React.FC<ClubSetupWizardProps> = ({ onProgressUpdated }) => {
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Campos editables de los 4 pasos
  const [programName, setProgramName] = useState('');
  const [brandColor, setBrandColor] = useState('#3A3FE0');
  const [logoUrl, setLogoUrl] = useState('');
  const [rewardText, setRewardText] = useState('');
  const [targetStamps, setTargetStamps] = useState(10);
  const [localName, setLocalName] = useState('');
  const [localAddress, setLocalAddress] = useState('');

  const loadSetup = async () => {
    try {
      const [prog, cfg, locs] = await Promise.all([
        api.getSetupProgress(),
        api.getClubConfig(),
        api.listLocals(),
      ]);
      setProgress(prog);
      setConfig(cfg);
      setLocals(locs);

      setProgramName(cfg.name || '');
      setBrandColor(cfg.brandColor || '#3A3FE0');
      setLogoUrl(cfg.logoUrl || '');
      setRewardText(cfg.rewardText || 'Un café grande sin cargo');
      setTargetStamps(cfg.targetStamps || 10);
      if (locs[0]) {
        setLocalName(locs[0].name);
        setLocalAddress(locs[0].address);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSetup();
  }, []);

  if (!progress || progress.percent >= 100) {
    return null;
  }

  const handleSaveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateClubConfig({
        name: programName.trim() || 'Mi Club',
        brandColor,
        logoUrl: logoUrl.trim() || undefined,
      });
      await loadSetup();
      onProgressUpdated?.();
      setOpenStep(2);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateClubConfig({
        rewardText: rewardText.trim() || 'Premio especial',
        targetStamps: Math.max(2, Number(targetStamps) || 10),
      });
      await loadSetup();
      onProgressUpdated?.();
      setOpenStep(3);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (locals.length === 0) {
        await api.createLocal({
          name: localName.trim() || 'Local Principal',
          address: localAddress.trim() || 'Dirección del local',
        });
      } else {
        await api.updateLocal(locals[0].id, {
          name: localName.trim() || locals[0].name,
          address: localAddress.trim() || locals[0].address,
        });
      }
      await loadSetup();
      onProgressUpdated?.();
      setOpenStep(4);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintCartelStep4 = async () => {
    setIsSaving(true);
    try {
      const updated = await api.markCartelPrinted();
      setProgress(updated);
      onProgressUpdated?.();
      window.print();
      setOpenStep(null);
    } finally {
      setIsSaving(false);
    }
  };

  const stepsList = [
    { num: 1, label: '1) Nombre, logo y color', done: progress.step1Brand },
    { num: 2, label: '2) Premio y sellos', done: progress.step2Reward },
    { num: 3, label: '3) Tu primer local', done: progress.step3Local },
    { num: 4, label: '4) Imprimí el cartel', done: progress.step4Printed },
  ];

  return (
    <div className="mb-6 rounded-2xl bg-[#111113] border border-[#bec8ff]/40 p-4 sm:p-5 space-y-4 no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-base text-[#f1f1ee]">Terminá de configurar</span>
            <span className="text-sm font-mono font-bold text-[#bec8ff] tabular-nums">
              {progress.percent}% completado
            </span>
          </div>
          <p className="text-sm text-[#d4d4d8]">
            Completá los 4 pasos de bienvenida para dejar tu cartel listo en el mostrador.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const firstPending = stepsList.find((s) => !s.done)?.num || 4;
            setOpenStep(openStep ? null : firstPending);
          }}
          className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#bec8ff] text-[#0c0c0c] font-bold text-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <span>{openStep ? 'Ocultar asistente' : 'Completar pasos pendientes'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="w-full h-2.5 rounded-full bg-[#18181b] border border-[#28282a] overflow-hidden">
        <div
          className="h-full bg-[#2fb36a] transition-opacity"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      {/* Botones de los 4 pasos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stepsList.map((st) => (
          <button
            key={st.num}
            type="button"
            onClick={() => setOpenStep(st.num)}
            className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left text-sm font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
              openStep === st.num
                ? 'border-[#bec8ff] bg-[#18181b] text-[#f1f1ee]'
                : st.done
                ? 'border-[#2fb36a]/40 bg-[#2fb36a]/10 text-[#f1f1ee]'
                : 'border-[#28282a] bg-[#18181b] text-[#d4d4d8] hover:border-[#bec8ff]'
            }`}
          >
            {st.done ? (
              <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-[#bec8ff] shrink-0" />
            )}
            <span className="truncate">{st.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido del paso abierto */}
      {openStep !== null && (
        <div className="pt-4 border-t border-[#242426]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base text-[#f1f1ee]">
              {stepsList.find((s) => s.num === openStep)?.label}
            </h3>
            <button
              type="button"
              onClick={() => setOpenStep(null)}
              aria-label="Cerrar paso"
              className="min-h-[40px] min-w-[40px] rounded-lg text-[#a1a1aa] hover:text-[#f1f1ee] flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {openStep === 1 && (
            <form onSubmit={handleSaveStep1} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="wiz-name"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Nombre del programa
                </label>
                <input
                  id="wiz-name"
                  type="text"
                  required
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee]"
                />
              </div>
              <div>
                <label
                  htmlFor="wiz-color"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Color de la tarjeta
                </label>
                <input
                  id="wiz-color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-full min-h-[48px] p-1.5 rounded-xl border border-[#28282a] bg-[#18181b] cursor-pointer"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-sm cursor-pointer"
                >
                  Guardar y seguir al paso 2
                </button>
              </div>
            </form>
          )}

          {openStep === 2 && (
            <form onSubmit={handleSaveStep2} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="wiz-reward"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Premio al completar la tarjeta
                </label>
                <input
                  id="wiz-reward"
                  type="text"
                  required
                  value={rewardText}
                  onChange={(e) => setRewardText(e.target.value)}
                  placeholder="Ej. Un café grande sin cargo"
                  className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee]"
                />
              </div>
              <div>
                <label
                  htmlFor="wiz-stamps"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Meta de sellos
                </label>
                <input
                  id="wiz-stamps"
                  type="number"
                  min={2}
                  max={30}
                  required
                  value={targetStamps}
                  onChange={(e) => setTargetStamps(Number(e.target.value) || 10)}
                  className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-sm cursor-pointer"
                >
                  Guardar y seguir al paso 3
                </button>
              </div>
            </form>
          )}

          {openStep === 3 && (
            <form onSubmit={handleSaveStep3} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="wiz-loc-name"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Nombre de tu primer local
                </label>
                <input
                  id="wiz-loc-name"
                  type="text"
                  required
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder="Ej. Local Centro"
                  className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee]"
                />
              </div>
              <div>
                <label
                  htmlFor="wiz-loc-addr"
                  className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Dirección del local
                </label>
                <input
                  id="wiz-loc-addr"
                  type="text"
                  required
                  value={localAddress}
                  onChange={(e) => setLocalAddress(e.target.value)}
                  placeholder="Ej. Av. Corrientes 1450"
                  className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-sm cursor-pointer"
                >
                  Guardar y seguir al paso 4
                </button>
              </div>
            </form>
          )}

          {openStep === 4 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#18181b] border border-[#28282a]">
              <div className="space-y-1">
                <p className="font-bold text-sm text-[#f1f1ee]">
                  Tu cartel A5 con el código QR de {localName || 'tu local'} está listo
                </p>
                <p className="text-xs text-[#a1a1aa]">
                  Imprimilo en hoja A5 y ponelo en el mostrador para que tus clientes escaneen y sumen sellos.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrintCartelStep4}
                disabled={isSaving}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#2fb36a] text-[#0c0c0c] font-bold text-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir cartel y finalizar (100%)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
