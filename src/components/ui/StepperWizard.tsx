/**
 * Toque — Asistente de Pasos (StepperWizard)
 */

import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  title: string;
  description?: string;
}

export interface StepperWizardProps {
  steps: StepItem[];
  currentStepIndex: number;
  className?: string;
}

export const StepperWizard: React.FC<StepperWizardProps> = ({
  steps,
  currentStepIndex,
  className = '',
}) => {
  return (
    <div className={`w-full py-2 ${className}`}>
      <ol className="flex items-center w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <li
              key={step.id}
              className={`flex items-center ${idx < steps.length - 1 ? 'w-full' : ''}`}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-small font-semibold border-2 transition ${
                    isCompleted
                      ? 'bg-[var(--menta)] border-[var(--menta)] text-white'
                      : isCurrent
                      ? 'border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/10'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-card)]'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className="text-micro font-medium text-[var(--text-main)] mt-1.5 whitespace-nowrap">
                  {step.title}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 transition ${
                    idx < currentStepIndex ? 'bg-[var(--menta)]' : 'bg-[var(--border-subtle)]'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
