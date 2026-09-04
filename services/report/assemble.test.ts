import { describe, it, expect } from 'vitest';
import {
  assembleCompact,
  assembleSquadReportView,
  avisoRojoSinNeed,
  calcAHoy,
  kpiNoPlanificadas,
  recomputeSemaforo,
} from './assemble';
import { resolverTrimestre, trimestreDeFecha } from './quarters';
import type { Collections, NeedItem, PersistedSnapshot } from './types';

const Q3 = resolverTrimestre('Q3-2026');

const vacias: Collections = {
  bloqueos: [],
  needs: [],
  achievements: [],
  upcomingDeliveries: [],
  initiatives: [],
  unplannedIntake: [],
};

const snapshotBase: PersistedSnapshot = {
  semaforo: 'verde',
  deliveryRealPct: 0.56,
  discoveryRealPct: 0.4,
  esperadoPct: 0.5,
  deliveryDeltaPct: 0.06,
  discoveryDeltaPct: -0.1,
  trimestre: 'Q3-2026',
  semanaInicio: '2026-08-11',
  fechaReferencia: '2026-08-14',
  frasePronostico: 'en fecha',
  editadoPor: 'Equipo de Agile Coach',
};

describe('quarters', () => {
  it('deriva las fechas del Q desde el label', () => {
    expect(Q3).toEqual({ inicio: '2026-07-01', fin: '2026-09-30' });
  });

  it('deriva el label del Q desde una fecha', () => {
    expect(trimestreDeFecha('2026-08-14')).toBe('Q3-2026');
  });
});

describe('calcAHoy', () => {
  it('con reales, esperado ~0.5 y brechas contra ese esperado', () => {
    const a = calcAHoy(0.56, 0.39, '2026-08-14', Q3);
    expect(a.esperadoPct).toBeCloseTo(0.5, 1);
    expect(a.deliveryDeltaPct).toBeCloseTo(0.56 - a.esperadoPct, 5);
    expect(a.discoveryDeltaPct).toBeCloseTo(0.39 - a.esperadoPct, 5);
  });

  it('sin reales, esperado presente pero brechas null', () => {
    const a = calcAHoy(null, null, '2026-08-14', Q3);
    expect(a.esperadoPct).toBeGreaterThan(0);
    expect(a.deliveryDeltaPct).toBeNull();
    expect(a.discoveryDeltaPct).toBeNull();
  });
});

describe('avisoRojoSinNeed', () => {
  const needActivo: NeedItem = {
    id: 1,
    descripcion: 'ayuda',
    dueno: 'x',
    semanaInicio: '2026-08-11',
    resuelto: false,
  };

  it('rojo sin need activo esa semana → avisa', () => {
    expect(avisoRojoSinNeed('rojo', [], '2026-08-11')).toBe(true);
  });
  it('rojo con need activo esa semana → no avisa', () => {
    expect(avisoRojoSinNeed('rojo', [needActivo], '2026-08-11')).toBe(false);
  });
  it('need resuelto no cuenta', () => {
    expect(avisoRojoSinNeed('rojo', [{ ...needActivo, resuelto: true }], '2026-08-11')).toBe(true);
  });
  it('need de otra semana no cuenta', () => {
    expect(avisoRojoSinNeed('rojo', [{ ...needActivo, semanaInicio: '2026-08-04' }], '2026-08-11')).toBe(true);
  });
  it('si no está en rojo, nunca avisa', () => {
    expect(avisoRojoSinNeed('amarillo', [], '2026-08-11')).toBe(false);
  });
});

describe('recomputeSemaforo (write-through)', () => {
  it('delta negativo → amarillo', () => {
    expect(recomputeSemaforo(-0.11)).toBe('amarillo');
  });
  it('delta no negativo → verde', () => {
    expect(recomputeSemaforo(0.06)).toBe('verde');
  });
});

describe('kpiNoPlanificadas', () => {
  it('cuenta los intakes no planificados', () => {
    expect(
      kpiNoPlanificadas([
        { id: 1, descripcion: 'a', semanaInicio: '2026-08-11' },
        { id: 2, descripcion: 'b', semanaInicio: '2026-08-11' },
      ])
    ).toBe(2);
  });
});

describe('assembleSquadReportView', () => {
  it('con snapshot arma la vista completa con datos_de', () => {
    const v = assembleSquadReportView({
      squadId: 5,
      squadNombre: 'Adquirencia',
      snapshot: snapshotBase,
      date: '2026-08-14',
      trimestre: Q3,
      collections: vacias,
      unplannedTrimestre: [],
    });
    expect(v.snapshot.semaforo).toBe('verde');
    expect(v.datosDe).toBe('2026-08-14');
    expect(v.aHoy.esperadoPct).toBeCloseTo(0.5, 1);
  });

  it('sin snapshot devuelve nulls pero igual el bloque a_hoy', () => {
    const v = assembleSquadReportView({
      squadId: 5,
      squadNombre: 'Adquirencia',
      snapshot: null,
      date: '2026-08-14',
      trimestre: Q3,
      collections: vacias,
      unplannedTrimestre: [],
    });
    expect(v.snapshot.semaforo).toBeNull();
    expect(v.datosDe).toBeNull();
    expect(v.aHoy.esperadoPct).toBeGreaterThan(0);
    expect(v.avisoRojoSinNeed).toBe(false);
  });

  it('el KPI no planificadas cuenta el trimestre, no la semana', () => {
    // La sección muestra la semana (1 intake); el KPI acumula el Q (3 intakes).
    const semanal = {
      ...vacias,
      unplannedIntake: [{ id: 1, descripcion: 'de la semana', semanaInicio: '2026-08-11' }],
    };
    const trimestral = [
      { id: 2, descripcion: 'a', semanaInicio: '2026-07-07' },
      { id: 3, descripcion: 'b', semanaInicio: '2026-07-28' },
      { id: 4, descripcion: 'c', semanaInicio: '2026-08-11' },
    ];
    const v = assembleSquadReportView({
      squadId: 5,
      squadNombre: 'Adquirencia',
      snapshot: snapshotBase,
      date: '2026-08-14',
      trimestre: Q3,
      collections: semanal,
      unplannedTrimestre: trimestral,
    });
    expect(v.kpiNoPlanificadas).toBe(3);
    expect(v.collections.unplannedIntake).toHaveLength(1);
  });
});

describe('assembleCompact', () => {
  it('proyección resumida con color persistido y a_hoy', () => {
    const c = assembleCompact({
      squadId: 5,
      squadNombre: 'Adquirencia',
      snapshot: snapshotBase,
      date: '2026-08-14',
      trimestre: Q3,
    });
    expect(c.semaforo).toBe('verde');
    expect(c.deliveryDeltaPct).toBe(0.06);
    expect(c.aHoy.esperadoPct).toBeCloseTo(0.5, 1);
  });
});
