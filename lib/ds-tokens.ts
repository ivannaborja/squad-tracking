import type { Semaforo } from '../domain/types';

// La paleta del Design System (derivada de la app móvil). Un solo tema claro.
export const C = {
  navy900: '#0A2F5C',
  navy700: '#0E4A8C',
  navy500: '#1565C0',
  navy100: '#CFE0FA',
  navy050: '#EAF2FE',
  blueDot: '#0E4A8C',
  verde: '#1E8E4F',
  verdeFg: '#14663A',
  verdeBg: '#E4F4EA',
  amarillo: '#FFC20E',
  amarilloFg: '#8A6100',
  amarilloBg: '#FFF4D6',
  rojo: '#CE0E2D',
  rojoFg: '#A50B24',
  rojoBg: '#FCE4E8',
  white: '#FFFFFF',
  gray050: '#FAFBFC',
  gray100: '#F5F6F7',
  gray200: '#E6E8EB',
  gray300: '#C6CBD1',
  gray400: '#9AA1A9',
  gray600: '#5A6169',
  gray900: '#22262A',
} as const;

export const FONT = {
  head: 'var(--font-poppins), Poppins, sans-serif',
  body: 'var(--font-roboto), Roboto, sans-serif',
  mono: 'var(--font-mono), "Roboto Mono", monospace',
} as const;

// El semáforo del squad como badge tint: color + punto + texto. El color nunca
// va solo (regla de accesibilidad / impresión en B/N del DS).
export function semaforoTheme(s: Semaforo): { bg: string; fg: string; dot: string; label: string } {
  if (s === 'verde') return { bg: C.verdeBg, fg: C.verdeFg, dot: C.verde, label: 'Verde' };
  if (s === 'amarillo') return { bg: C.amarilloBg, fg: C.amarilloFg, dot: C.amarillo, label: 'Amarillo' };
  return { bg: C.rojoBg, fg: C.rojoFg, dot: C.rojo, label: 'Rojo' };
}

// Brecha en puntos porcentuales, con signo. Fracción 0–1 → pp (la UI formatea,
// el dominio trabaja en fracción).
export function fmtPp(fraccion: number | null): string {
  if (fraccion === null) return '—';
  const pp = Math.round(fraccion * 100);
  const signo = pp > 0 ? '+' : pp < 0 ? '−' : '';
  return `${signo}${Math.abs(pp)} pp`;
}

export function fmtPct(fraccion: number | null): string {
  if (fraccion === null) return '—';
  return `${Math.round(fraccion * 100)}%`;
}

// Color del texto de una brecha: verde si adelanta, rojo si atrasa, gris en 0.
export function deltaColor(fraccion: number | null): string {
  if (fraccion === null || fraccion === 0) return C.gray600;
  return fraccion > 0 ? C.verdeFg : C.rojoFg;
}
