import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { SmartsheetDataSource, normalizar, type SquadRef } from './SmartsheetDataSource';
import type { Period } from '../../ports/DataSource';
import type { SquadSnapshot } from '../../domain/types';

// Fixture ANONIMIZADO generado en memoria: reproduce la forma del export real de
// Smartsheet (árbol por Padre/Id, nodos Delivery/Discovery, caso solo-delivery,
// filas con código, el molde "Plantilla squads", iniciativas de portafolio a
// distinta profundidad) sin ningún dato interno real. Columnas 1-based
// confirmadas contra el archivo real: A=codigo, C=portafolio, E=nombre,
// H=fecha inicio, I=fecha fin, L=etapa, M=%completo, R=fecha fin real,
// T=estado, V=id fila, X=padre.
interface Fila {
  codigo?: string;
  portafolio?: boolean;
  nombre?: string;
  fechaInicio?: string;
  fechaFin?: string;
  etapa?: string;
  completo?: number | null;
  fechaFinReal?: string;
  estado?: string;
  id?: string;
  padre?: string;
}
const FILAS: Fila[] = [
  { codigo: 'Codigo Etica', nombre: 'Nombre', id: 'Identificador de la fila', padre: 'Padre' }, // header
  // Molde: se ignora entero. Incluso una fila de portafolio bajo el molde se
  // omite (su raíz no matchea ningún squad del sistema).
  { nombre: 'Plantilla squads', id: 'T1' },
  { nombre: 'Delivery', id: 'T2', padre: 'T1' },
  { codigo: 'TPL001', nombre: 'Molde con código', completo: 1, portafolio: true, etapa: 'Despliegue', estado: 'Completo', id: 'T2a', padre: 'T2' },
  // Alfa: split normal, pero con naming sucio (doble espacio, minúsculas, sin guion)
  // para ejercer el match tolerante por substring en hijos directos.
  { nombre: 'Alfa', completo: 0.77, id: 'S1' },
  { nombre: 'delivery  - ALFA', completo: 0.8, id: 'S1D', padre: 'S1' },
  { nombre: 'Discovery Alfa', completo: 0.5, id: 'S1V', padre: 'S1' },
  // Iniciativa de portafolio bajo Delivery → tipo delivery. Despliegue + 100% +
  // Completo = un pase a producción.
  { codigo: 'IBD200', nombre: 'Init Alfa', portafolio: true, etapa: 'Despliegue', completo: 1, estado: 'Completo', fechaInicio: '2026-07-01', fechaFin: '2026-08-20', id: 'S1I', padre: 'S1D' },
  // Iniciativa de portafolio bajo Discovery → tipo discovery.
  { codigo: 'IBD202', nombre: 'Disco Alfa', portafolio: true, etapa: 'Pruebas', completo: 0.4, estado: 'En progreso', id: 'S1DV', padre: 'S1V' },
  // Bravo: solo-delivery (hijos Q2, sin nodo Delivery/Discovery) → delivery del
  // top-level, discovery null. Su iniciativa de portafolio igual es tipo delivery.
  { nombre: 'Bravo', completo: 0.7, id: 'S2' },
  { nombre: 'Q2', completo: 1, id: 'S2Q', padre: 'S2' },
  { codigo: 'IBD201', nombre: 'Init Bravo', portafolio: true, etapa: 'Desarrollo', completo: 0.6, estado: 'En progreso', id: 'S2I', padre: 'S2Q' },
  // Delta: en la planilla pero sin correspondencia en el sistema → warning, se omite.
  { nombre: 'Delta', completo: 0.5, id: 'S3' },
  { nombre: 'Delivery - Delta', completo: 0.5, id: 'S3D', padre: 'S3' },
];

// Squads del sistema: Gamma no aparece en la planilla → warning "sin fila".
const REFS: SquadRef[] = [
  { id: 1, nombre: 'Alfa' },
  { id: 2, nombre: 'Bravo' },
  { id: 3, nombre: 'Gamma' },
];

const PERIOD: Period = {
  fechaReferencia: '2026-08-14',
  semanaInicio: '2026-08-11',
  trimestre: { nombre: 'Q3-2026', inicio: '2026-07-01', fin: '2026-09-30' },
  editadoPor: 'Equipo de Agile Coach',
};

const COL = { codigo: 1, portafolio: 3, nombre: 5, fechaInicio: 8, fechaFin: 9, etapa: 12, completo: 13, fechaFinReal: 18, estado: 20, filaId: 22, padre: 24 };

async function fixtureBuffer(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Etica - 2026');
  FILAS.forEach((f, i) => {
    const row = ws.getRow(i + 1);
    if (f.codigo !== undefined) row.getCell(COL.codigo).value = f.codigo;
    if (f.portafolio !== undefined) row.getCell(COL.portafolio).value = f.portafolio;
    if (f.nombre !== undefined) row.getCell(COL.nombre).value = f.nombre;
    if (f.fechaInicio !== undefined) row.getCell(COL.fechaInicio).value = f.fechaInicio;
    if (f.fechaFin !== undefined) row.getCell(COL.fechaFin).value = f.fechaFin;
    if (f.etapa !== undefined) row.getCell(COL.etapa).value = f.etapa;
    if (f.completo !== undefined && f.completo !== null) row.getCell(COL.completo).value = f.completo;
    if (f.fechaFinReal !== undefined) row.getCell(COL.fechaFinReal).value = f.fechaFinReal;
    if (f.estado !== undefined) row.getCell(COL.estado).value = f.estado;
    if (f.id !== undefined) row.getCell(COL.filaId).value = f.id;
    if (f.padre !== undefined) row.getCell(COL.padre).value = f.padre;
  });
  return (await wb.xlsx.writeBuffer()) as unknown as Uint8Array;
}

