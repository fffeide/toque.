/**
 * Toque — Barra de Filtros y Búsqueda (FilterBar)
 */

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from './Input';

export interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  placeholder = 'Buscar por nombre o ubicación...',
  children,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
      <div className="flex-1 max-w-md">
        <Input
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={placeholder}
          leftIcon={<Search className="w-4 h-4" />}
          className="h-10 text-small"
        />
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
};
