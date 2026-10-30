import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMapsLibrary,
  MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { MapPin, Search, X, Check, Navigation, Loader2 } from 'lucide-react';

// Strictly read from environment variable (never hardcode API keys)
const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';

export interface GoogleAddressPickerProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
}

interface PlaceLocation {
  lat: () => number;
  lng: () => number;
}

interface PlaceInstance {
  displayName?: string;
  formattedAddress?: string;
  location?: PlaceLocation;
  fetchFields: (options: { fields: string[] }) => Promise<void>;
}

interface AutocompleteSuggestionItem {
  placePrediction?: {
    text?: { text?: string };
    toPlace: () => PlaceInstance;
  };
}

interface PlacesLibraryNew {
  AutocompleteSessionToken?: new () => unknown;
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions?: (request: {
      input: string;
      sessionToken?: unknown;
      includedRegionCodes?: string[];
    }) => Promise<{ suggestions: AutocompleteSuggestionItem[] }>;
  };
}

interface InnerPickerProps extends GoogleAddressPickerProps {
  hasApiKey: boolean;
}

function AddressPickerInner({
  value,
  onChange,
  placeholder = 'Ej: Av. Corrientes 1234, CABA',
  hasApiKey,
}: InnerPickerProps) {
  const placesLib = useMapsLibrary('places') as unknown as PlacesLibraryNew | null;
  const sessionTokenRef = useRef<unknown>(null);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestionItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [showMapModal, setShowMapModal] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: -34.6037,
    lng: -58.3816,
  });
  const [tempAddress, setTempAddress] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
    setTempAddress(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
    setShowDropdown(false);
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!hasApiKey || !placesLib || query.trim().length < 3) {
        setSuggestions([]);
        setIsSearching(false);
        return;
      }

      const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
      if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        setSuggestions([]);
        setIsSearching(false);
        return;
      }

      if (!sessionTokenRef.current && AutocompleteSessionToken) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      setIsSearching(true);
      try {
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          sessionToken: sessionTokenRef.current ?? undefined,
          includedRegionCodes: ['ar', 'uy', 'cl', 'mx', 'es'],
        });
        const list = res?.suggestions || [];
        setSuggestions(list);
        setShowDropdown(list.length > 0);
      } catch {
        // Gracefully handle quota or billing restrictions without throwing legacy/geocoder errors
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    },
    [hasApiKey, placesLib]
  );

  const handleInputChange = (nextValue: string) => {
    setInputValue(nextValue);
    setTempAddress(nextValue);
    onChange(nextValue, selectedCoords);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (nextValue.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      void fetchSuggestions(nextValue);
    }, 280);
  };

  const handleSuggestionClick = async (suggestion: AutocompleteSuggestionItem) => {
    if (!suggestion.placePrediction) return;

    const fallbackText = suggestion.placePrediction.text?.text || inputValue;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });

      const formatted = place.formattedAddress || place.displayName || fallbackText;
      const lat = place.location?.lat();
      const lng = place.location?.lng();

      setInputValue(formatted);
      setTempAddress(formatted);
      const nextCoords =
        typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : selectedCoords;
      setSelectedCoords(nextCoords);
      onChange(formatted, nextCoords);
    } catch {
      setInputValue(fallbackText);
      setTempAddress(fallbackText);
      onChange(fallbackText, selectedCoords);
    } finally {
      resetSession();
    }
  };

  const handleMapClick = (event: MapMouseEvent) => {
    const latLng = event.detail.latLng;
    if (!latLng) return;

    const nextCoords = { lat: latLng.lat, lng: latLng.lng };
    setSelectedCoords(nextCoords);
    if (!tempAddress.trim()) {
      const coordLabel = `Ubicación (${nextCoords.lat.toFixed(5)}, ${nextCoords.lng.toFixed(5)})`;
      setTempAddress(coordLabel);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setSelectedCoords(coords);
        if (!tempAddress.trim()) {
          setTempAddress(`Ubicación (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirmModal = () => {
    const finalAddress =
      tempAddress.trim() ||
      inputValue.trim() ||
      `Ubicación (${selectedCoords.lat.toFixed(5)}, ${selectedCoords.lng.toFixed(5)})`;
    setInputValue(finalAddress);
    onChange(finalAddress, selectedCoords);
    setShowMapModal(false);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            placeholder={placeholder}
            className="w-full bg-[#0A0A0A] border border-[#242424] rounded-xl pl-10 pr-9 py-2.5 text-sm text-white focus:outline-none focus:border-[#D95B26]"
          />
          {isSearching && (
            <Loader2 className="w-4 h-4 text-[#8E8E93] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
          )}

          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1.5 bg-[#141414] border border-[#242424] rounded-xl shadow-2xl overflow-hidden z-40 max-h-60 overflow-y-auto divide-y divide-[#1E1E1E]">
              {suggestions.map((suggestion, idx) => {
                const label = suggestion.placePrediction?.text?.text || '';
                if (!label) return null;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => void handleSuggestionClick(suggestion)}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-white hover:bg-[#1E1E1E] flex items-center gap-2.5 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#D95B26] shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {hasApiKey && (
          <button
            type="button"
            onClick={() => {
              setTempAddress(inputValue);
              setShowMapModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1C1C1E] hover:bg-[#242424] border border-[#2E2E2E] text-white text-xs font-semibold transition-colors shrink-0"
          >
            <MapPin className="w-4 h-4 text-[#D95B26]" />
            Elegir en mapa
          </button>
        )}
      </div>

      <p className="text-[11px] text-[#8E8E93]">
        Escribí tu dirección para ver sugerencias precisas o fijá el punto exacto en el mapa.
      </p>

      {showMapModal && hasApiKey && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#242424] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#242424] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D95B26]" />
                <h3 className="text-sm font-bold text-white">Seleccionar ubicación exacta</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 bg-[#0A0A0A] border border-[#242424] rounded-xl px-3.5 py-2.5">
                <input
                  type="text"
                  value={tempAddress}
                  onChange={(e) => setTempAddress(e.target.value)}
                  placeholder="Escribí o ajustá el nombre de la dirección..."
                  className="text-xs text-white bg-transparent focus:outline-none flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1C1C1E] hover:bg-[#242424] border border-[#2E2E2E] text-[11px] font-semibold text-white shrink-0"
                >
                  {locating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D95B26]" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5 text-[#D95B26]" />
                  )}
                  Mi ubicación
                </button>
              </div>

              <div className="w-full h-72 rounded-xl overflow-hidden border border-[#242424] bg-[#0A0A0A]">
                <Map
                  mapId="DEMO_MAP_ID"
                  defaultZoom={15}
                  center={selectedCoords}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  streetViewControl={false}
                  mapTypeControl={false}
                  onClick={handleMapClick}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                >
                  <AdvancedMarker position={selectedCoords} />
                </Map>
              </div>

              <p className="text-[11px] text-[#8E8E93]">
                Tocá cualquier punto del mapa para fijar la ubicación exacta de tu comercio.
              </p>
            </div>

            <div className="p-4 border-t border-[#242424] flex items-center justify-end gap-2 bg-[#0A0A0A]/50">
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8E8E93] hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D95B26] hover:bg-[#c04e1f] text-white text-xs font-semibold transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Confirmar dirección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GoogleAddressPicker(props: GoogleAddressPickerProps) {
  if (!MAPS_API_KEY) {
    return <AddressPickerInner {...props} hasApiKey={false} />;
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY} language="es" region="AR">
      <AddressPickerInner {...props} hasApiKey={true} />
    </APIProvider>
  );
}
