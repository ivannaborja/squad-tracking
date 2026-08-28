import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { SmartsheetDataSource, normalizar, type SquadRef } from './SmartsheetDataSource';
import type { Period } from '../../ports/DataSource';
import type { SquadSnapshot } from '../../domain/types';

// Fixture ANONIMIZADO generado en memoria: reproduce la forma del export real de
// Smartsheet (árbol por Padre/Id, nodos Delivery/Discovery, caso solo-delivery,
// filas con código, el molde "Plantilla squads") sin ningún dato interno real.
// Columnas 1-based confirmadas contra el archivo real: A=codigo, E=nombre,
// M=%completo, V=id fila, X=padre.
interface Fila {
  codigo?: string;
  nombre?: string;
  completo?: number | null;
  id?: string;
  padre?: string;
}
const FILAS: Fila[] = [
  { codigo: 'Codigo Etica', nombre: 'Nombre', id: 'Identificador de la fila', padre: 'Padre' }, // header
  // Molde: se ignora entero, incluida su fila con código.
  { nombre: 'Plantilla squads', id: 'T1' },
  { nombre: 'Delivery', id: 'T2', padre: 'T1' },
  { codigo: 'TPL001', nombre: 'Molde con código', completo: 1, id: 'T2a', padre: 'T2' },
  // Alfa: split normal, pero con naming sucio (doble espacio, minúsculas, sin guion)
  // para ejercer el match tolerante por substring en hijos directos.
  { nombre: 'Alfa', completo: 0.77, id: 'S1' },
  { nombre: 'delivery  - ALFA', completo: 0.8, id: 'S1D', padre: 'S1' },
  { nombre: 'Discovery Alfa', completo: 0.5, id: 'S1V', padre: 'S1' },
  { codigo: 'IBD200', nombre: 'Init Alfa', completo: 0.9, id: 'S1I', padre: 'S1D' },
  // Bravo: solo-delivery (hijos Q2, sin nodo Delivery/Discovery) → delivery del
  // top-level, discovery null.
  { nombre: 'Bravo', completo: 0.7, id: 'S2' },
  { nombre: 'Q2', completo: 1, id: 'S2Q', padre: 'S2' },
  { codigo: 'IBD201', nombre: 'Init Bravo', completo: 0.6, id: 'S2I', padre: 'S2Q' },
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

const COL = { codigo: 1, nombre: 5, completo: 13, filaId: 22, padre: 24 };

async function fixtureBuffer(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Etica - 2026');
  FILAS.forEach((f, i) => {
    const row = ws.getRow(i + 1);
    if (f.codigo !== undefined) row.getCell(COL.codigo).value = f.codigo;
    if (f.nombre !== undefined) row.getCell(COL.nombre).value = f.nombre;
    if (f.completo !== undefined && f.completo !== null) row.getCell(COL.completo).value = f.completo;
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
    // Iniciativas diferidas: cuenta IBD200 + IBD201, excluye TPL001 (bajo el molde).
    expect(w.some((x) => /Iniciativas no importadas.*2 filas/.test(x))).toBe(true);
  });

  it('no escribe iniciativas en v1 (diferidas)', () => {
    expect(source.parseInitiatives()).toEqual([]);
  });

  it('normalizar: trim + sin acentos + minúsculas + espacios colapsados', () => {
    expect(normalizar('  Empresas   Actual ')).toBe('empresas actual');
    expect(normalizar('Discovery  Préstamos')).toBe('discovery prestamos');
  });
});
