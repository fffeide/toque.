import React, { useState } from 'react';
import { MapPin, Navigation, CheckCircle2 } from 'lucide-react';

interface GoogleAddressPickerProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
}

export const GoogleAddressPicker: React.FC<GoogleAddressPickerProps> = ({
  value,
  onChange,
  placeholder = 'Ej. Av. Monroe 2450, CABA (opcional)',
}) => {
  const [locating, setLocating] = useState(false);
  const [coordsSaved, setCoordsSaved] = useState(false);

  const handleUseBrowserLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCoordsSaved(true);
        onChange(value, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <MapPin className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-sm text-[#F4F4F0] placeholder:text-[#71717A] focus:outline-none focus:border-[#D95B26] transition-colors"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleUseBrowserLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#F4F4F0] transition-colors"
        >
          <Navigation className="w-3.5 h-3.5 text-[#D95B26]" />
          {locating
            ? 'Obteniendo ubicación actual...'
            : coordsSaved
            ? 'Ubicación del local vinculada'
            : 'Vincular ubicación actual del local (opcional)'}
        </button>
        {coordsSaved && (
          <span className="inline-flex items-center gap-1 text-xs text-[#2E9E6B]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ubicación guardada
          </span>
        )}
      </div>
    </div>
  );
};
