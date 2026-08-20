import { describe, it, expect } from 'vitest';
import { detectarConflictos } from './conflicts';

const entrante = { squadId: 3, deliveryRealPct: 0.41, discoveryRealPct: 0.38 };

describe('detectarConflictos', () => {
  it('sin fila previa no hay conflicto', () => {
    expect(detectarConflictos(entrante, null)).toEqual([]);
  });

  it('override activo y valor distinto → conflicto de ese campo', () => {
    const c = detectarConflictos(entrante, {
      deliveryRealPct: 0.56,
      deliveryManualOverride: true,
      discoveryRealPct: 0.38,
      discoveryManualOverride: false,
    });
    expect(c).toEqual([
      { squad_id: 3, field: 'delivery_real_pct', current_manual_value: 0.56, incoming_value: 0.41 },
    ]);
  });

  it('override activo pero mismo valor → no hay conflicto', () => {
    const c = detectarConflictos(
      { ...entrante, deliveryRealPct: 0.56 },
      { deliveryRealPct: 0.56, deliveryManualOverride: true, discoveryRealPct: 0.38, discoveryManualOverride: false }
    );
    expect(c).toEqual([]);
  });

  it('sin override, un valor distinto se escribe directo (no choca)', () => {
    const c = detectarConflictos(entrante, {
      deliveryRealPct: 0.9,
      deliveryManualOverride: false,
      discoveryRealPct: 0.9,
      discoveryManualOverride: false,
    });
    expect(c).toEqual([]);
  });
});
