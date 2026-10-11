/**
 * Toque — Selector de Tema (ThemeToggle)
 * Claro, Oscuro y Automático según el sistema.
 */

import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme, ThemeMode } from '../../lib/themeContext';
import { SegmentedControl } from './SegmentedControl';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <SegmentedControl<ThemeMode>
      value={theme}
      onChange={setTheme}
      size="sm"
      options={[
        { value: 'light', label: 'Claro', icon: <Sun className="w-3.5 h-3.5" /> },
        { value: 'dark', label: 'Oscuro', icon: <Moon className="w-3.5 h-3.5" /> },
        { value: 'system', label: 'Sistema', icon: <Laptop className="w-3.5 h-3.5" /> },
      ]}
    />
  );
};
