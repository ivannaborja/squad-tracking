import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { SmartsheetDataSource, type SquadRef, type MetricasSquad } from './SmartsheetDataSource';
import type { Period } from '../../ports/DataSource';

// Fixture en memoria (mismo patrón que el contract test) enfocado en las 4
// métricas del Q: Q entero, Priorizado-Finalizar, Priorizado-Avanzar y Discovery.
// Cubre el squad normal, el caso Empresas (Q colgado directo de la raíz, sin
// Delivery/Discovery/Avanzar), un squad sin Avanzar y uno con naming sucio.
interface Fila {
  nombre?: string;
  fechaInicio?: string;
  fechaFin?: string;
  completo?: number | null;
  id?: string;
  padre?: string;
}

const FILAS: Fila[] = [
  { nombre: 'Nombre', id: 'Identificador de la fila', padre: 'Padre' }, // header

  // Alfa: split normal completo. Cada nodo con su propio % y fechas distintas
  // para verificar que cada métrica sale de SU nodo (no del padre ni de un hermano).
  { nombre: 'Alfa', completo: 0.77, id: 'AL' },
  { nombre: 'Delivery', completo: 0.8, id: 'AL_D', padre: 'AL' },
  { nombre: 'Q3', completo: 0.6, fechaInicio: '2026-07-01', fechaFin: '2026-09-30', id: 'AL_Q', padre: 'AL_D' },
  { nombre: 'Priorizado directorio - Finalizar', completo: 0.5, fechaInicio: '2026-07-05', fechaFin: '2026-09-20', id: 'AL_F', padre: 'AL_Q' },
  { nombre: 'Priorizado directorio - Avanzar', completo: 0.3, fechaInicio: '2026-07-10', fechaFin: '2026-09-25', id: 'AL_A', padre: 'AL_Q' },
  { nombre: 'No planificado', completo: 0.1, id: 'AL_N', padre: 'AL_Q' },
  { nombre: 'Discovery', completo: 0.9, fechaInicio: '2026-07-02', fechaFin: '2026-08-15', id: 'AL_V', padre: 'AL' },

  // Empresas: Q3 cuelga directo de la raíz (sin nodo Delivery). Su único hijo
  // priorizado es "Priorizado por el directorio" (no dice "finalizar") → hace de
  // finalizar. Sin Discovery ni Avanzar.
  { nombre: 'Empresas', completo: 0.4, id: 'EM' },
  { nombre: 'Q3', completo: 0.55, fechaInicio: '2026-07-01', fechaFin: '2026-09-30', id: 'EM_Q', padre: 'EM' },
  { nombre: 'Priorizado por el directorio', completo: 0.45, fechaInicio: '2026-07-03', fechaFin: '2026-09-28', id: 'EM_P', padre: 'EM_Q' },

  // Charlie: Delivery → Q3 → Finalizar + No planificado, pero SIN Avanzar y sin
  // Discovery → avanzar y discovery deben quedar null.
  { nombre: 'Charlie', completo: 0.5, id: 'CH' },
  { nombre: 'Delivery', completo: 0.5, id: 'CH_D', padre: 'CH' },
  { nombre: 'Q3', completo: 0.5, fechaInicio: '2026-07-01', fechaFin: '2026-09-30', id: 'CH_Q', padre: 'CH_D' },
  { nombre: 'Priorizado directorio - Finalizar', completo: 0.4, fechaInicio: '2026-07-06', fechaFin: '2026-09-22', id: 'CH_F', padre: 'CH_Q' },
  { nombre: 'No planificado', completo: 0.2, id: 'CH_N', padre: 'CH_Q' },

  // Zeta: mismos nodos que Alfa pero con naming sucio (mayúsculas, acentos, doble
  // espacio) para ejercer el match tolerante vía normalizar.
  { nombre: 'Zeta', completo: 0.6, id: 'ZE' },
  { nombre: '  DELÍVERY  ZETA ', completo: 0.7, id: 'ZE_D', padre: 'ZE' },
  { nombre: 'q3', completo: 0.65, fechaInicio: '2026-07-01', fechaFin: '2026-09-30', id: 'ZE_Q', padre: 'ZE_D' },
  { nombre: '  PRIORIZADO Directório -  FINALIZÁR ', completo: 0.55, fechaInicio: '2026-07-07', fechaFin: '2026-09-21', id: 'ZE_F', padre: 'ZE_Q' },
  { nombre: 'Priorizado dir -  Avanzár', completo: 0.25, fechaInicio: '2026-07-11', fechaFin: '2026-09-26', id: 'ZE_A', padre: 'ZE_Q' },
];

