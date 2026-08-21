import { describe, it, expect } from 'vitest';
import { resolverCampo, decisionesAplicadas } from './importService';
import { claveDecision, type Conflicto } from './conflicts';

// Simula lo que hace aplicar(): corre resolverCampo por cada conflicto y arma el
// mapa clave→override que confirmarImport le pasa a decisionesAplicadas.
function resoluciones(
  campos: { squadId: number; field: 'delivery_real_pct' | 'discovery_real_pct'; entrante: number; manual: number }[],
  decisiones: Map<string, boolean>
): Map<string, boolean> {
  const mapa = new Map<string, boolean>();
  for (const c of campos) {
    const r = resolverCampo(c.field, c.squadId, c.entrante, c.manual, true, decisiones);
    if (r.enConflicto) mapa.set(claveDecision(c.squadId, c.field), r.override);
  }
  return mapa;
}

describe('resolverCampo', () => {
  it('conflicto aceptado escribe el entrante y libera el override', () => {
    const decisiones = new Map([[claveDecision(3, 'delivery_real_pct'), true]]);
    const r = resolverCampo('delivery_real_pct', 3, 0.41, 0.56, true, decisiones);
    expect(r).toEqual({ valor: 0.41, override: false, enConflicto: true });
  });

  it('conflicto rechazado conserva el manual y mantiene el override', () => {
    const decisiones = new Map([[claveDecision(3, 'delivery_real_pct'), false]]);
    const r = resolverCampo('delivery_real_pct', 3, 0.41, 0.56, true, decisiones);
    expect(r).toEqual({ valor: 0.56, override: true, enConflicto: true });
  });

  it('conflicto omitido (sin decisión) se trata como rechazo', () => {
    const r = resolverCampo('delivery_real_pct', 3, 0.41, 0.56, true, new Map());
    expect(r).toEqual({ valor: 0.56, override: true, enConflicto: true });
  });

  it('override activo pero el CSV coincide: escribe igual pero NO libera el override', () => {
    // No hay conflicto (los valores coinciden), pero soltar el override dejaría un
    // import futuro pisando lo manual sin confirmación.
    const r = resolverCampo('delivery_real_pct', 3, 0.56, 0.56, true, new Map());
    expect(r).toEqual({ valor: 0.56, override: true, enConflicto: false });
  });

  it('sin override previo se escribe el entrante con override en false', () => {
    const r = resolverCampo('delivery_real_pct', 3, 0.9, 0.5, false, new Map());
    expect(r).toEqual({ valor: 0.9, override: false, enConflicto: false });
  });
});

describe('decisionesAplicadas', () => {
  const conflicts: Conflicto[] = [
    { squad_id: 3, field: 'delivery_real_pct', current_manual_value: 0.56, incoming_value: 0.41 },
    { squad_id: 3, field: 'discovery_real_pct', current_manual_value: 0.38, incoming_value: 0.5 },
  ];

  it('reporta applied=true para el aceptado y applied=false para el rechazado', () => {
    const decisiones = new Map([
      [claveDecision(3, 'delivery_real_pct'), true],
      [claveDecision(3, 'discovery_real_pct'), false],
    ]);
    const mapa = resoluciones(
      [
        { squadId: 3, field: 'delivery_real_pct', entrante: 0.41, manual: 0.56 },
        { squadId: 3, field: 'discovery_real_pct', entrante: 0.5, manual: 0.38 },
      ],
      decisiones
    );

    expect(decisionesAplicadas(conflicts, mapa)).toEqual([
      { squad_id: 3, field: 'delivery_real_pct', applied: true },
      { squad_id: 3, field: 'discovery_real_pct', applied: false },
    ]);
  });

  it('un conflicto omitido cuenta como rechazo (applied=false)', () => {
    // Sólo se decide delivery; discovery queda sin decisión.
    const decisiones = new Map([[claveDecision(3, 'delivery_real_pct'), true]]);
    const mapa = resoluciones(
      [
        { squadId: 3, field: 'delivery_real_pct', entrante: 0.41, manual: 0.56 },
        { squadId: 3, field: 'discovery_real_pct', entrante: 0.5, manual: 0.38 },
      ],
      decisiones
    );

    expect(decisionesAplicadas(conflicts, mapa)).toEqual([
      { squad_id: 3, field: 'delivery_real_pct', applied: true },
      { squad_id: 3, field: 'discovery_real_pct', applied: false },
    ]);
  });
});
