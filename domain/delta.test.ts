import { describe, it, expect } from 'vitest';
import { delta } from './delta';

describe('delta', () => {
  it('Adquirencia adelantada: real por encima de lo esperado', () => {
    expect(delta(0.56, 0.5)).toBeCloseTo(0.06, 5);
  });

  it('Lealtad atrasada: real por debajo de lo esperado', () => {
    expect(delta(0.39, 0.5)).toBeCloseTo(-0.11, 5);
  });

  it('exactamente a tiempo da 0', () => {
    expect(delta(0.5, 0.5)).toBe(0);
  });
});
