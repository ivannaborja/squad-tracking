import { describe, it, expect } from 'vitest';
import { semaforo } from './semaforo';

describe('semaforo', () => {
  it('delta negativo → amarillo', () => {
    expect(semaforo(-0.11)).toBe('amarillo');
  });

  it('delta exacto en 0 → verde (llegó al esperado)', () => {
    expect(semaforo(0)).toBe('verde');
  });

  it('delta positivo → verde', () => {
    expect(semaforo(0.06)).toBe('verde');
  });
});
