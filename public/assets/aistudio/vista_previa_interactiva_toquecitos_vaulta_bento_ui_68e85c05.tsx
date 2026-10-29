import React, { useState } from 'react';
import {
  ArrowUpRight,
  Receipt,
  ChevronDown,
  Wallet,
  Gift,
  User,
  Check,
  Clock,
  Download,
  Image as ImageIcon,
  X,
  Sparkles,
  MapPin,
  ShieldCheck,
  Copy,
  Sun,
  Moon,
  ChevronRight,
  Store,
  AlertCircle,
  Trash2,
  ExternalLink,
} from 'lucide-react';

// Colores oficiales de WalletWallet (worker/walletwallet.ts)
const COLOR_PRESETS = {
  dark: {
    bg: 'from-[#232326] via-[#18181B] to-[#0F0F12]',
    solid: '#18181B',
    border: 'border-white/15',
    text: 'text-white',
    label: 'text-zinc-400',
  },
  orange: {
    bg: 'from-[#F06A35] via-[#D95B26] to-[#9E3B12]',
    solid: '#D95B26',
    border: 'border-orange-300/30',
    text: 'text-white',
    label: 'text-orange-100/80',
  },
  blue: {
    bg: 'from-[#4F54F3] via-[#3A3FE0] to-[#23279E]',
    solid: '#3A3FE0',
    border: 'border-indigo-300/30',
    text: 'text-white',
    label: 'text-indigo-100/80',
  },
  green: {
    bg: 'from-[#1F9D68] via-[#157A50] to-[#0D5235]',
    solid: '#157A50',
    border: 'border-emerald-300/30',
    text: 'text-white',
    label: 'text-emerald-100/80',
  },
  purple: {
    bg: 'from-[#8B5CF6] via-[#6D28D9] to-[#4C1D95]',
    solid: '#6D28D9',
    border: 'border-purple-300/30',
    text: 'text-white',
    label: 'text-purple-100/80',
  },
  red: {
    bg: 'from-[#EF4444] via-[#DC2626] to-[#991B1B]',
    solid: '#DC2626',
    border: 'border-red-300/30',
    text: 'text-white',
    label: 'text-red-100/80',
  },
};

// Tarjetas reales del cliente (estructura idéntica a CardInput de walletwallet.ts)
const INITIAL_CARDS = [
  {
    id: 'card-1',
    businessName: 'El Salón de Vale',
    category: 'Gastronomía',
    memberName: 'Fede',
    stamps: 4,
    stampsRequired: 5,
    rewardText: 'Café doble + 2 medialunas sin cargo',
    rewardValueArs: 6500,
    barcodeToken: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c', // 32 chars aleatorios
    colorPreset: 'orange',
    notification: '¡Te falta solo 1 sello para tu merienda gratis!',
    shareUrl: 'https://walletwallet.dev/p/esdv-9f8e7d6c',
    hoursSinceLastStamp: 9.6, // Pasaron 9 h 36 min (faltan 14 h 24 min para cumplir 24 h)
    lastVisitText: 'Hoy, 15:40',
  },
  {
    id: 'card-2',
    businessName: 'Café del Barrio',
    category: 'Cafetería de especialidad',
    memberName: 'Fede',
    stamps: 6,
    stampsRequired: 8,
    rewardText: 'Bolsa de café en grano 250g o 20% de descuento',
    rewardValueArs: 12000,
    barcodeToken: '3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d',
    colorPreset: 'dark',
    notification: 'Nuevos granos de Colombia disponibles esta semana.',
    shareUrl: 'https://walletwallet.dev/p/cdb-3a4b5c6d',
    hoursSinceLastStamp: 31.2, // Más de 24 h: ya puede sumar en su próxima visita
    lastVisitText: 'Ayer, 10:15',
  },
  {
    id: 'card-3',
    businessName: 'Heladería Duomo',
    category: 'Postres y helados',
    memberName: 'Fede',
    stamps: 2,
    stampsRequired: 5,
    rewardText: '1/2 kilo de helado artesanal a elección',
    rewardValueArs: 9500,
    barcodeToken: '7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f',
    colorPreset: 'blue',
    notification: ' ',
    shareUrl: 'https://walletwallet.dev/p/hd-7c8d9e0f',
    hoursSinceLastStamp: 72,
    lastVisitText: '25 oct 2026',
  },
];

// Comprobantes emitidos al apoyar el celular en el mostrador
const DIGITAL_TICKETS = [
  {
    id: 'TQ-20261029-084',
    businessName: 'El Salón de Vale',
    amountArs: 12400,
    dateTime: '29 oct 2026 • 15:40',
    stampAdded: '+1 sello sumado (4 / 5)',
    rewardNote: 'Te falta 1 sello para: Café doble + 2 medialunas',
    itemsSummary: '2 Cafés de especialidad + Tostado',
    barcodeDigits: ['7', '798142', '084912'],
    colorPreset: 'orange',
  },
  {
    id: 'TQ-20261028-031',
    businessName: 'Café del Barrio',
    amountArs: 8900,
    dateTime: '28 oct 2026 • 10:15',
    stampAdded: '+1 sello sumado (6 / 8)',
    rewardNote: 'Premio a los 8 sellos: Bolsa de café 250g',
    itemsSummary: 'Flat white + Croissant relleno',
    barcodeDigits: ['7', '794019', '031554'],
    colorPreset: 'dark',
  },
  {
    id: 'TQ-20261025-119',
    businessName: 'Heladería Duomo',
    amountArs: 14500,
    dateTime: '25 oct 2026 • 21:10',
    stampAdded: '+1 sello sumado (2 / 5)',
    rewardNote: 'Ahorro de $1.500 aplicado con Beneficio Toque',
    itemsSummary: '1 Kilo de helado artesanal',
    barcodeDigits: ['7', '790883', '119204'],
    colorPreset: 'blue',
  },
];

