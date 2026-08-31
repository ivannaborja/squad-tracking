import { describe, it, expect } from 'vitest';
import { CsvDataSource, type PersistClient } from './CsvDataSource';
import type { Period } from '../../ports/DataSource';
import type { SquadSnapshot } from '../../domain/types';

// Export chico de Smartsheet: 3 squads. La segunda fila de Adquirencia viene sin
// codigo_externo a propósito, para ejercer el caso nullable del upsert.
const CSV = `squad_id,squad,delivery_real_pct,discovery_real_pct,codigo_externo,iniciativa,tipo,estado,pct_avance,fecha_inicio,fecha_fin
1,Adquirencia,0.56,0.40,IBD015,Checkout nuevo,delivery,En curso,0.60,2026-07-01,2026-09-30
1,Adquirencia,0.56,0.40,,Discovery pagos,discovery,En curso,0.30,2026-07-05,2026-09-15
2,Lealtad,0.39,0.50,IBD022,Programa puntos,delivery,En curso,0.35,2026-07-01,2026-09-30
3,Reserva,0.62,0.48,IBD030,Nuevo flujo,delivery,En curso,0.70,2026-07-01,2026-09-30`;

const PERIOD: Period = {
  fechaReferencia: '2026-08-14',
  semanaInicio: '2026-08-11',
  trimestre: { nombre: 'Q3-2026', inicio: '2026-07-01', fin: '2026-09-30' },
  editadoPor: 'Equipo de Agile Coach',
};

// El contrato que cualquier DataSource debe cumplir: una fila con todos los
// campos del modelo, tipos correctos y calculados coherentes con domain/.
function esSnapshotValido(s: SquadSnapshot): boolean {
  return (
    Number.isInteger(s.squadId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.semanaInicio) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.fechaReferencia) &&
    typeof s.trimestre === 'string' &&
    s.deliveryRealPct >= 0 && s.deliveryRealPct <= 1 &&
    // Discovery nullable: un squad solo-delivery no tiene discovery.
    (s.discoveryRealPct === null || (s.discoveryRealPct >= 0 && s.discoveryRealPct <= 1)) &&
    typeof s.deliveryManualOverride === 'boolean' &&
    typeof s.discoveryManualOverride === 'boolean' &&
    s.esperadoPct >= 0 && s.esperadoPct <= 1 &&
    ['rojo', 'amarillo', 'verde'].includes(s.semaforo) &&
    (s.frasePronostico === null || typeof s.frasePronostico === 'string') &&
    typeof s.editadoPor === 'string' && s.editadoPor.length > 0
  );
}

describe('CsvDataSource — contrato DataSource', () => {
  it('produce un SquadSnapshot válido por squad', async () => {
    const snapshots = await new CsvDataSource(CSV).fetchSnapshot(PERIOD);

    expect(snapshots).toHaveLength(3);
    expect(snapshots.map((s) => s.squadId)).toEqual([1, 2, 3]);
    expect(snapshots.every(esSnapshotValido)).toBe(true);
  });

  it('congela esperado y deltas contra la fecha de referencia', async () => {
    const [adquirencia] = await new CsvDataSource(CSV).fetchSnapshot(PERIOD);

    expect(adquirencia.esperadoPct).toBeCloseTo(0.5, 1);
    expect(adquirencia.deliveryDeltaPct).toBeCloseTo(
      adquirencia.deliveryRealPct - adquirencia.esperadoPct,
      5
    );
    expect(adquirencia.trimestre).toBe('Q3-2026');
    expect(adquirencia.deliveryManualOverride).toBe(false);
    expect(adquirencia.frasePronostico).toBeNull();
  });

  it('sin riesgos en el CSV, el color sale de Delivery: +6pp verde, −11pp amarillo', async () => {
    const [adquirencia, lealtad] = await new CsvDataSource(CSV).fetchSnapshot(PERIOD);

    expect(adquirencia.semaforo).toBe('verde'); // +0.06, sin riesgo cargado aún
    expect(lealtad.semaforo).toBe('amarillo'); // −0.11
  });

  it('las iniciativas del CSV se insertan (sin rowId de Smartsheet no hay upsert)', async () => {
    const createdRows: Record<string, unknown>[] = [];
    let snapshotUpserts = 0;

    const fake: PersistClient = {
      squadSnapshot: {
        async upsert() {
          snapshotUpserts++;
        },
      },
      initiative: {
        async create({ data }) {
          createdRows.push(data);
        },
      },
    };

    await new CsvDataSource(CSV).persist(fake, PERIOD);

    expect(snapshotUpserts).toBe(3); // un snapshot por squad
    // Las 4 filas se insertan: el CSV no trae identificador de fila de Smartsheet,
    // así que no hay clave natural para upsertear entre semanas.
    expect(createdRows).toHaveLength(4);
    expect(createdRows.every((r) => r.smartsheetRowId === null && r.portafolio === false)).toBe(true);
    expect(createdRows.map((r) => r.codigoExterno)).toEqual(['IBD015', null, 'IBD022', 'IBD030']);
  });
});
