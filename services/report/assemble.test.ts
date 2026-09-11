import { describe, it, expect } from 'vitest';
import {
  assembleCompact,
  assembleSquadReportView,
  avisoRojoSinNeed,
  derivar,
  kpiNoPlanificadas,
} from './assemble';
import { resolverTrimestre, trimestreDeFecha } from './quarters';
import type { Collections, NeedItem, PersistedSnapshot } from './types';

const Q3 = resolverTrimestre('Q3-2026');

// Esperado de referencia: del 1/7 al 14/8 hay 44 días; el tramo 1/7→30/9 son 91.
const ESP = 44 / 91;

const vacias: Collections = {
  bloqueos: [],
  needs: [],
  achievements: [],
  upcomingDeliveries: [],
  initiatives: [],
  unplannedIntake: [],
};

const snapshotBase: PersistedSnapshot = {
  q3Total: { real: 0.6, inicio: '2026-07-01', fin: '2026-09-30' },
  finalizar: { real: 0.56, inicio: '2026-07-01', fin: '2026-09-30' },
  avanzar: { real: 0.3, inicio: '2026-07-01', fin: '2026-09-30' },
  discovery: { real: 0.4, inicio: '2026-07-01', fin: '2026-09-30' },
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

describe('derivar', () => {
  it('delivery = Finalizar, esperado por fechas del nodo, color del desvío', () => {
    const d = derivar(snapshotBase, '2026-08-14');
    expect(d.deliveryRealPct).toBe(0.56);
    expect(d.discoveryRealPct).toBe(0.4);
    expect(d.esperadoPct).toBeCloseTo(ESP, 4);
    expect(d.deliveryDeltaPct).toBeCloseTo(0.56 - ESP, 5);
    expect(d.discoveryDeltaPct).toBeCloseTo(0.4 - ESP, 5);
    expect(d.semaforo).toBe('verde'); // 0.56 ≥ esperado
  });

  it('sin fechas de Finalizar: esperado/desvío/color null, pero el real se conserva', () => {
    const d = derivar({ ...snapshotBase, finalizar: { real: 0.56, inicio: null, fin: null } }, '2026-08-14');
    expect(d.deliveryRealPct).toBe(0.56);
    expect(d.esperadoPct).toBeNull();
    expect(d.deliveryDeltaPct).toBeNull();
    expect(d.semaforo).toBeNull();
  });

  it('sin discovery (null): real y desvío de discovery null', () => {
    const d = derivar({ ...snapshotBase, discovery: null }, '2026-08-14');
    expect(d.discoveryRealPct).toBeNull();
    expect(d.discoveryDeltaPct).toBeNull();
  });

  it('amarillo cuando delivery quedó por debajo del esperado', () => {
    const d = derivar({ ...snapshotBase, finalizar: { real: 0.1, inicio: '2026-07-01', fin: '2026-09-30' } }, '2026-08-14');
    expect(d.semaforo).toBe('amarillo');
  });
});

describe('avisoRojoSinNeed', () => {
  const needActivo: NeedItem = {
    id: 1,
    descripcion: 'ayuda',
    dueno: 'x',
    fecha: '2026-08-11',
    estado: 'ABIERTA',
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
      collections: vacias,
      unplannedTrimestre: [],
    });
    expect(v.snapshot.semaforo).toBe('verde');
    expect(v.datosDe).toBe('2026-08-14');
    expect(v.aHoy.esperadoPct).toBeCloseTo(ESP, 4);
  });

  it('sin snapshot devuelve nulls y el bloque a_hoy vacío', () => {
    const v = assembleSquadReportView({
      squadId: 5,
      squadNombre: 'Adquirencia',
      snapshot: null,
      date: '2026-08-14',
      collections: vacias,
      unplannedTrimestre: [],
    });
    expect(v.snapshot.semaforo).toBeNull();
    expect(v.datosDe).toBeNull();
    expect(v.aHoy.esperadoPct).toBeNull();
    expect(v.avisoRojoSinNeed).toBe(false);
  });

  it('el KPI no planificadas cuenta el trimestre, no la semana', () => {
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
      collections: semanal,
      unplannedTrimestre: trimestral,
    });
    expect(v.kpiNoPlanificadas).toBe(3);
    expect(v.collections.unplannedIntake).toHaveLength(1);
  });
});

describe('assembleCompact', () => {
  it('proyección resumida con color derivado y a_hoy', () => {
    const c = assembleCompact({
      squadId: 5,
      squadNombre: 'Adquirencia',
      snapshot: snapshotBase,
      date: '2026-08-14',
    });
    expect(c.semaforo).toBe('verde');
    expect(c.deliveryDeltaPct).toBeCloseTo(0.56 - ESP, 5);
    expect(c.aHoy.esperadoPct).toBeCloseTo(ESP, 4);
  });
});
