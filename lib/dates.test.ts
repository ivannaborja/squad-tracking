import { describe, it, expect } from 'vitest';
import { inicioDeSemana } from './dates';

describe('inicioDeSemana', () => {
  it('un viernes cae en el lunes de esa semana', () => {
    expect(inicioDeSemana('2026-08-14')).toBe('2026-08-10');
  });

  it('el propio lunes se queda igual', () => {
    expect(inicioDeSemana('2026-08-10')).toBe('2026-08-10');
  });

  it('el domingo cae en el lunes anterior, no en el siguiente', () => {
    expect(inicioDeSemana('2026-08-16')).toBe('2026-08-10');
  });
});
