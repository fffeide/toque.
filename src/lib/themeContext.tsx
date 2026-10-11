/**
 * Toque — Proveedor de Tema y Marca Blanca (ThemeContext)
 * - Modo claro / oscuro / sistema con transición suave
 * - Marca blanca: cálculo automático de contraste WCAG AA
 * - Densidad: cómoda / compacta
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type DensityMode = 'comfortable' | 'compact';

interface ContrastInfo {
  ratio: number;
  passesAA: boolean;
  recommendedColor?: string;
}

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
  brandColor: string;
  setBrandColor: (hex: string) => void;
  contrastInfo: ContrastInfo;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Cálculo de Luminancia Relativa WCAG
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function calculateContrastRatio(colorHex: string, bgHex = '#FFFFFF'): number {
  const rgb1 = hexToRgb(colorHex);
  const rgb2 = hexToRgb(bgHex);
  if (!rgb1 || !rgb2) return 4.5;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Sugiere una variante más oscura si no cumple AA
function getDarkerVariant(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#3A3FE0';
  const factor = 0.75;
  const r = Math.floor(rgb.r * factor).toString(16).padStart(2, '0');
  const g = Math.floor(rgb.g * factor).toString(16).padStart(2, '0');
  const b = Math.floor(rgb.b * factor).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('toque_theme') as ThemeMode) || 'light';
  });

  const [density, setDensityState] = useState<DensityMode>(() => {
    return (localStorage.getItem('toque_density') as DensityMode) || 'comfortable';
  });

  const [brandColor, setBrandColorState] = useState<string>('#3A3FE0');

  // Resolver sistema
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (theme === 'system') return systemIsDark ? 'dark' : 'light';
    return theme;
  }, [theme, systemIsDark]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-density', density);
  }, [resolvedTheme, density]);

  // Aplicar variables de marca en el root CSS
  useEffect(() => {
    const rgb = hexToRgb(brandColor);
    if (rgb) {
      document.documentElement.style.setProperty('--brand', brandColor);
      document.documentElement.style.setProperty('--brand-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
  }, [brandColor]);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem('toque_theme', t);
  };

  const setDensity = (d: DensityMode) => {
    setDensityState(d);
    localStorage.setItem('toque_density', d);
  };

  const setBrandColor = (c: string) => {
    setBrandColorState(c);
  };

  const contrastInfo = useMemo<ContrastInfo>(() => {
    const ratio = calculateContrastRatio(brandColor, '#FFFFFF');
    const passesAA = ratio >= 4.5;
    return {
      ratio: Math.round(ratio * 10) / 10,
      passesAA,
      recommendedColor: passesAA ? undefined : getDarkerVariant(brandColor),
    };
  }, [brandColor]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        density,
        setDensity,
        brandColor,
        setBrandColor,
        contrastInfo,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  return context;
};
