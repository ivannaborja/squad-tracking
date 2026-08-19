import { describe, it, expect } from 'vitest';
import { esperadoPct } from './esperadoPct';

describe('esperadoPct', () => {
  it('da 50% el 14-08 con el Q3 (33 de 66 días hábiles)', () => {
    const resultado = esperadoPct('2026-08-14', { inicio: '2026-07-01', fin: '2026-09-30' });
    expect(resultado).toBeCloseTo(0.5, 1);
  });

  it('da 0 antes del inicio del trimestre', () => {
    expect(esperadoPct('2026-06-01', { inicio: '2026-07-01', fin: '2026-09-30' })).toBe(0);
  });

  it('da 1 en o después del cierre', () => {
    expect(esperadoPct('2026-10-05', { inicio: '2026-07-01', fin: '2026-09-30' })).toBe(1);
  });
});