/**
 * Toque — Navegación de Pestañas (Tabs)
 */

import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeId, onChange, className = '' }) => {
  return (
    <div className={`flex border-b border-[var(--border-subtle)] overflow-x-auto scrollbar-none ${className}`}>
      {tabs.map(t => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-small whitespace-nowrap cursor-pointer transition select-none ${
              isActive
                ? 'border-[var(--brand)] text-[var(--brand)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
            }`}
          >
            {t.icon && <span className="shrink-0">{t.icon}</span>}
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span className="px-1.5 py-0.5 text-micro rounded-full bg-black/5 dark:bg-white/10 font-mono text-[var(--text-muted)]">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
