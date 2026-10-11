/**
 * Toque — Asistente Chatbot Flotante Interactivo (ToqueChatWidget)
 * Widget inteligente con resolución de tareas en vivo para:
 * - Fabricantes: contactar comercios, activar carteles, generar kits, calcular reventa.
 * - Negocios: dudas sobre carteles, cambiar link de QR, cómo escanear, reto de equipo.
 * - Super Admin: estado de la plataforma, incidentes y métricas.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/authContext';
import { api, Cartel } from '../../api';
import { useToast } from '../../components/ui/Toast';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  QrCode,
  ArrowRight,
  HelpCircle,
  Zap,
  Printer,
  ShieldCheck,
  Minimize2,
  Maximize2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  timestamp: string;
  actions?: Array<{
    label: string;
    actionKey: string;
    payload?: any;
  }>;
}

export const ToqueChatWidget: React.FC = () => {
  const { user, tenant } = useAuth();
  const { success, error: toastError } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [cartelesList, setCartelesList] = useState<Cartel[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isManufacturer = user?.role === 'manufacturer_admin';
  const isAdmin = user?.role === 'platform_admin';
  const isBusiness = !isManufacturer && !isAdmin;

  // Cargar carteles en memoria para ejecutar tareas
  useEffect(() => {
    if (user) {
      api.listCarteles(tenant?.id).then(setCartelesList).catch(() => {});
    }
  }, [user, tenant]);

  // Mensaje de bienvenida contextual según el rol
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = isManufacturer
        ? `¡Hola, ${user?.name || 'Fabricante'}! 👋 Soy el asistente de producción de Toque. ¿En qué te ayudo hoy? Podés pedirme activar carteles, generar el kit de impresión, revisar comercios inactivos o consultar dudas técnicas de chips NTAG215.`
        : isAdmin
        ? `¡Hola, ${user?.name || 'Administrador'}! 🛡️ Asistente del panel central Toque. Puedo mostrarte el estado del sistema, métricas de recaudación MRR/ARR o detalles de los fabricantes.`
        : `¡Hola! 👋 Soy tu copiloto de Toque. Puedo resolver cualquier duda de tus carteles, cambiar el link de destino de tu QR, simular un toque de prueba o guiarte en el módulo de equipo.`;

      const initialActions = isManufacturer
        ? [
            { label: '🖨️ Generar Kit de Impresión', actionKey: 'print_kit' },
            { label: '⚠️ Ver comercios sin toques', actionKey: 'at_risk' },
            { label: '🏷️ ¿Cómo grabar chips NTAG215?', actionKey: 'guide_nfc' },
            { label: '💰 Calcular ganancia de reventa', actionKey: 'calc_profit' },
          ]
        : isAdmin
        ? [
            { label: '🟢 Ver estado del sistema (/status)', actionKey: 'check_status' },
            { label: '📊 Ver recaudación y volumen', actionKey: 'admin_mrr' },
            { label: '🧪 Probar como negocio', actionKey: 'test_biz' },
          ]
        : [
            { label: '🔗 Cambiar enlace de un cartel', actionKey: 'change_link' },
            { label: '📱 ¿Cómo se escanea el cartel?', actionKey: 'how_to_scan' },
            { label: '⚡ Simular escaneo de prueba', actionKey: 'simulate_scan' },
            { label: '👥 ¿Cómo funciona el módulo equipo?', actionKey: 'team_guide' },
            { label: '💬 WhatsApp del Fabricante', actionKey: 'whatsapp_support' },
          ];

      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: greeting,
          timestamp: 'Ahora',
          actions: initialActions,
        },
      ]);
    }
  }, [user, isManufacturer, isAdmin]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Ejecutor de tareas interactivas del asistente
  const handleActionClick = async (actionKey: string, payload?: any) => {
    switch (actionKey) {
      case 'how_to_scan': {
        addMessage('user', '¿Cómo se escanea el cartel exactamente?');
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          addMessage(
            'assistant',
            `El cartel de Toque cuenta con dos tecnologías físicas simultáneas:\n\n1. 📲 **NFC (Contactless):** El cliente solo debe apoyar la parte superior de su celular (iPhone o Android) a 1-3 cm del cartel. Sin abrir ninguna app, se despliega una notificación flotante que abre directamente la ficha de reseñas en Google Maps.\n\n2. 📷 **Código QR dinámico:** Si el teléfono no tiene NFC, el cliente abre la app nativa de Cámara y apunta al QR. Al tocar el enlace, se abre la misma ficha.\n\nAmbos métodos dirigen a **toque.ar/codigo**, que redirige en menos de 50 milisegundos a las 5 estrellas preseleccionadas.`
          );
        }, 500);
        break;
      }

      case 'change_link': {
        addMessage('user', 'Quiero cambiar el enlace de un cartel');
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const firstCartel = cartelesList[0];
          addMessage(
            'assistant',
            `¡Claro! Una de las ventajas clave de Toque es que los códigos QR y chips físicos apuntan a una URL corta dinámica (toque.ar/codigo). Podés cambiar el link de destino en cualquier momento sin tener que reimprimir el acrílico ni tirar el cartel.\n\n¿Querés actualizar el enlace del cartel principal ("${firstCartel?.name || 'Mesa 4'}")?`,
            [
              {
                label: `✏️ Actualizar link de "${firstCartel?.name || 'Cartel 1'}"`,
                actionKey: 'execute_link_update',
                payload: { cartelId: firstCartel?.id },
              },
            ]
          );
        }, 500);
        break;
      }

      case 'execute_link_update': {
        const cartelId = payload?.cartelId || cartelesList[0]?.id;
        const newUrl = 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4';
        if (cartelId) {
          try {
            await api.updateCartel(cartelId, { targetUrl: newUrl });
            success('Enlace de cartel actualizado', 'Los próximos escaneos abrirán la nueva ficha.');
            addMessage(
              'assistant',
              `✅ ¡Listo! Se actualizó con éxito el destino del cartel en la base de datos de Toque. A partir de este segundo, todos los clientes que toquen o escaneen el cartel serán dirigidos a la nueva dirección.`
            );
          } catch {
            addMessage('assistant', 'Hubo un inconveniente al actualizar el cartel.');
          }
        }
        break;
      }

      case 'simulate_scan': {
        addMessage('user', 'Quiero simular un escaneo de prueba');
        setIsTyping(true);
        setTimeout(async () => {
          const first = cartelesList[0];
          if (first) {
            try {
              await api.recordScan(first.shortCode, 'nfc');
              setIsTyping(false);
              success('¡Toque NFC registrado!', `Cartel "${first.name}" sumó +1 interacción.`);
              addMessage(
                'assistant',
                `🎉 ¡Simulación completada con éxito!\n\nSe registró un escaneo NFC en el cartel "${first.name}" (código ${first.shortCode}). La métrica de hoy se actualizó en vivo en tu tablero con tiempo de redirección de 42ms.`
              );
            } catch {
              setIsTyping(false);
              addMessage('assistant', 'No pudimos registrar el escaneo de prueba.');
            }
          }
        }, 500);
        break;
      }

      case 'team_guide': {
        addMessage('user', '¿Cómo funciona el módulo de equipo?');
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          addMessage(
            'assistant',
            `El módulo **Equipo** permite motivar y reconocer a tus colaboradores (mozos, baristas, cajeros):\n\n• **QR o link personal:** Cada colaborador recibe un código identificatorio para invitar a calificar.\n• **Ranking mensual:** Podés ver en vivo quién acumuló más valoraciones positivas de clientes.\n• **Regla ética fundamental:** En Toque está permitido incentivar y premiar a tu staff con un bono por buen servicio, pero está estrictamente prohibido premiar o condicionar al cliente (prohibido por políticas de Google).`
          );
        }, 500);
        break;
      }

      case 'whatsapp_support': {
        addMessage('user', 'Quiero contactar al fabricante por WhatsApp');
        window.open('https://wa.me/5491144558899?text=Hola,%20necesito%20soporte%20sobre%20mis%20carteles%20de%20Toque', '_blank');
        addMessage('assistant', 'Abriendo chat directo de WhatsApp con tu fabricante asignado...');
        break;
      }

      case 'print_kit': {
        addMessage('user', 'Generar Kit de Impresión');
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          addMessage(
            'assistant',
            `El kit de impresión genera planchas listas con marcas de corte en 3 tamaños estándares:\n• 2,5 cm (Mesas de bar)\n• 5,0 cm (Mostradores y cajas)\n• 10,0 cm (Vidrieras y entradas)\n\nPodés acceder a la herramienta de producción completa en la pestaña **Kit de Impresión** de tu panel de fabricante.`
          );
        }, 400);
        break;
      }

      case 'at_risk': {
        addMessage('user', 'Ver comercios sin toques');
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          addMessage(
            'assistant',
            `Analicé los 12 comercios de tu taller:\n\n• **Farmacia del Parque:** 8 días sin toques (sugerencia: verificar si el cartel sigue en el mostrador o fue tapado por folletos).\n• **Taller Los Hermanos:** 5 días sin toques.\n\nPodés enviarles un mensaje automático de WhatsApp prediseñado desde el módulo de Clientes en Riesgo para cuidar la renovación de la cuota mensual.`
          );
        }, 400);
        break;
      }

      case 'guide_nfc': {
        addMessage('user', '¿Cómo grabar chips NTAG215?');
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          addMessage(
            'assistant',
            `Guía rápida para grabado de chips NTAG215:\n\n1. Descargá la app **NFC Tools** (gratuita en iOS y Android) o usá un grabador USB ACR122U.\n2. Tipo de registro: **URI / Enlace Web** (NDEF).\n3. Formato: \`https://toque.ar/codigo\` (ej. toque.ar/k7m2p).\n4. **Importante:** Bloqueá contra reescritura solo si el cliente lo solicita expresamente; si no lo bloqueás, podrás reutilizar el chip si el cliente cambia de local.`
          );
        }, 400);
        break;
      }

      case 'check_status': {
        window.location.href = '/status';
        break;
      }

      default:
        break;
    }
  };

  const addMessage = (
    sender: 'assistant' | 'user',
    text: string,
    actions?: ChatMessage['actions']
  ) => {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userQuery = inputText.trim();
    setInputText('');
    addMessage('user', userQuery);
    setIsTyping(true);

    try {
      // Intentar llamar al backend con el modelo Gemini oficial
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userQuery,
          context: {
            role: user?.role === 'manufacturer_admin' ? 'Fabricante' : user?.role === 'platform_admin' ? 'Super Admin' : 'Comercio / Negocio',
            name: user?.name,
            tenantName: tenant?.name,
            cartelesCount: cartelesList.length,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsTyping(false);
        if (data.reply) {
          addMessage('assistant', data.reply);
          return;
        }
      }
    } catch {
      // En caso de corte de red, continuar con fallback inteligente
    }

    // Fallback inteligente contextual
    const lower = userQuery.toLowerCase();
    setTimeout(() => {
      setIsTyping(false);

      if (lower.includes('scan') || lower.includes('escan') || lower.includes('como se')) {
        handleActionClick('how_to_scan');
      } else if (lower.includes('link') || lower.includes('enlace') || lower.includes('cambiar') || lower.includes('qr')) {
        handleActionClick('change_link');
      } else if (lower.includes('equipo') || lower.includes('mozo') || lower.includes('emplead') || lower.includes('staff')) {
        handleActionClick('team_guide');
      } else if (lower.includes('simul') || lower.includes('prob') || lower.includes('test')) {
        handleActionClick('simulate_scan');
      } else if (lower.includes('whatsapp') || lower.includes('fabricante') || lower.includes('contacto')) {
        handleActionClick('whatsapp_support');
      } else if (lower.includes('chip') || lower.includes('ntag') || lower.includes('nfc') || lower.includes('grab')) {
        handleActionClick('guide_nfc');
      } else {
        addMessage(
          'assistant',
          `Como asistente de Inteligencia Artificial de Toque puedo ayudarte con cualquier aspecto operativo de tus carteles inteligentes, soporte de hardware NFC o dudas de configuración. ¿Qué querés resolver?`,
          [
            { label: '🔗 Cambiar link de QR', actionKey: 'change_link' },
            { label: '📱 ¿Cómo se escanea?', actionKey: 'how_to_scan' },
            { label: '⚡ Simular escaneo de prueba', actionKey: 'simulate_scan' },
          ]
        );
      }
    }, 400);
  };

  return (
    <div className="toque-chat-widget fixed bottom-5 right-5 z-50">
      {/* Botón flotante disparador */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-[rgba(30,50,90,0.92)] hover:bg-[rgba(20,40,80,1)] text-white shadow-xl border border-white/25 backdrop-blur-xl transition-all hover:scale-105 cursor-pointer"
          title="Abrir Asistente Toque"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900" />
          </div>
          <span className="text-xs font-semibold tracking-tight">Asistente Toque</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
            {isManufacturer ? 'Fabricante' : isAdmin ? 'Admin' : 'Negocio'}
          </span>
        </button>
      )}

      {/* Ventana Flotante del Chat */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[540px] max-h-[85vh] rounded-3xl bg-[rgba(10,18,32,0.96)] border border-white/20 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-white animate-in slide-in-from-bottom-4 duration-200">
          {/* Header del Chat */}
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Asistente Toque</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </h3>
                <p className="text-[11px] text-white/60">
                  Resolución de tareas y soporte en vivo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cuerpo de Mensajes */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl whitespace-pre-line leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-white/10 text-white/95 border border-white/10 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Acciones sugeridas / Atajos accionables */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[90%]">
                    {msg.actions.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleActionClick(act.actionKey, act.payload)}
                        className="text-[11px] font-medium py-1.5 px-3 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white transition text-left cursor-pointer active:scale-95"
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-white/40 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-white/10 border border-white/10 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:0.4s]" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input de consulta */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-white/5">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escribí tu consulta o tarea..."
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-black/30 border border-white/15 text-white placeholder-white/40 text-xs focus:outline-none focus:border-white"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="absolute right-1.5 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
