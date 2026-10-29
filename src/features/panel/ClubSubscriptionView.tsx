import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { PlanState } from '../../api/types';
import { TOQUE_PLANS_LIST, TRIAL_DAYS, formatArs } from '../../config/pricing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CheckCircle2, ShieldCheck, Clock, Sparkles } from 'lucide-react';

export const ClubSubscriptionView: React.FC = () => {
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const loadPlan = async () => {
    setLoading(true);
    try {
      const state = await api.getPlanState();
      setPlanState(state);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, []);

  const handleSelectPlan = async (planId: 'free' | 'mensual' | 'anual' | 'a_consultar') => {
    setActivatingId(planId);
    setFeedback('');
    try {
      const updated = await api.startTrial(planId);
      setPlanState(updated);
      setFeedback(
        planId === 'free'
          ? 'Plan Gratuito seleccionado.'
          : planId === 'a_consultar'
          ? 'Plan A Consultar seleccionado.'
          : `Plan ${planId === 'anual' ? 'Anual' : 'Mensual'} seleccionado.`
      );
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#f1f1ee]">
              Tu suscripción
            </h1>
            <p className="text-sm text-[#a1a1aa] mt-1">
              Todos los locales incluidos. Sin costos ocultos ni comisiones por venta.
            </p>
          </div>

          {!loading && planState && (
            <div className="px-4 py-2 rounded-xl border border-[#bec8ff]/30 bg-[#bec8ff]/10 text-[#bec8ff] font-bold text-xs flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {planState.status === 'trial' && (
                <span>Prueba gratis activa · Quedan {planState.daysRemaining} días</span>
              )}
              {planState.status === 'active' && (
                <span>Suscripción activa · Plan {planState.planId === 'anual' ? 'Anual' : 'Mensual'}</span>
              )}
              {planState.status === 'expired' && (
                <span>Período de prueba vencido</span>
              )}
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#a1a1aa] flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#2fb36a] shrink-0 mt-0.5" />
          <p>
            <strong className="text-[#f1f1ee]">Tranquilidad para tu comercio:</strong> si tu prueba o suscripción vence, el Cartel QR del mostrador y las tarjetas de tus clientes siguen funcionando para que nadie pierda sus sellos; solo se pausan el panel y el envío de avisos hasta que renueves.
          </p>
        </div>

        {feedback && (
          <div className="p-3 rounded-xl bg-[#2fb36a]/10 border border-[#2fb36a]/30 text-[#2fb36a] text-sm font-bold">
            {feedback}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TOQUE_PLANS_LIST.map((plan) => {
          const isCurrent = planState?.planId === plan.id;
          return (
            <Card
              key={plan.id}
              className={`p-6 flex flex-col justify-between gap-6 ${
                plan.badge ? 'border-[#bec8ff]/50' : ''
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-extrabold text-[#f1f1ee]">
                    {plan.name}
                  </h2>
                  {plan.badge && (
                    <span className="px-3 py-1 rounded-lg bg-[#bec8ff]/15 text-[#bec8ff] border border-[#bec8ff]/30 text-xs font-extrabold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-3xl font-extrabold text-[#f1f1ee]">
                    {formatArs(plan.priceArs)}
                    <span className="text-sm font-medium text-[#a1a1aa]">
                      {' '}/ {plan.periodLabel}
                    </span>
                  </div>
                  <p className="text-sm text-[#a1a1aa] mt-1">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-2.5 pt-2">
                  {plan.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2.5 text-sm font-medium text-[#e4e4e7]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#2fb36a] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                variant={isCurrent ? 'secondary' : 'primary'}
                disabled={activatingId === plan.id}
                onClick={() => handleSelectPlan(plan.id)}
                className="w-full"
              >
                {activatingId === plan.id
                  ? 'Actualizando...'
                  : isCurrent
                  ? `Plan elegido (${TRIAL_DAYS} días gratis)`
                  : `Elegir ${plan.name}`}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
