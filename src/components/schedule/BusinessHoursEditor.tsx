import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';

export interface TimeInterval {
  open: string; // HH:MM (solo números)
  close: string; // HH:MM (solo números)
}

export interface DayScheduleGroup {
  id: string;
  daysLabel: string; // Ej: "Lun a Vie", "Sábados", "Domingos", "Lunes", etc.
  closed: boolean;
  intervals: TimeInterval[]; // Soporta 1 o 2 turnos (corte durante el día)
}

const DAY_PRESETS = [
  'Lun a Vie',
  'Lun a Sáb',
  'Todos los días',
  'Sábados',
  'Domingos',
  'Feriados',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
];

/**
 * Sanitiza un input horario para permitir únicamente números con formato HH:MM (00:00 a 23:59)
 */
function sanitizeTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  const hh = Math.min(23, parseInt(digits.slice(0, 2), 10) || 0)
    .toString()
    .padStart(2, '0');
  const mm = Math.min(59, parseInt(digits.slice(2, 4), 10) || 0)
    .toString()
    .padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeBlurTime(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '09:00';
  if (digits.length === 1) return `0${digits}:00`;
  if (digits.length === 2) {
    const hh = Math.min(23, parseInt(digits, 10) || 0)
      .toString()
      .padStart(2, '0');
    return `${hh}:00`;
  }
  if (digits.length === 3) {
    const hh = Math.min(23, parseInt(`0${digits[0]}`, 10) || 0)
      .toString()
      .padStart(2, '0');
    const mm = Math.min(59, parseInt(digits.slice(1, 3), 10) || 0)
      .toString()
      .padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return sanitizeTimeInput(digits);
}

export function formatScheduleGroupsToString(groups: DayScheduleGroup[]): string {
  const active = groups.filter((g) => !g.closed && g.intervals.length > 0);
  if (active.length === 0) return '';
  return active
    .map((g) => {
      const ranges = g.intervals
        .filter((it) => it.open.trim() && it.close.trim())
        .map((it) => `${it.open} a ${it.close}`)
        .join(' y ');
      return ranges ? `${g.daysLabel}: ${ranges}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

function parseInitialGroups(value: string): DayScheduleGroup[] {
  if (!value || !value.trim()) {
    return [
      {
        id: 'grp-1',
        daysLabel: 'Lun a Vie',
        closed: false,
        intervals: [{ open: '09:00', close: '20:00' }],
      },
    ];
  }

  const parts = value
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean);
  const parsed: DayScheduleGroup[] = [];

  parts.forEach((part, idx) => {
    const colonIdx = part.indexOf(':');
    if (colonIdx !== -1) {
      const daysLabel = part.slice(0, colonIdx).trim() || 'Lun a Vie';
      const rest = part.slice(colonIdx + 1).trim();
      const rawRanges = rest.split(/\s+y\s+|\/|,/i);
      const intervals: TimeInterval[] = [];
      for (const r of rawRanges) {
        const times = r.match(/\d{1,2}:\d{2}/g);
        if (times && times.length >= 2) {
          intervals.push({ open: times[0], close: times[1] });
        }
      }
      if (intervals.length > 0) {
        parsed.push({
          id: `grp-${idx + 1}`,
          daysLabel,
          closed: false,
          intervals,
        });
      }
    }
  });

  if (parsed.length > 0) return parsed;

  // Si tenía formato numérico simple, extraer horas
  const fallbackTimes = value.match(/\d{1,2}:\d{2}/g);
  return [
    {
      id: 'grp-1',
      daysLabel: 'Lun a Vie',
      closed: false,
      intervals: [
        {
          open: fallbackTimes?.[0] || '09:00',
          close: fallbackTimes?.[1] || '20:00',
        },
      ],
    },
  ];
}

interface BusinessHoursEditorProps {
  value: string;
  onChange: (formattedHours: string) => void;
}

export const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({ value, onChange }) => {
  const [groups, setGroups] = useState<DayScheduleGroup[]>(() => parseInitialGroups(value));
  const [hasEnabledSchedule, setHasEnabledSchedule] = useState<boolean>(() => Boolean(value?.trim()));

  useEffect(() => {
    if (!hasEnabledSchedule) {
      onChange('');
      return;
    }
    const formatted = formatScheduleGroupsToString(groups);
    if (formatted !== value) {
      onChange(formatted);
    }
  }, [groups, hasEnabledSchedule]);

  const updateGroup = (groupId: string, updater: (g: DayScheduleGroup) => DayScheduleGroup) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? updater(g) : g)));
  };

  const handleAddDayGroup = () => {
    const usedLabels = new Set(groups.map((g) => g.daysLabel));
    const nextLabel = DAY_PRESETS.find((d) => !usedLabels.has(d)) || 'Sábados';
    setGroups((prev) => [
      ...prev,
      {
        id: `grp-${Date.now()}`,
        daysLabel: nextLabel,
        closed: false,
        intervals: [{ open: '10:00', close: '22:00' }],
      },
    ]);
  };

  const handleRemoveDayGroup = (groupId: string) => {
    if (groups.length <= 1) {
      setHasEnabledSchedule(false);
      onChange('');
      return;
    }
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-[#a1a1aa] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#D95B26]" />
          <span>Horarios de atención (intervalos numéricos)</span>
        </label>

        <label className="inline-flex items-center gap-2 text-xs text-[#f1f1ee] cursor-pointer">
          <input
            type="checkbox"
            checked={hasEnabledSchedule}
            onChange={(e) => setHasEnabledSchedule(e.target.checked)}
            className="rounded accent-[#D95B26]"
          />
          <span>Mostrar horarios en el Hub</span>
        </label>
      </div>

      {hasEnabledSchedule && (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="p-3.5 rounded-xl bg-[#161619] border border-[#28282a] space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  value={group.daysLabel}
                  onChange={(e) =>
                    updateGroup(group.id, (g) => ({ ...g, daysLabel: e.target.value }))
                  }
                  className="bg-[#0A0A0A] border border-[#28282a] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#f1f1ee] focus:outline-none focus:border-[#D95B26]"
                >
                  {DAY_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  {group.intervals.length < 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateGroup(group.id, (g) => ({
                          ...g,
                          intervals: [...g.intervals, { open: '17:00', close: '21:00' }],
                        }))
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D95B26] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Agregar corte / 2° turno</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveDayGroup(group.id)}
                    className="p-1 text-[#71717a] hover:text-red-400 cursor-pointer"
                    title="Quitar días"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Intervalos numéricos del día (ej: 09:00 a 13:00 y 17:00 a 21:00) */}
              <div className="space-y-2">
                {group.intervals.map((interval, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#a1a1aa] w-14 shrink-0">
                      {idx === 0 ? '1° turno:' : '2° turno:'}
                    </span>

                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={interval.open}
                      onChange={(e) => {
                        const clean = sanitizeTimeInput(e.target.value);
                        updateGroup(group.id, (g) => ({
                          ...g,
                          intervals: g.intervals.map((it, i) =>
                            i === idx ? { ...it, open: clean } : it
                          ),
                        }));
                      }}
                      onBlur={(e) => {
                        const norm = normalizeBlurTime(e.target.value);
                        updateGroup(group.id, (g) => ({
                          ...g,
                          intervals: g.intervals.map((it, i) =>
                            i === idx ? { ...it, open: norm } : it
                          ),
                        }));
                      }}
                      placeholder="09:00"
                      className="w-20 bg-[#0A0A0A] border border-[#28282a] rounded-lg px-2.5 py-1.5 text-center font-mono text-xs text-[#f1f1ee] focus:outline-none focus:border-[#D95B26]"
                    />

                    <span className="text-xs text-[#a1a1aa]">a</span>

                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={interval.close}
                      onChange={(e) => {
                        const clean = sanitizeTimeInput(e.target.value);
                        updateGroup(group.id, (g) => ({
                          ...g,
                          intervals: g.intervals.map((it, i) =>
                            i === idx ? { ...it, close: clean } : it
                          ),
                        }));
                      }}
                      onBlur={(e) => {
                        const norm = normalizeBlurTime(e.target.value);
                        updateGroup(group.id, (g) => ({
                          ...g,
                          intervals: g.intervals.map((it, i) =>
                            i === idx ? { ...it, close: norm } : it
                          ),
                        }));
                      }}
                      placeholder="20:00"
                      className="w-20 bg-[#0A0A0A] border border-[#28282a] rounded-lg px-2.5 py-1.5 text-center font-mono text-xs text-[#f1f1ee] focus:outline-none focus:border-[#D95B26]"
                    />

                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateGroup(group.id, (g) => ({
                            ...g,
                            intervals: g.intervals.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-[11px] text-[#71717a] hover:text-red-400 ml-1 cursor-pointer"
                      >
                        Quitar corte
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleAddDayGroup}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D95B26] hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar día específico con otro horario</span>
            </button>

            {value && (
              <span className="text-[11px] font-mono text-[#2fb36a] truncate max-w-[55%]">
                {value}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