// El mismo contrato que valida al CsvDataSource: una fila por squad, tipos
// correctos, calculados coherentes. Discovery nullable (squad solo-delivery).
function esSnapshotValido(s: SquadSnapshot): boolean {
  return (
    Number.isInteger(s.squadId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.semanaInicio) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.fechaReferencia) &&
    typeof s.trimestre === 'string' &&
    s.deliveryRealPct >= 0 &&
    s.deliveryRealPct <= 1 &&
    (s.discoveryRealPct === null || (s.discoveryRealPct >= 0 && s.discoveryRealPct <= 1)) &&
    typeof s.deliveryManualOverride === 'boolean' &&
    typeof s.discoveryManualOverride === 'boolean' &&
    s.esperadoPct >= 0 &&
    s.esperadoPct <= 1 &&
    ['rojo', 'amarillo', 'verde'].includes(s.semaforo) &&
    (s.discoveryDeltaPct === null || typeof s.discoveryDeltaPct === 'number') &&
    typeof s.editadoPor === 'string' &&
    s.editadoPor.length > 0
  );
}

describe('SmartsheetDataSource — contrato DataSource', () => {
  let source: SmartsheetDataSource;
  let snapshots: SquadSnapshot[];

  beforeAll(async () => {
    source = await SmartsheetDataSource.fromArrayBuffer(await fixtureBuffer(), REFS);
    snapshots = await source.fetchSnapshot(PERIOD);
  });

  it('produce un SquadSnapshot válido por squad matcheado (ignora molde y no-match)', () => {
    expect(snapshots.map((s) => s.squadId).sort()).toEqual([1, 2]);
    expect(snapshots.every(esSnapshotValido)).toBe(true);
  });

  it('aplica la regla delivery/discovery con match tolerante de nodos', () => {
    const alfa = snapshots.find((s) => s.squadId === 1)!;
    expect(alfa.deliveryRealPct).toBeCloseTo(0.8, 5); // del nodo "delivery  - ALFA"
    expect(alfa.discoveryRealPct).toBeCloseTo(0.5, 5); // del nodo "Discovery Alfa"
  });

  it('un squad solo-delivery (sin nodo Discovery) llega con discovery null', () => {
    const bravo = snapshots.find((s) => s.squadId === 2)!;
    expect(bravo.deliveryRealPct).toBeCloseTo(0.7, 5); // % del top-level
    expect(bravo.discoveryRealPct).toBeNull();
    expect(bravo.discoveryDeltaPct).toBeNull();
  });

  it('el esperado es calculado por la app (no importado) y los deltas son coherentes', () => {
    const alfa = snapshots.find((s) => s.squadId === 1)!;
    expect(alfa.esperadoPct).toBeGreaterThan(0);
    expect(alfa.esperadoPct).toBeLessThan(1);
    expect(alfa.deliveryDeltaPct).toBeCloseTo(alfa.deliveryRealPct - alfa.esperadoPct, 5);
    expect(alfa.discoveryDeltaPct).toBeCloseTo(0.5 - alfa.esperadoPct, 5);
  });

  it('reporta los huecos en warnings en vez de inventar', () => {
    const w = source.warnings();
    expect(w.some((x) => x.includes('Delta'))).toBe(true); // sin correspondencia
    expect(w.some((x) => x.includes('Gamma'))).toBe(true); // sin fila en la planilla
    // 4 filas de portafolio (IBD200, IBD202, IBD201, TPL001); 3 importadas y la
    // del molde omitida (su raíz no matchea un squad del sistema).
    expect(w.some((x) => /Iniciativas de portafolio detectadas: 4 .*importadas: 3.*omitidas sin squad: 1/.test(x))).toBe(true);
  });

  it('importa sólo las filas de portafolio, identificadas por el id de fila (col V)', () => {
    const inits = source.parseInitiatives(PERIOD);
    expect(inits.map((i) => i.smartsheetRowId).sort()).toEqual(['S1DV', 'S1I', 'S2I']);
    // TPL001 (bajo el molde) no entra.
    expect(inits.some((i) => i.codigoExterno === 'TPL001')).toBe(false);
    // La semana la pone el período del import.
    expect(inits.every((i) => i.semanaInicio === PERIOD.semanaInicio && i.portafolio)).toBe(true);
  });

  it('resuelve squad por la raíz y tipo por la rama (delivery/discovery)', () => {
    const inits = source.parseInitiatives(PERIOD);
    const alfaDelivery = inits.find((i) => i.smartsheetRowId === 'S1I')!;
    expect(alfaDelivery.squadId).toBe(1);
    expect(alfaDelivery.tipo).toBe('delivery'); // cuelga de "delivery - ALFA"
    const alfaDiscovery = inits.find((i) => i.smartsheetRowId === 'S1DV')!;
    expect(alfaDiscovery.tipo).toBe('discovery'); // cuelga de "Discovery Alfa"
    const bravo = inits.find((i) => i.smartsheetRowId === 'S2I')!;
    expect(bravo.squadId).toBe(2);
    expect(bravo.tipo).toBe('delivery'); // solo-delivery, sin rama Discovery
  });

  it('los pases a producción (Despliegue + 100% + Completo) quedan identificables', () => {
    const inits = source.parseInitiatives(PERIOD);
    const pases = inits.filter((i) => i.etapa === 'Despliegue' && i.pctAvance === 1 && i.estado === 'Completo');
    expect(pases.map((i) => i.codigoExterno)).toEqual(['IBD200']);
  });

  it('normalizar: trim + sin acentos + minúsculas + espacios colapsados', () => {
    expect(normalizar('  Empresas   Actual ')).toBe('empresas actual');
    expect(normalizar('Discovery  Préstamos')).toBe('discovery prestamos');
  });
});