const REFS: SquadRef[] = [
  { id: 1, nombre: 'Alfa' },
  { id: 2, nombre: 'Empresas' },
  { id: 3, nombre: 'Charlie' },
  { id: 4, nombre: 'Zeta' },
];

const PERIOD: Period = {
  fechaReferencia: '2026-08-14',
  semanaInicio: '2026-08-11',
  trimestre: { nombre: 'Q3-2026', inicio: '2026-07-01', fin: '2026-09-30' },
  editadoPor: 'Equipo de Agile Coach',
};

const COL = { nombre: 5, fechaInicio: 8, fechaFin: 9, completo: 13, filaId: 22, padre: 24 };

async function fixtureBuffer(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Etica - 2026');
  FILAS.forEach((f, i) => {
    const row = ws.getRow(i + 1);
    if (f.nombre !== undefined) row.getCell(COL.nombre).value = f.nombre;
    if (f.fechaInicio !== undefined) row.getCell(COL.fechaInicio).value = f.fechaInicio;
    if (f.fechaFin !== undefined) row.getCell(COL.fechaFin).value = f.fechaFin;
    if (f.completo !== undefined && f.completo !== null) row.getCell(COL.completo).value = f.completo;
    if (f.id !== undefined) row.getCell(COL.filaId).value = f.id;
    if (f.padre !== undefined) row.getCell(COL.padre).value = f.padre;
  });
  return (await wb.xlsx.writeBuffer()) as unknown as Uint8Array;
}

describe('SmartsheetDataSource — fetchMetricas (4 métricas del Q)', () => {
  let metricas: MetricasSquad[];
  const de = (squadId: number) => metricas.find((m) => m.squadId === squadId)!;

  beforeAll(async () => {
    const source = await SmartsheetDataSource.fromArrayBuffer(await fixtureBuffer(), REFS);
    metricas = source.fetchMetricas(PERIOD);
  });

  it('devuelve una MetricasSquad por squad matcheado', () => {
    expect(metricas.map((m) => m.squadId).sort()).toEqual([1, 2, 3, 4]);
  });

  it('squad normal: extrae las 4 métricas cada una con su real + inicio + fin', () => {
    const m = de(1);
    expect(m.q3Total).toEqual({ real: 0.6, inicio: '2026-07-01', fin: '2026-09-30' });
    expect(m.finalizar).toEqual({ real: 0.5, inicio: '2026-07-05', fin: '2026-09-20' });
    expect(m.avanzar).toEqual({ real: 0.3, inicio: '2026-07-10', fin: '2026-09-25' });
    expect(m.discovery).toEqual({ real: 0.9, inicio: '2026-07-02', fin: '2026-08-15' });
  });

  it('caso Empresas: Q directo a la raíz, finalizar sale del "Priorizado por el directorio", avanzar y discovery null', () => {
    const m = de(2);
    expect(m.q3Total).toEqual({ real: 0.55, inicio: '2026-07-01', fin: '2026-09-30' });
    expect(m.finalizar).toEqual({ real: 0.45, inicio: '2026-07-03', fin: '2026-09-28' });
    expect(m.avanzar).toBeNull();
    expect(m.discovery).toBeNull();
  });

  it('squad sin Avanzar: avanzar null; finalizar y q3Total presentes; discovery null', () => {
    const m = de(3);
    expect(m.q3Total.real).toBeCloseTo(0.5, 5);
    expect(m.finalizar).toEqual({ real: 0.4, inicio: '2026-07-06', fin: '2026-09-22' });
    expect(m.avanzar).toBeNull();
    expect(m.discovery).toBeNull();
  });

  it('naming sucio (mayúsculas/acentos/doble espacio): el match tolerante igual ubica los nodos', () => {
    const m = de(4);
    expect(m.q3Total).toEqual({ real: 0.65, inicio: '2026-07-01', fin: '2026-09-30' });
    expect(m.finalizar).toEqual({ real: 0.55, inicio: '2026-07-07', fin: '2026-09-21' });
    expect(m.avanzar).toEqual({ real: 0.25, inicio: '2026-07-11', fin: '2026-09-26' });
    expect(m.discovery).toBeNull();
  });
});
