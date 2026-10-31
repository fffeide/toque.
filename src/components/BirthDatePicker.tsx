import React, { useEffect, useState } from 'react';

export interface BirthDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

const MONTHS = [
  { label: 'Enero', value: '01' },
  { label: 'Febrero', value: '02' },
  { label: 'Marzo', value: '03' },
  { label: 'Abril', value: '04' },
  { label: 'Mayo', value: '05' },
  { label: 'Junio', value: '06' },
  { label: 'Julio', value: '07' },
  { label: 'Agosto', value: '08' },
  { label: 'Septiembre', value: '09' },
  { label: 'Octubre', value: '10' },
  { label: 'Noviembre', value: '11' },
  { label: 'Diciembre', value: '12' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => {
  const num = i + 1;
  return {
    label: String(num),
    value: String(num).padStart(2, '0'),
  };
});

const YEARS = Array.from({ length: 2015 - 1935 + 1 }, (_, i) => String(2015 - i));

export const BirthDatePicker: React.FC<BirthDatePickerProps> = ({ value, onChange, id }) => {
  const parts = (value || '').split('-');
  const [year, setYear] = useState<string>(parts.length === 3 ? parts[0] : '');
  const [month, setMonth] = useState<string>(parts.length === 3 ? parts[1] : '');
  const [day, setDay] = useState<string>(parts.length === 3 ? parts[2] : '');

  useEffect(() => {
    if (value && value.includes('-')) {
      const [y, m, d] = value.split('-');
      if (y && m && d) {
        setYear(y);
        setMonth(m);
        setDay(d);
      }
    } else if (!value) {
      setYear('');
      setMonth('');
      setDay('');
    }
  }, [value]);

  const handleUpdate = (nextDay: string, nextMonth: string, nextYear: string) => {
    setDay(nextDay);
    setMonth(nextMonth);
    setYear(nextYear);
    if (nextDay && nextMonth && nextYear) {
      onChange(`${nextYear}-${nextMonth}-${nextDay}`);
    } else {
      onChange('');
    }
  };

  return (
    <div id={id} className="grid grid-cols-3 gap-2 max-w-[280px]">
      <select
        aria-label="Día de nacimiento"
        value={day}
        onChange={(e) => handleUpdate(e.target.value, month, year)}
        className="h-11 w-full px-3 rounded-xl bg-[#141414] border border-[#242424] text-white text-sm focus:border-[#D95B26] focus:outline-none"
      >
        <option value="" disabled>
          Día
        </option>
        {DAYS.map((d) => (
          <option key={d.value} value={d.value} className="bg-[#141414] text-white">
            {d.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Mes de nacimiento"
        value={month}
        onChange={(e) => handleUpdate(day, e.target.value, year)}
        className="h-11 w-full px-3 rounded-xl bg-[#141414] border border-[#242424] text-white text-sm focus:border-[#D95B26] focus:outline-none"
      >
        <option value="" disabled>
          Mes
        </option>
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value} className="bg-[#141414] text-white">
            {m.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Año de nacimiento"
        value={year}
        onChange={(e) => handleUpdate(day, month, e.target.value)}
        className="h-11 w-full px-3 rounded-xl bg-[#141414] border border-[#242424] text-white text-sm focus:border-[#D95B26] focus:outline-none"
      >
        <option value="" disabled>
          Año
        </option>
        {YEARS.map((y) => (
          <option key={y} value={y} className="bg-[#141414] text-white">
            {y}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BirthDatePicker;
