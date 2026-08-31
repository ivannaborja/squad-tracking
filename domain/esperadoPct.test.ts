import { describe, it, expect } from 'vitest';
import { esperadoPct } from './esperadoPct';

const Q3 = { inicio: '2026-07-01', fin: '2026-09-30' };

describe('esperadoPct', () => {
  it('da 64% el 28-08 con el Q3 (59 de 92 días calendario)', () => {
    // El número exacto de la planilla de Dai: "del 1 de julio al 28 de agosto = 59 días = 64%".
    expect(esperadoPct('2026-08-28', Q3)).toBeCloseTo(59 / 92, 5);
  });

  it('el primer día del Q ya cuenta como 1 de 92 (inclusivo, no 0)', () => {
    expect(esperadoPct('2026-07-01', Q3)).toBeCloseTo(1 / 92, 5);
  });

  it('da 0 antes del inicio del trimestre', () => {
    expect(esperadoPct('2026-06-01', Q3)).toBe(0);
  });

  it('da 1 en el último día y saturado después', () => {
    expect(esperadoPct('2026-09-30', Q3)).toBe(1);
    expect(esperadoPct('2026-10-05', Q3)).toBe(1);
  });
});
