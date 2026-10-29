import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Search, Check, Map as MapIcon } from 'lucide-react';

const DEFAULT_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  'AIzaSyCE6PFcEIWllup15k40VNTp-XTBQvP5IEo';

let googleMapsLoaderPromise: Promise<any> | null = null;

function loadGoogleMapsSdk(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  const w = window as any;
  if (w.google?.maps) {
    return Promise.resolve(w.google.maps);
  }
  if (googleMapsLoaderPromise) {
    return googleMapsLoaderPromise;
  }

  googleMapsLoaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('toque-google-maps-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(w.google?.maps));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = 'toque-google-maps-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&language=es&region=AR`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (w.google?.maps) {
        resolve(w.google.maps);
      } else {
        reject(new Error('Google Maps no cargó correctamente'));
      }
    };
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
    document.head.appendChild(script);
  });

  return googleMapsLoaderPromise;
}

interface GoogleAddressPickerProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
}

export const GoogleAddressPicker: React.FC<GoogleAddressPickerProps> = ({
  value,
  onChange,
  placeholder = 'Buscá la calle y altura en Google Maps...',
  label = 'Dirección',
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const [showMapModal, setShowMapModal] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: -34.6037,
    lng: -58.3816,
  });
  const [searchingGeo, setSearchingGeo] = useState(false);

  // Inicializar Autocomplete de Google Places sobre el input
  useEffect(() => {
    let autocomplete: any = null;
    let listener: any = null;

    loadGoogleMapsSdk(DEFAULT_MAPS_API_KEY)
      .then((maps) => {
        setSdkReady(true);
        if (!inputRef.current || !maps?.places?.Autocomplete) return;

        autocomplete = new maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: ['ar', 'uy', 'cl', 'mx', 'es'] },
          fields: ['formatted_address', 'geometry', 'name'],
        });

        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const formatted = place?.formatted_address || place?.name || inputRef.current?.value || '';
          const lat = place?.geometry?.location?.lat?.();
          const lng = place?.geometry?.location?.lng?.();

          if (typeof lat === 'number' && typeof lng === 'number') {
            const nextCoords = {
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6)),
            };
            setCoords(nextCoords);
            onChange(formatted, nextCoords);
            if (mapInstanceRef.current && markerInstanceRef.current) {
              mapInstanceRef.current.setCenter(nextCoords);
              mapInstanceRef.current.setZoom(17);
              markerInstanceRef.current.setPosition(nextCoords);
            }
          } else if (formatted) {
            onChange(formatted);
          }
        });
      })
      .catch(() => {
        setSdkReady(false);
      });

    return () => {
      if (listener && (window as any).google?.maps?.event) {
        (window as any).google.maps.event.removeListener(listener);
      }
    };
  }, []);

  // Inicializar mapa interactivo cuando se abre el selector visual
  useEffect(() => {
    if (!showMapModal || !sdkReady || !mapContainerRef.current) return;
    const maps = (window as any).google?.maps;
    if (!maps) return;

    const map = new maps.Map(mapContainerRef.current, {
      center: coords,
      zoom: 16,
      disableDefaultUI: false,
      streetViewControl: false,
      mapTypeControl: false,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#18181b' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#18181b' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{ color: '#27272a' }],
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#09090b' }],
        },
      ],
    });

    const marker = new maps.Marker({
      position: coords,
      map,
      draggable: true,
      title: 'Ubicación del local',
    });

    const geocoder = new maps.Geocoder();

    const reverseGeocode = (latLng: { lat: number; lng: number }) => {
      setSearchingGeo(true);
      geocoder.geocode({ location: latLng }, (results: any, status: any) => {
        setSearchingGeo(false);
        if (status === 'OK' && results?.[0]?.formatted_address) {
          onChange(results[0].formatted_address, latLng);
        } else {
          onChange(value || `${latLng.lat}, ${latLng.lng}`, latLng);
        }
      });
    };

    // Si hay texto escrito en dirección, centrar el mapa ahí al abrir
    if (value && value.trim().length > 4) {
      geocoder.geocode({ address: value }, (results: any, status: any) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          const next = {
            lat: Number(loc.lat().toFixed(6)),
            lng: Number(loc.lng().toFixed(6)),
          };
          setCoords(next);
          map.setCenter(next);
          marker.setPosition(next);
        }
      });
    }

    map.addListener('click', (e: any) => {
      if (!e.latLng) return;
      const next = {
        lat: Number(e.latLng.lat().toFixed(6)),
        lng: Number(e.latLng.lng().toFixed(6)),
      };
      setCoords(next);
      marker.setPosition(next);
      reverseGeocode(next);
    });

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (!pos) return;
      const next = {
        lat: Number(pos.lat().toFixed(6)),
        lng: Number(pos.lng().toFixed(6)),
      };
      setCoords(next);
      reverseGeocode(next);
    });

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;
  }, [showMapModal, sdkReady]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setSearchingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setCoords(next);
        const maps = (window as any).google?.maps;
        if (maps) {
          const geocoder = new maps.Geocoder();
          geocoder.geocode({ location: next }, (results: any, status: any) => {
            setSearchingGeo(false);
            if (status === 'OK' && results?.[0]?.formatted_address) {
              onChange(results[0].formatted_address, next);
            } else {
              onChange(`${next.lat}, ${next.lng}`, next);
            }
          });
          if (mapInstanceRef.current && markerInstanceRef.current) {
            mapInstanceRef.current.setCenter(next);
            markerInstanceRef.current.setPosition(next);
          }
        } else {
          setSearchingGeo(false);
          onChange(`${next.lat}, ${next.lng}`, next);
        }
      },
      () => setSearchingGeo(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-[#a1a1aa]">{label}</label>
        <button
          type="button"
          onClick={() => setShowMapModal((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D95B26] hover:underline cursor-pointer"
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>{showMapModal ? 'Ocultar mapa' : 'Elegir en Google Maps'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2 bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 focus-within:border-[#D95B26]">
        <MapPin className="w-4 h-4 text-[#D95B26] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleUseMyLocation}
          title="Usar mi ubicación actual"
          className="p-1.5 rounded-lg bg-[#242429] hover:bg-[#2E2E34] text-[#f1f1ee] shrink-0 cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 text-[#D95B26]" />
        </button>
      </div>

      {showMapModal && (
        <div className="rounded-2xl bg-[#141414] border border-[#28282a] p-3 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a1a1aa] flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#D95B26]" />
              Tocá el mapa o arrastrá el marcador para ajustar la dirección exacta
            </span>
            {searchingGeo && <span className="text-[#D95B26] font-medium">Buscando calle...</span>}
          </div>

          <div
            ref={mapContainerRef}
            className="w-full h-56 rounded-xl overflow-hidden border border-[#28282a] bg-[#0A0A0A]"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#8E8E93] truncate max-w-[70%]">
              {value || 'Seleccioná un punto en el mapa'}
            </span>
            <button
              type="button"
              onClick={() => setShowMapModal(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#D95B26] text-white text-xs font-semibold cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirmar dirección</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
