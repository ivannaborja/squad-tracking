import { describe, it, expect } from 'vitest';
import { fmtPct, fmtPp, deltaColor, C } from './ds-tokens';

describe('formato de la UI', () => {
  it('fmtPp pone signo y unidad, y − real para negativos', () => {
    expect(fmtPp(0.06)).toBe('+6 pp');
    expect(fmtPp(-0.11)).toBe('−11 pp');
    expect(fmtPp(0)).toBe('0 pp');
    expect(fmtPp(null)).toBe('—');
  });

  it('fmtPct redondea la fracción a %', () => {
    expect(fmtPct(0.5)).toBe('50%');
    expect(fmtPct(null)).toBe('—');
  });

  it('deltaColor: verde adelanta, rojo atrasa, gris en 0/null', () => {
    expect(deltaColor(0.06)).toBe(C.verdeFg);
    expect(deltaColor(-0.11)).toBe(C.rojoFg);
    expect(deltaColor(0)).toBe(C.gray600);
    expect(deltaColor(null)).toBe(C.gray600);
  });
});
