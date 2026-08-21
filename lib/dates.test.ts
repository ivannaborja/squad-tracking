import { describe, it, expect, vi, afterEach } from 'vitest';
import { inicioDeSemana, hoyISO } from './dates';

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

describe('hoyISO', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('un check-in de noche en Asunción se fecha al día local, no al de UTC', () => {
    // 02:30 UTC del 21 = 23:30 del 20 en Asunción. toISOString() daría el 21.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T02:30:00Z'));
    expect(hoyISO()).toBe('2026-08-20');
  });
});
