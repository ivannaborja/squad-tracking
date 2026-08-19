import { describe, it, expect } from 'vitest';
import { ingresosActivo, semaforo } from './semaforo';
import type { Risk } from './types';

const FECHA = '2026-08-14';

// Riesgo de ingresos abierto que abarca la fecha de referencia.
const riesgoIngresosActivo: Risk = {
  categoriaImpacto: 'ingresos',
  resuelto: false,
  semanaInicio: '2026-08-10',
  semanaFin: '2026-08-16',
};

describe('semaforo', () => {
  it('Adquirencia +6pp con riesgo de ingresos activo → rojo', () => {
    expect(semaforo(0.06, [riesgoIngresosActivo], FECHA)).toBe('rojo');
  });

  it('Lealtad −11pp sin riesgos → amarillo', () => {
    expect(semaforo(-0.11, [], FECHA)).toBe('amarillo');
  });

  it('delta exacto en 0 → verde', () => {
    expect(semaforo(0, [], FECHA)).toBe('verde');
  });

  it('riesgo de ingresos ya resuelto no cuenta', () => {
    const resuelto: Risk = { ...riesgoIngresosActivo, resuelto: true };
    expect(semaforo(0.06, [resuelto], FECHA)).toBe('verde');
  });

  it('riesgo de ingresos fuera de la ventana de fechas no cuenta', () => {
    const fuera: Risk = {
      ...riesgoIngresosActivo,
      semanaInicio: '2026-08-17',
      semanaFin: '2026-08-23',
    };
    expect(semaforo(0.06, [fuera], FECHA)).toBe('verde');
  });

  it('precedencia: Delivery muy negativo + riesgo de ingresos → rojo, no amarillo', () => {
    expect(semaforo(-0.4, [riesgoIngresosActivo], FECHA)).toBe('rojo');
  });
});
