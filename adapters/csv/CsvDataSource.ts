import type { DataSource, Period, ParsedInitiative } from '../../ports/DataSource';
import type { SquadSnapshot } from '../../domain/types';
import { esperadoPct } from '../../domain/esperadoPct';
import { delta } from '../../domain/delta';
import { semaforo as calcSemaforo } from '../../domain/semaforo';

export type { ParsedInitiative };

// Lo mínimo de PrismaClient que usa persist(). Se inyecta en vez de importar el
// cliente generado: así el adaptador no arrastra Postgres a quien sólo mapea, y
// el test de contrato corre sin base.
export interface PersistClient {
  squadSnapshot: {
    upsert(args: {
      where: { squadId_semanaInicio: { squadId: number; semanaInicio: Date } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  initiative: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

export class CsvDataSource implements DataSource {
  private readonly rows: Record<string, string>[];

  constructor(csv: string) {
    this.rows = parseCsv(csv);
  }

  async fetchSnapshot(period: Period): Promise<SquadSnapshot[]> {
    const esperado = esperadoPct(period.fechaReferencia, {
      inicio: period.trimestre.inicio,
      fin: period.trimestre.fin,
    });

    return this.groupBySquad().map(({ squadId, rows }) => {
      const deliveryRealPct = num(rows[0].delivery_real_pct);
      const discoveryRealPct = num(rows[0].discovery_real_pct);
      const deliveryDeltaPct = delta(deliveryRealPct, esperado);
      const discoveryDeltaPct = delta(discoveryRealPct, esperado);

      return {
        squadId,
        semanaInicio: period.semanaInicio,
        fechaReferencia: period.fechaReferencia,
        trimestre: period.trimestre.nombre,
        deliveryRealPct,
        discoveryRealPct,
        // El import no es edición manual: los overrides arrancan en false.
        deliveryManualOverride: false,
        discoveryManualOverride: false,
        esperadoPct: esperado,
        deliveryDeltaPct,
        discoveryDeltaPct,
        // Color en base al delta de delivery (hoy el semáforo no depende de más).
        semaforo: calcSemaforo(deliveryDeltaPct),
        frasePronostico: null,
        editadoPor: period.editadoPor,
      };
    });
  }

  // El CSV plano no reporta huecos: viene ya reprocesado, una fila por dato.
  warnings(): string[] {
    return [];
  }

  parseInitiatives(period: Period): ParsedInitiative[] {
    return this.rows.map((r) => ({
      squadId: num(r.squad_id),
      // El CSV plano no trae el identificador de fila de Smartsheet: sin él, cada
      // import inserta filas nuevas (el .xlsx real sí lo trae y hace upsert).
      smartsheetRowId: null,
      codigoExterno: r.codigo_externo?.trim() ? r.codigo_externo.trim() : null,
      portafolio: false,
      nombre: r.iniciativa,
      tipo: r.tipo,
      etapa: null,
      estado: r.estado,
      pctAvance: num(r.pct_avance),
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      fechaFinReal: null,
      semanaInicio: period.semanaInicio,
    }));
  }

  async persist(client: PersistClient, period: Period): Promise<void> {
    const snapshots = await this.fetchSnapshot(period);
    for (const s of snapshots) {
      await client.squadSnapshot.upsert({
        where: {
          squadId_semanaInicio: {
            squadId: s.squadId,
            semanaInicio: new Date(s.semanaInicio),
          },
        },
        create: snapshotRow(s),
        update: snapshotRow(s),
      });
    }

    for (const i of this.parseInitiatives(period)) {
      // El CSV no trae identificador de fila de Smartsheet, así que no hay clave
      // natural para el upsert entre semanas: se inserta fila nueva cada import.
      await client.initiative.create({ data: initiativeRow(i) });
    }
  }

  private groupBySquad(): { squadId: number; rows: Record<string, string>[] }[] {
    const orden: number[] = [];
    const porSquad = new Map<number, Record<string, string>[]>();
    for (const r of this.rows) {
      const id = num(r.squad_id);
      if (!porSquad.has(id)) {
        porSquad.set(id, []);
        orden.push(id);
      }
      porSquad.get(id)!.push(r);
    }
    return orden.map((squadId) => ({ squadId, rows: porSquad.get(squadId)! }));
  }
}

function snapshotRow(s: SquadSnapshot): Record<string, unknown> {
  return {
    squadId: s.squadId,
    semanaInicio: new Date(s.semanaInicio),
    fechaReferencia: new Date(s.fechaReferencia),
    trimestre: s.trimestre,
    deliveryRealPct: s.deliveryRealPct,
    discoveryRealPct: s.discoveryRealPct,
    deliveryManualOverride: s.deliveryManualOverride,
    discoveryManualOverride: s.discoveryManualOverride,
    esperadoPct: s.esperadoPct,
    deliveryDeltaPct: s.deliveryDeltaPct,
    discoveryDeltaPct: s.discoveryDeltaPct,
    semaforo: s.semaforo,
    frasePronostico: s.frasePronostico,
    editadoPor: s.editadoPor,
  };
}

function initiativeRow(i: ParsedInitiative): Record<string, unknown> {
  return {
    squadId: i.squadId,
    smartsheetRowId: i.smartsheetRowId,
    codigoExterno: i.codigoExterno,
    portafolio: i.portafolio,
    nombre: i.nombre,
    tipo: i.tipo,
    etapa: i.etapa,
    estado: i.estado,
    pctAvance: i.pctAvance,
    fechaInicio: i.fechaInicio ? new Date(i.fechaInicio) : null,
    fechaFin: i.fechaFin ? new Date(i.fechaFin) : null,
    fechaFinReal: i.fechaFinReal ? new Date(i.fechaFinReal) : null,
    semanaInicio: new Date(i.semanaInicio),
  };
}

function num(v: string): number {
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`valor numérico inválido en el CSV: "${v}"`);
  return n;
}

// Parser chico a propósito: soporta comillas dobles y comas dentro de comillas,
// que es lo que un export de Smartsheet puede traer. No pretende cubrir todo el
// RFC 4180 — si el export se complica, acá es donde se endurece.
function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new Error('CSV vacío');

  const header = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    if (cells.length !== header.length) {
      throw new Error(
        `fila con ${cells.length} columnas, se esperaban ${header.length}: "${line}"`
      );
    }
    const row: Record<string, string> = {};
    header.forEach((col, idx) => {
      row[col.trim()] = cells[idx];
    });
    return row;
  });
}

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (entreComillas && line[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === ',' && !entreComillas) {
      cells.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  cells.push(actual);
  return cells.map((c) => c.trim());
}