// Beneficios cruzados de locales vecinos (estilo Pasito adaptado a Toque)
const LOCAL_BENEFITS = [
  {
    id: 'ben-1',
    businessName: 'Barbería Club Norte',
    distance: 'A 150 m de El Salón de Vale',
    discountText: '20% de descuento en corte',
    condition: 'Mostrando cualquier tarjeta activa de Toquecitos',
    savedAmountArs: 3500,
  },
  {
    id: 'ben-2',
    businessName: 'Librería & Papel Studio',
    distance: 'A 3 cuadras',
    discountText: '$3.000 de regalo en tu compra',
    condition: 'Por haber sumado 3 sellos este mes en locales de la zona',
    savedAmountArs: 3000,
  },
];

// Generador determinístico de matriz QR visual a partir de barcodeToken (16+ chars)
function QRCodeMatrix({ token }) {
  const size = 15;
  const cells = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isTopLeft = r < 4 && c < 4;
      const isTopRight = r < 4 && c >= size - 4;
      const isBottomLeft = r >= size - 4 && c < 4;

      let filled = false;
      if (isTopLeft || isTopRight || isBottomLeft) {
        const lr = r < 4 ? r : r - (size - 4);
        const lc = c < 4 ? c : c - (size - 4);
        filled =
          lr === 0 ||
          lr === 3 ||
          lc === 0 ||
          lc === 3 ||
          (lr >= 1 && lr <= 2 && lc >= 1 && lc <= 2);
      } else {
        const charCode = token.charCodeAt((r * size + c) % token.length);
        filled = (charCode + r * 7 + c * 13) % 2 === 0;
      }
      cells.push(filled);
    }
  }

  return (
    <div
      className="grid gap-[1.5px] bg-white p-3 rounded-2xl shadow-sm"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, width: 136, height: 136 }}
      aria-label="Código QR de socio"
    >
      {cells.map((active, idx) => (
        <div
          key={idx}
          className={`w-full h-full rounded-[1px] ${active ? 'bg-[#0A0A0A]' : 'bg-white'}`}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState('cards'); // 'cards' | 'tickets' | 'benefits'
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(DIGITAL_TICKETS[0].id);
  const [frontCardIndex, setFrontCardIndex] = useState(0);
  const [theme, setTheme] = useState('dark'); // 'dark' (Matte Dark Toque) | 'light' (Referencia blanca)
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [promptDrawerOpen, setPromptDrawerOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [userEmail, setUserEmail] = useState('fede@ejemplo.com');
  const [isVerified, setIsVerified] = useState(true);

  const isDark = theme === 'dark';
  const selectedCard = INITIAL_CARDS.find((c) => c.id === selectedCardId) || null;
  const selectedTicket =
    DIGITAL_TICKETS.find((t) => t.id === selectedTicketId) || DIGITAL_TICKETS[0];

  // Cálculos reales basados en premios canjeados y en curso
  const totalSavedArs = 18500; // Suma de premios ya canjeados por el cliente
  const pendingRewardsValueArs = INITIAL_CARDS.reduce(
    (acc, c) => acc + Math.round((c.stamps / c.stampsRequired) * c.rewardValueArs),
    0
  );

  // Ordena las tarjetas dentro del tarjetero de cuero para que la elegida quede adelante
  const orderedCards = [
    ...INITIAL_CARDS.filter((_, idx) => idx !== frontCardIndex),
    INITIAL_CARDS[frontCardIndex],
  ];

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const formatCooldown = (hoursElapsed) => {
    if (hoursElapsed >= 24) {
      return {
        canStamp: true,
        shortText: 'Habilitado hoy',
        detailText: 'Disponible al apoyar tu celular en el local',
        progressPct: 100,
      };
    }
    const remainingHoursTotal = 24 - hoursElapsed;
    const h = Math.floor(remainingHoursTotal);
    const m = Math.round((remainingHoursTotal - h) * 60);
    return {
      canStamp: false,
      shortText: `${h} h ${m} m`,
      detailText: `Próximo sello habilitado en ${h} h ${m} min (1 por cada 24 h)`,
      progressPct: Math.round((hoursElapsed / 24) * 100),
    };
  };

  const primaryCooldown = formatCooldown(INITIAL_CARDS[0].hoursSinceLastStamp);

  const aiStudioPrompt = `Actuá como Principal Full-Stack Architect en React 19, Tailwind CSS, Hono y Cloudflare Workers.
Actualizá la vista pública de clientes "Toquecitos" (src/features/public/ToquecitosView.tsx) replicando exactamente esta estructura:
1. Cabecera con "Ahorrado con Toque" ($ ARS ahorrados según premios canjeados) y píldora verde de premios canjeados.
2. Tarjetero 3D en cuero con costura y botón grabado que contiene las tarjetas reales del cliente. Al tocar una tarjeta, se abre el modal con el pase exacto de WalletWallet (worker/walletwallet.ts: logoText, SOCIO, SELLOS, PREMIO y QR de barcodeToken de 16+ caracteres sin texto debajo, más botón a shareUrl y contador estricto de 24 horas desde last_stamped_at sin permitir auto-sumar puntos).
3. Tres tarjetas selectoras horizontales debajo del tarjetero: "Mis tarjetas", "Tickets" y "Beneficios", sincronizadas con la barra inferior flotante.
4. En la sección "Tickets", renderizá el comprobante con cortes laterales semicirculares, línea punteada, N.º de comprobante, Monto, Fecha y hora, recuadro del comercio con el sello sumado, código de barras inferior y borde inferior troquelado con círculos.
5. Cero palabras técnicas (prohibido mostrar localStorage, D1, Cloudflare o UUID) y uso normal de mayúsculas.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiStudioPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  return (
    <div
      className={`min-h-screen font-sans flex flex-col items-center justify-start py-6 px-3 transition-colors duration-300 ${
        isDark ? 'bg-[#050505] text-white' : 'bg-[#E9EAEE] text-[#111111]'
      }`}
    >
      {/* Barra de controles superior (fuera del teléfono para probar todo) */}
      <div className="w-full max-w-[400px] mb-4 flex items-center justify-between gap-2 bg-[#141414] border border-[#242424] text-white px-3.5 py-2.5 rounded-2xl shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#D95B26]" />
          <span className="text-xs font-semibold tracking-tight">Toquecitos UI</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center gap-1.5 text-xs bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#2E2E2E] px-2.5 py-1.5 rounded-xl transition-colors"
            title="Cambiar entre modo oscuro Toque y modo claro de referencia"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-sky-400" />}
            <span>{isDark ? 'Modo claro' : 'Matte Dark'}</span>
          </button>

          <button
            onClick={() => setPromptDrawerOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-[#D95B26] hover:bg-[#E56732] text-white font-semibold px-3 py-1.5 rounded-xl transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Prompt AI Studio</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          MARCO DEL TELÉFONO (390px iPhone)
      ========================================================= */}
      <div
        className={`w-full max-w-[390px] min-h-[812px] rounded-[46px] relative overflow-hidden flex flex-col justify-between transition-colors duration-300 shadow-[0_25px_70px_rgba(0,0,0,0.65)] ${
          isDark
            ? 'bg-[#0A0A0A] text-white border-[6px] border-[#1C1C1E]'
            : 'bg-[#F7F7F9] text-[#111111] border-[6px] border-white'
        }`}
      >
        {/* Notificación flotante suave */}
        {toastMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-[88%] bg-[#18181B] text-white border border-white/15 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-medium">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Contenido superior desplazable */}
        <div className="flex-1 overflow-y-auto pb-28">
          {/* 1. BARRA SUPERIOR (Estilo exacto de la referencia) */}
          <div className="px-6 pt-6 pb-2 flex items-center justify-between">
            {/* Botón izquierdo con isotipo de billetera Toque */}
            <button
              onClick={() => setActiveSection('cards')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                isDark
                  ? 'bg-[#141414] border border-[#242424] hover:border-[#333333]'
                  : 'bg-[#ECECEF] hover:bg-[#E2E2E6]'
              }`}
              aria-label="Inicio de Toquecitos"
            >
              <div
                className={`w-5 h-3.5 rounded-[5px] border-2 relative flex items-center justify-center ${
                  isDark ? 'border-white bg-[#242424]' : 'border-[#1C1C1E] bg-[#1C1C1E]'
                }`}
              >
                <div className="w-3 h-1 rounded-full bg-[#D95B26]" />
              </div>
            </button>

            {/* Selector central "Todas las tarjetas" */}
            <button
              onClick={() => {
                setFrontCardIndex((prev) => (prev + 1) % INITIAL_CARDS.length);
                setActiveSection('cards');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                isDark
                  ? 'bg-[#141414] border border-[#242424] text-white hover:bg-[#1B1B1B]'
                  : 'bg-[#ECECEF] text-[#111111] hover:bg-[#E2E2E6]'
              }`}
            >
              <span>Todas tus tarjetas ({INITIAL_CARDS.length})</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {/* Avatar de cuenta a la derecha */}
            <button
              onClick={() => setAccountModalOpen(true)}
              className="relative w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-[#D95B26] to-amber-500 shadow-sm"
              aria-label="Tu cuenta"
            >
              <div
                className={`w-full h-full rounded-full flex items-center justify-center font-bold text-xs ${
                  isDark ? 'bg-[#141414] text-white' : 'bg-white text-[#111111]'
                }`}
              >
                {userEmail ? userEmail[0].toUpperCase() : <User className="w-4 h-4" />}
              </div>
              {isVerified && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0A0A0A]" />
              )}
            </button>
          </div>

          {/* =========================================================
              VISTA 1: MIS TARJETAS (Con el Tarjetero de Cuero 3D)
          ========================================================= */}
          {activeSection === 'cards' && (
            <>
              {/* Cabecera de Dinero Ahorrado con Toque */}
              <div className="px-6 pt-3 pb-2">
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-[#8E8E93]' : 'text-zinc-500'}`}>
                  Ahorrado con Toque
                </p>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[36px] font-bold tracking-tight leading-none">
                    ${totalSavedArs.toLocaleString('es-AR')}
                    <span className={`text-[24px] font-semibold ${isDark ? 'text-[#5E5E63]' : 'text-zinc-400'}`}>
                      ,00
                    </span>
                  </div>

                  {/* Píldora verde de premios canjeados */}
                  <div className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-500 px-2.5 py-1 rounded-full text-xs font-semibold">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                    </span>
                    <span>3 canjes</span>
                  </div>
                </div>
              </div>

              {/* TARJETERO DE CUERO 3D (Idéntico a la referencia con las tarjetas reales adentro) */}
              <div className="px-5 mt-3">
                <div className="relative w-full h-[238px] flex justify-center select-none">
                  {/* Sombra suave detrás de las tarjetas */}
                  <div
                    className={`absolute top-2 w-[84%] h-[120px] rounded-t-[22px] transition-colors ${
                      isDark ? 'bg-white/5' : 'bg-black/5'
                    }`}
                  />

                  {/* Tarjetas apiladas que asoman del bolsillo de cuero */}
                  {orderedCards.map((card, idx) => {
                    const preset = COLOR_PRESETS[card.colorPreset] || COLOR_PRESETS.dark;
                    const isFront = idx === orderedCards.length - 1;
                    const isMiddle = idx === orderedCards.length - 2;

                    const topOffset = isFront ? 'top-[26px]' : isMiddle ? 'top-[12px]' : 'top-[2px]';
                    const widthClass = isFront ? 'w-[86%]' : isMiddle ? 'w-[80%]' : 'w-[74%]';
                    const zIndex = isFront ? 'z-20' : isMiddle ? 'z-10' : 'z-0';

                    return (
                      <button
                        key={card.id}
                        onClick={() => {
                          if (isFront) {
                            setSelectedCardId(card.id);
                          } else {
                            const realIdx = INITIAL_CARDS.findIndex((c) => c.id === card.id);
                            setFrontCardIndex(realIdx);
                          }
                        }}
                        className={`absolute ${topOffset} ${widthClass} ${zIndex} h-[135px] rounded-t-[20px] bg-gradient-to-br ${preset.bg} ${preset.border} border-t border-x p-4 flex flex-col justify-between text-left shadow-[0_-6px_18px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1.5 cursor-pointer`}
                      >
                        {/* Brillo metálico superior */}
                        <div className="flex items-start justify-between w-full">
                          <div>
                            <p className="font-serif text-[20px] font-semibold text-white tracking-tight leading-tight drop-shadow-sm">
                              {card.businessName}
                            </p>
                            <p className={`text-[11px] font-medium ${preset.label}`}>
                              {card.rewardText}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-semibold tracking-wider text-white/75 block">
                              SELLOS
                            </span>
                            <span className="text-sm font-bold text-white">
                              {card.stamps} / {card.stampsRequired}
                            </span>
                          </div>
                        </div>

                        {/* Indicador sutil para tocar y abrir el pase */}
                        <div className="flex items-center justify-between text-[11px] text-white/80 pt-1">
                          <span>Tocar para abrir tu pase QR</span>
                          <span className="font-semibold">${card.rewardValueArs.toLocaleString('es-AR')}</span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Bolsillo frontal de cuero con costura perimetral y broche grabado */}
                  <div
                    onClick={() => setSelectedCardId(INITIAL_CARDS[frontCardIndex].id)}
                    className="absolute bottom-0 w-full h-[146px] rounded-[26px] bg-gradient-to-b from-[#4A342B] via-[#38261E] to-[#271A14] shadow-[0_16px_32px_rgba(0,0,0,0.45),inset_0_2px_3px_rgba(255,255,255,0.18)] border border-[#5C4238] flex flex-col items-center justify-between p-3.5 z-30 cursor-pointer"
                  >
                    {/* Curva interna de la boca del tarjetero */}
                    <div className="w-[92%] h-2 rounded-b-full bg-black/25 shadow-inner" />

                    {/* Costura punteada de marroquinería alrededor del bolsillo */}
                    <div className="absolute inset-2.5 rounded-[20px] border border-dashed border-[#6E5146]/60 pointer-events-none" />

                    {/* Botón central grabado en cuero */}
                    <div className="my-auto flex flex-col items-center">
                      <div className="w-12 h-7 rounded-full bg-gradient-to-b from-[#33221B] to-[#4A342B] border border-[#221611] shadow-[inset_0_2px_5px_rgba(0,0,0,0.75),0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center">
                        <div className="w-9 h-4 rounded-full bg-[#2A1C16] border border-[#5A4036]/40" />
                      </div>
                    </div>

                    {/* Pie del bolsillo: selector rápido de las 3 tarjetas guardadas */}
                    <div className="w-full flex items-center justify-between px-3 z-10">
                      <span className="text-[11px] text-[#C7B2A8] font-medium">
                        {INITIAL_CARDS[frontCardIndex].businessName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {INITIAL_CARDS.map((c, idx) => (
                          <button
                            key={c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFrontCardIndex(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === frontCardIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/35'
                            }`}
                            aria-label={`Ver ${c.businessName}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* =========================================================
              VISTA 2: SECCIÓN DEDICADA DE TICKETS (Comprobantes emitidos)
          ========================================================= */}
          {activeSection === 'tickets' && (
            <div className="px-5 pt-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Tus tickets digitales</h2>
                  <p className={`text-xs ${isDark ? 'text-[#8E8E93]' : 'text-zinc-500'}`}>
                    Guardados al apoyar tu celular en el comercio
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#D95B26]/15 text-[#D95B26]">
                  {DIGITAL_TICKETS.length} recibos
                </span>
              </div>

              {/* Píldoras para cambiar entre los tickets guardados del usuario */}
              <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
                {DIGITAL_TICKETS.map((t) => {
                  const isSelected = t.id === selectedTicket.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-[#D95B26] text-white border-[#D95B26] shadow-sm'
                          : isDark
                          ? 'bg-[#141414] text-[#8E8E93] border-[#242424] hover:text-white'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:text-black'
                      }`}
                    >
                      <span>{t.businessName}</span>
                      <span className="opacity-75">${t.amountArs.toLocaleString('es-AR')}</span>
                    </button>
                  );
                })}
              </div>

              {/* EL TICKET TROQUELADO (Réplica exacta de la referencia adaptada a Toque) */}
              <div className="mt-1 relative">
                <div
                  className={`relative w-full rounded-t-[26px] pt-6 pb-8 overflow-hidden transition-colors shadow-xl ${
                    isDark
                      ? 'bg-[#141414] border border-[#242424] text-white'
                      : 'bg-white border border-zinc-200/80 text-[#111111]'
                  }`}
                >
                  {/* Muescas semicirculares laterales alineadas con la línea punteada */}
                  <div
                    className={`absolute top-[132px] -left-3 w-6 h-6 rounded-full ${
                      isDark ? 'bg-[#0A0A0A] border-r border-[#242424]' : 'bg-[#F7F7F9] border-r border-zinc-200'
                    }`}
                  />
                  <div
                    className={`absolute top-[132px] -right-3 w-6 h-6 rounded-full ${
                      isDark ? 'bg-[#0A0A0A] border-l border-[#242424]' : 'bg-[#F7F7F9] border-l border-zinc-200'
                    }`}
                  />

                  {/* Encabezado de confirmación */}
                  <div className="flex flex-col items-center text-center px-6 pb-5">
                    <div className="text-3xl mb-2 select-none">🎉</div>
                    <h3 className="text-lg font-bold tracking-tight">¡Gracias por tu visita!</h3>
                    <p className={`text-xs mt-0.5 max-w-[220px] ${isDark ? 'text-[#8E8E93]' : 'text-zinc-500'}`}>
                      Tu comprobante y tu sello en {selectedTicket.businessName} quedaron registrados
                    </p>
                  </div>

                  {/* Primera línea divisoria punteada */}
                  <div
                    className={`w-[84%] mx-auto border-t border-dashed my-1 ${
                      isDark ? 'border-[#2E2E32]' : 'border-zinc-300'
                    }`}
                  />

                  {/* Datos del comprobante */}
                  <div className="px-6 py-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-zinc-400'}`}>
                          N.º DE COMPROBANTE
                        </p>
                        <p className="text-xs font-semibold mt-0.5">{selectedTicket.id}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-zinc-400'}`}>
                          Monto
                        </p>
                        <p className="text-sm font-bold mt-0.5">
                          ${selectedTicket.amountArs.toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-zinc-400'}`}>
                          FECHA Y HORA
                        </p>
                        <p className="text-xs font-semibold mt-0.5">{selectedTicket.dateTime}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-zinc-400'}`}>
                          Detalle
                        </p>
                        <p className="text-xs font-medium mt-0.5">{selectedTicket.itemsSummary}</p>
                      </div>
                    </div>

                    {/* Recuadro interno: Comercio + Sello sumado en Toquecitos (sin tarjetas de crédito) */}
                    <div
                      className={`rounded-2xl p-3.5 flex items-center justify-between gap-3 ${
                        isDark ? 'bg-[#1C1C1F] border border-[#2A2A2E]' : 'bg-[#F5F6FA] border border-zinc-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#D95B26] text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {selectedTicket.businessName[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight">{selectedTicket.businessName}</p>
                          <p className="text-[11px] text-emerald-500 font-semibold mt-0.5">
                            {selectedTicket.stampAdded}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const match = INITIAL_CARDS.find(
                            (c) => c.businessName === selectedTicket.businessName
                          );
                          if (match) setSelectedCardId(match.id);
                        }}
                        className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-colors ${
                          isDark ? 'bg-[#2A2A2E] text-white hover:bg-[#343438]' : 'bg-white text-zinc-800 shadow-sm'
                        }`}
                      >
                        Ver pase
                      </button>
                    </div>
                  </div>

                  {/* Segunda línea divisoria punteada */}
                  <div
                    className={`w-full border-t border-dashed my-2 ${
                      isDark ? 'border-[#2E2E32]' : 'border-zinc-300'
                    }`}
                  />

                  {/* Código de barras inferior del comprobante */}
                  <div className="px-8 pt-3 pb-2 flex flex-col items-center">
                    <div className="flex items-end justify-center gap-[2px] w-full h-12">
                      {[
                        3, 1, 4, 2, 1, 3, 5, 1, 2, 2, 1, 4, 1, 2, 3, 1, 4, 2, 1, 5, 2, 1, 3, 2, 1,
                        4, 2, 1, 3, 1, 2, 4,
                      ].map((w, i) => (
                        <div
                          key={i}
                          className={`h-full rounded-[0.5px] ${isDark ? 'bg-white' : 'bg-[#111111]'}`}
                          style={{ width: `${w}px` }}
                        />
                      ))}
                    </div>
                    <div
                      className={`flex justify-between w-full px-3 mt-1.5 font-mono text-[10px] tracking-[0.2em] ${
                        isDark ? 'text-[#8E8E93]' : 'text-zinc-500'
                      }`}
                    >
                      <span>{selectedTicket.barcodeDigits[0]}</span>
                      <span>{selectedTicket.barcodeDigits[1]}</span>
                      <span>{selectedTicket.barcodeDigits[2]}</span>
                    </div>
                  </div>

                  {/* Borde inferior troquelado con recortes circulares */}
                  <div className="absolute -bottom-2.5 left-0 w-full flex justify-between px-2">
                    {[...Array(13)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F7F7F9]'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Acciones reales del comprobante */}
                <div className="grid grid-cols-2 gap-2.5 mt-3">
                  <button
                    onClick={() => triggerToast('Comprobante descargado en PDF')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-semibold border transition-colors ${
                      isDark
                        ? 'bg-[#141414] border-[#242424] hover:bg-[#1C1C1F] text-white'
                        : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-[#D95B26]" />
                    <span>Descargar PDF</span>
                  </button>
                  <button
                    onClick={() => triggerToast('Imagen guardada en tus fotos')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-semibold border transition-colors ${
                      isDark
                        ? 'bg-[#141414] border-[#242424] hover:bg-[#1C1C1F] text-white'
                        : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#D95B26]" />
                    <span>Guardar imagen</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VISTA 3: BENEFICIOS DE LA RED TOQUE (Comercios cercanos)
          ========================================================= */}
          {activeSection === 'benefits' && (
            <div className="px-5 pt-3">
              <div className="mb-3 px-1">
                <h2 className="text-lg font-bold tracking-tight">Beneficios en tu zona</h2>
                <p className={`text-xs ${isDark ? 'text-[#8E8E93]' : 'text-zinc-500'}`}>
                  Descuentos por usar Toque en comercios adheridos del barrio
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {LOCAL_BENEFITS.map((ben) => (
                  <div
                    key={ben.id}
                    className={`p-4 rounded-2xl border transition-colors ${
                      isDark ? 'bg-[#141414] border-[#242424]' : 'bg-white border-zinc-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#D95B26] font-semibold">
                          <MapPin className="w-3 h-3" />
                          {ben.distance}
                        </span>
                        <h3 className="text-sm font-bold mt-0.5">{ben.businessName}</h3>
                      </div>
                      <span className="bg-emerald-500/15 text-emerald-500 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0">
                        Ahorrás ${ben.savedAmountArs.toLocaleString('es-AR')}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-[#D95B26] mt-2">{ben.discountText}</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8E8E93]' : 'text-zinc-500'}`}>
                      {ben.condition}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================
              3 TARJETAS SELECTORAS HORIZONTALES (Igual a la referencia)
          ========================================================= */}
          <div className="px-5 mt-5 grid grid-cols-3 gap-2.5">
            {[
              {
                id: 'cards',
                icon: Wallet,
                label: 'Mis tarjetas',
                sub: `${INITIAL_CARDS.length} activas`,
                accentColor: 'text-amber-500',
              },
              {
                id: 'tickets',
                icon: Receipt,
                label: 'Tickets',
                sub: `${DIGITAL_TICKETS.length} recibos`,
                accentColor: 'text-[#D95B26]',
              },
              {
                id: 'benefits',
                icon: Gift,
                label: 'Beneficios',
                sub: 'En tu zona',
                accentColor: 'text-emerald-500',
              },
            ].map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex flex-col items-start p-3.5 rounded-[20px] text-left transition-all border ${
                    isActive
                      ? isDark
                        ? 'bg-[#262629] border-[#3A3A3E] text-white shadow-md'
                        : 'bg-[#2C2C2E] border-[#2C2C2E] text-white shadow-md'
                      : isDark
                      ? 'bg-[#141414] border-[#222225] text-[#8E8E93] hover:bg-[#1A1A1E]'
                      : 'bg-[#ECECEF] border-transparent text-zinc-600 hover:bg-[#E3E3E8]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : isDark
                        ? 'bg-[#1F1F23] ' + item.accentColor
                        : 'bg-white ' + item.accentColor
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-xs font-semibold leading-tight ${
                      isActive ? 'text-white' : isDark ? 'text-white' : 'text-[#111111]'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-[10px] opacity-70 mt-0.5">{item.sub}</span>
                </button>
              );
            })}
          </div>

          {/* =========================================================
              TARJETA INFERIOR DE RESUMEN (Adaptada de la referencia a Toque)
          ========================================================= */}
          <div className="px-5 mt-4">
            <div
              className={`rounded-[24px] p-4 border transition-colors ${
                isDark ? 'bg-[#141414] border-[#242424]' : 'bg-[#F1F1F4] border-zinc-200/70'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">Resumen de tus visitas</span>
                <button
                  onClick={() => setSelectedCardId(INITIAL_CARDS[0].id)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isDark ? 'bg-[#222226] text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                  }`}
                  aria-label="Ver detalle de tarjeta"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                {/* Columna Izquierda: Valor acumulado en tarjetas en curso */}
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    ${pendingRewardsValueArs.toLocaleString('es-AR')}
                    <span className={`text-sm font-medium ${isDark ? 'text-[#6E6E73]' : 'text-zinc-400'}`}>
                      ,00
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ▲ 4 sellos
                    </span>
                    <span className={`text-[10px] ${isDark ? 'text-[#8E8E93]' : 'text-zinc-500'}`}>
                      en curso
                    </span>
                  </div>

                  {/* Barra de progreso horizontal con círculo */}
                  <div
                    className={`w-full h-2 rounded-full mt-3 relative flex items-center ${
                      isDark ? 'bg-[#26262A]' : 'bg-zinc-300/80'
                    }`}
                  >
                    <div className="w-[68%] h-full rounded-full bg-sky-500" />
                    <div className="w-3 h-3 rounded-full bg-sky-500 border-2 border-white -ml-1.5 shadow" />
                  </div>
                </div>

                {/* Columna Derecha: Tiempo para el próximo sello (Regla de 24 h) */}
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    {primaryCooldown.shortText}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-[#26262A] text-zinc-300' : 'bg-zinc-600 text-white'
                      }`}
                    >
                      Cada 24 h
                    </span>
                    <span className={`text-[10px] truncate ${isDark ? 'text-[#8E8E93]' : 'text-zinc-500'}`}>
                      próximo sello
                    </span>
                  </div>

                  {/* Barra de rayitas verticales (igual a la referencia) */}
                  <div className="flex items-center justify-between gap-[2px] mt-3 h-2.5">
                    {[...Array(18)].map((_, idx) => {
                      const filled = idx < Math.round((primaryCooldown.progressPct / 100) * 18);
                      return (
                        <span
                          key={idx}
                          className={`w-[2px] h-full rounded-full ${
                            filled
                              ? 'bg-[#D95B26]'
                              : isDark
                              ? 'bg-[#2C2C30]'
                              : 'bg-zinc-300'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            BARRA INFERIOR FLOTANTE (Píldora + Botón circular derecho)
        ========================================================= */}
        <div
          className={`absolute bottom-0 inset-x-0 px-6 py-4 flex items-center justify-between pointer-events-none ${
            isDark
              ? 'bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/90 to-transparent'
              : 'bg-gradient-to-t from-[#F7F7F9] via-[#F7F7F9]/90 to-transparent'
          }`}
        >
          {/* Píldora izquierda con las 3 vistas */}
          <div
            className={`pointer-events-auto flex items-center gap-1 p-1.5 rounded-full border shadow-lg ${
              isDark ? 'bg-[#141414] border-[#242424]' : 'bg-[#ECECEF] border-zinc-200'
            }`}
          >
            {[
              { id: 'cards', icon: Wallet, label: 'Tarjetas' },
              { id: 'tickets', icon: Receipt, label: 'Tickets' },
              { id: 'benefits', icon: Gift, label: 'Beneficios' },
            ].map((nav) => {
              const active = activeSection === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveSection(nav.id)}
                  className={`px-4 py-2 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all ${
                    active
                      ? isDark
                        ? 'bg-[#26262A] text-white shadow'
                        : 'bg-white text-[#111111] shadow'
                      : isDark
                      ? 'text-[#8E8E93] hover:text-white'
                      : 'text-zinc-500 hover:text-black'
                  }`}
                >
                  <nav.icon className="w-4 h-4" />
                  {active && <span>{nav.label}</span>}
                </button>
              );
            })}
          </div>

          {/* Botón circular derecho (Ver pase QR de la tarjeta frontal) */}
          <button
            onClick={() => setSelectedCardId(INITIAL_CARDS[frontCardIndex].id)}
            className={`pointer-events-auto w-12 h-12 rounded-full flex items-center justify-center border shadow-lg transition-transform active:scale-95 ${
              isDark
                ? 'bg-[#141414] border-[#242424] text-white hover:bg-[#1E1E22]'
                : 'bg-[#ECECEF] border-zinc-200 text-[#111111] hover:bg-white'
            }`}
            title="Ver pase QR para mostrar en caja"
          >
            <Sparkles className="w-4 h-4 text-[#D95B26]" />
          </button>
        </div>

        {/* =========================================================
            MODAL DEL PASE EXACTO DE WALLETWALLET (worker/walletwallet.ts)
        ========================================================= */}
        {selectedCard && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-[360px] bg-[#121214] border border-[#262629] rounded-[32px] p-5 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-400">
                  Vista exacta de tu pase en Wallet
                </span>
                <button
                  onClick={() => setSelectedCardId(null)}
                  className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* TARJETA IDÉNTICA A buildBody() DE WALLETWALLET.TS */}
              {(() => {
                const preset = COLOR_PRESETS[selectedCard.colorPreset] || COLOR_PRESETS.dark;
                const cooldown = formatCooldown(selectedCard.hoursSinceLastStamp);

                return (
                  <>
                    <div
                      className={`w-full rounded-[24px] bg-gradient-to-b ${preset.bg} ${preset.border} border p-5 shadow-xl flex flex-col justify-between`}
                    >
                      {/* Fila 1: logoText (businessName) + headerFields (SOCIO) */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm text-white">
                            {selectedCard.businessName[0]}
                          </div>
                          <span className="font-bold text-sm text-white tracking-tight">
                            {selectedCard.businessName.slice(0, 40)}
                          </span>
                        </div>

                        {selectedCard.memberName && (
                          <div className="text-right">
                            <span className="text-[9px] font-bold tracking-wider uppercase text-white/70 block">
                              SOCIO
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {selectedCard.memberName.slice(0, 40)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Fila 2 (primaryFields): SELLOS -> "${stamps} / ${stampsRequired}" */}
                      <div className="my-5">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-white/75 block">
                          SELLOS
                        </span>
                        <div className="text-4xl font-bold text-white tracking-tight mt-0.5">
                          {selectedCard.stamps} / {selectedCard.stampsRequired}
                        </div>
                      </div>

                      {/* Fila 3 (secondaryFields): PREMIO -> rewardText */}
                      <div className="mb-5">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-white/75 block">
                          PREMIO
                        </span>
                        <p className="text-xs font-semibold text-white mt-0.5 leading-snug">
                          {selectedCard.rewardText.slice(0, 60)}
                        </p>
                      </div>

                      {/* Fila 4 (barcode): QR de barcodeToken SIN texto debajo (barcodeAltText: '') */}
                      <div className="flex flex-col items-center justify-center pt-1 pb-1">
                        <QRCodeMatrix token={selectedCard.barcodeToken} />
                      </div>
                    </div>

                    {/* Indicador de regla estricta de 24 horas (sin botón de auto-sumar) */}
                    <div className="mt-3.5 bg-[#1A1A1E] border border-[#2A2A2E] rounded-2xl p-3 flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          cooldown.canStamp
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <p className="font-semibold text-white">{cooldown.detailText}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Los sellos se acreditan únicamente en el comercio (máximo 1 cada 24 h).
                        </p>
                      </div>
                    </div>

                    {/* Último aviso del comercio si existe */}
                    {selectedCard.notification && selectedCard.notification.trim() !== '' && (
                      <div className="mt-2.5 bg-[#1A1A1E] border border-[#2A2A2E] rounded-2xl p-3 text-xs">
                        <span className="text-[10px] font-semibold text-zinc-400 block">
                          Último aviso del local
                        </span>
                        <p className="text-zinc-200 mt-0.5">{selectedCard.notification}</p>
                      </div>
                    )}

                    {/* Botón oficial a shareUrl de WalletWallet */}
                    <div className="mt-4 flex flex-col gap-2">
                      <a
                        href={selectedCard.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          triggerToast('Abriendo tu pase para Apple / Google Wallet');
                        }}
                        className="w-full py-3 px-4 rounded-2xl bg-[#D95B26] hover:bg-[#E56732] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                      >
                        <Wallet className="w-4 h-4" />
                        <span>Guardar en Apple o Google Wallet</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </a>

                      <button
                        onClick={() => {
                          setSelectedCardId(null);
                          triggerToast('Solicitaste dar de baja esta tarjeta');
                        }}
                        className="w-full py-2 text-[11px] text-zinc-400 hover:text-red-400 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Dar de baja esta tarjeta</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL DE CUENTA (Verificación por correo y consentimientos)
        ========================================================= */}
        {accountModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-[350px] bg-[#141414] border border-[#262629] rounded-[28px] p-5 text-white shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">Tu cuenta en Toquecitos</h3>
                <button
                  onClick={() => setAccountModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Al asociar tu correo electrónico, tus tarjetas de sellos y tus tickets quedan resguardados para que nunca los pierdas si cambiás de teléfono.
              </p>

              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Tu correo electrónico
              </label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2E] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D95B26] mb-3"
              />

              <div className="space-y-2.5 text-xs text-zinc-300 mb-5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 accent-[#D95B26] rounded"
                  />
                  <span>Guardar mis tarjetas de puntos, tickets y ahorros en mi cuenta.</span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 accent-[#D95B26] rounded"
                  />
                  <span>Recibir descuentos de los comercios a los que voy y de locales adheridos.</span>
                </label>
              </div>

              <button
                onClick={() => {
                  setIsVerified(true);
                  setAccountModalOpen(false);
                  triggerToast('Tus preferencias quedaron guardadas');
                }}
                className="w-full py-3 rounded-2xl bg-[#D95B26] hover:bg-[#E56732] text-white font-semibold text-xs transition-colors"
              >
                Guardar preferencias
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            DRAWER CON EL PROMPT LISTO PARA GOOGLE AI STUDIO
        ========================================================= */}
        {promptDrawerOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#141414] border border-[#262629] rounded-[28px] p-5 text-white shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Prompt listo para Google AI Studio</h3>
                <button
                  onClick={() => setPromptDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="bg-[#0A0A0A] border border-[#242424] rounded-2xl p-3.5 text-[11px] text-zinc-300 whitespace-pre-wrap max-h-72 overflow-y-auto font-mono">
                {aiStudioPrompt}
              </pre>
              <button
                onClick={handleCopyPrompt}
                className="mt-4 w-full py-3 rounded-2xl bg-[#D95B26] hover:bg-[#E56732] text-white font-semibold text-xs flex items-center justify-center gap-2"
              >
                {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPrompt ? '¡Copiado al portapapeles!' : 'Copiar prompt'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}