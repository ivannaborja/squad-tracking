import { describe, it, expect } from 'vitest';
import { esperadoDesdeFechas } from './esperadoFechas';

const INICIO = '2026-07-01';
const FIN = '2026-10-14';

describe('esperadoDesdeFechas', () => {
  it('da 0 antes del inicio', () => {
    expect(esperadoDesdeFechas('2026-06-30', INICIO, FIN)).toBe(0);
  });

  it('da 0 el día de inicio (resta no inclusiva)', () => {
    expect(esperadoDesdeFechas('2026-07-01', INICIO, FIN)).toBe(0);
  });

  it('da la fracción de días transcurridos a mitad del tramo (68 de 105)', () => {
    expect(esperadoDesdeFechas('2026-09-07', INICIO, FIN)).toBeCloseTo(0.6476, 3);
  });

  it('da 1 el día de fin', () => {
    expect(esperadoDesdeFechas('2026-10-14', INICIO, FIN)).toBe(1);
  });

  it('satura en 1 después del fin', () => {
    expect(esperadoDesdeFechas('2026-11-01', INICIO, FIN)).toBe(1);
  });

  it('da null si fin <= inicio', () => {
    expect(esperadoDesdeFechas('2026-08-01', '2026-07-01', '2026-07-01')).toBeNull();
  });

  it('da null si falta inicio o fin', () => {
    expect(esperadoDesdeFechas('2026-08-01', null, FIN)).toBeNull();
    expect(esperadoDesdeFechas('2026-08-01', INICIO, null)).toBeNull();
  });
});
