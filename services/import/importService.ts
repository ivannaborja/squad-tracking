import { prisma } from '../../lib/prisma';
import { CsvDataSource, type ParsedInitiative } from '../../adapters/csv/CsvDataSource';
import type { Period } from '../../ports/DataSource';
import type { Risk, SquadSnapshot } from '../../domain/types';
import { delta } from '../../domain/delta';
import { esperadoPct } from '../../domain/esperadoPct';
import { recomputeSemaforo } from '../report/assemble';
import { resolverTrimestre, trimestreDeFecha } from '../report/quarters';
import { hoyISO, inicioDeSemana } from '../../lib/dates';
import { claveDecision, detectarConflictos, type Conflicto } from './conflicts';

const TTL_MS = 30 * 60 * 1000; // media hora alcanza para decidir un import

export interface Decision {
  squad_id: number;
  field: 'delivery_real_pct' | 'discovery_real_pct';
  accept: boolean;
}

interface StagingPayload {
  snapshots: SquadSnapshot[];
  initiatives: ParsedInitiative[];
  period: Period;
}

type ResultadoImport =
  | { status: 'invalid_csv' }
  | { status: 'applied'; summary: { squads_updated: number; initiatives_upserted: number } }
  | {
      status: 'needs_confirmation';
      import_token: string;
      expires_at: string;
      conflicts: Conflicto[];
      non_conflicting_preview: { squads_updated: number; initiatives_upserted: number };
    };

// El import cuenta como un check-in: usa la fecha de hoy y congela los calculados.
function periodoDeHoy(editadoPor: string): Period {
  const fechaReferencia = hoyISO();
  const label = trimestreDeFecha(fechaReferencia);
  const { inicio, fin } = resolverTrimestre(label);
  return {
    fechaReferencia,
    semanaInicio: inicioDeSemana(fechaReferencia),
    trimestre: { nombre: label, inicio, fin },
    editadoPor,
  };
}

export async function procesarImport(csv: string, editadoPor: string): Promise<ResultadoImport> {
  await limpiarVencidos();
  const period = periodoDeHoy(editadoPor);

  let snapshots: SquadSnapshot[];
  let initiatives: ParsedInitiative[];
  try {
    const source = new CsvDataSource(csv);
    snapshots = await source.fetchSnapshot(period);
    initiatives = source.parseInitiatives(period);
  } catch {
    return { status: 'invalid_csv' };
  }

  const conflicts: Conflicto[] = [];
  for (const s of snapshots) {
    const actual = await estadoActual(s.squadId, period.semanaInicio);
    conflicts.push(
      ...detectarConflictos(
        { squadId: s.squadId, deliveryRealPct: s.deliveryRealPct, discoveryRealPct: s.discoveryRealPct },
        actual
      )
    );
  }

  if (conflicts.length === 0) {
    const summary = await aplicar(snapshots, initiatives, period, new Map(), editadoPor);
    return { status: 'applied', summary };
  }

  // Hay conflictos: NO se persiste nada. Se guarda el batch en Postgres (no en
  // memoria: en serverless el confirm puede caer en otra instancia) y se espera
  // la decisión por campo.
  const token = `imp_${crypto.randomUUID().slice(0, 8)}`;
  const expiresAt = new Date(Date.now() + TTL_MS);
  const payload: StagingPayload = { snapshots, initiatives, period };
  await prisma.importStaging.create({
    data: { token, payload: payload as unknown as object, expiresAt },
  });

  return {
    status: 'needs_confirmation',
    import_token: token,
    expires_at: expiresAt.toISOString(),
    conflicts,
    non_conflicting_preview: {
      squads_updated: snapshots.length,
      initiatives_upserted: initiatives.length,
    },
  };
}

type ResultadoConfirm =
  | { status: 'token_not_found' }
  | { status: 'token_expired' }
  | { status: 'confirmed'; summary: { squads_updated: number; initiatives_upserted: number } };

export async function confirmarImport(
  token: string,
  decisions: Decision[],
  editadoPor: string
): Promise<ResultadoConfirm> {
  const staging = await prisma.importStaging.findUnique({ where: { token } });
  if (!staging) return { status: 'token_not_found' };
  if (staging.expiresAt < new Date()) {
    await prisma.importStaging.delete({ where: { token } });
    return { status: 'token_expired' };
  }

  const { snapshots, initiatives, period } = staging.payload as unknown as StagingPayload;
  const mapa = new Map(decisions.map((d) => [claveDecision(d.squad_id, d.field), d.accept]));

  const summary = await aplicar(snapshots, initiatives, period, mapa, editadoPor);
  await prisma.importStaging.delete({ where: { token } });
  return { status: 'confirmed', summary };
}

export async function descartarImport(token: string): Promise<boolean> {
  const staging = await prisma.importStaging.findUnique({ where: { token } });
  if (!staging) return false;
  await prisma.importStaging.delete({ where: { token } });
  return true;
}

// Escribe los snapshots respetando la resolución por campo, recompone los
// calculados con los riesgos reales del squad, y hace upsert de las iniciativas.
async function aplicar(
  snapshots: SquadSnapshot[],
  initiatives: ParsedInitiative[],
  period: Period,
  decisiones: Map<string, boolean>,
  editadoPor: string
): Promise<{ squads_updated: number; initiatives_upserted: number }> {
  const esperado = esperadoPct(period.fechaReferencia, {
    inicio: period.trimestre.inicio,
    fin: period.trimestre.fin,
  });

  for (const s of snapshots) {
    const actual = await estadoActual(s.squadId, period.semanaInicio);

    const delivery = resolverCampo(
      'delivery_real_pct',
      s.squadId,
      s.deliveryRealPct,
      actual?.deliveryRealPct,
      actual?.deliveryManualOverride ?? false,
      decisiones
    );
    const discovery = resolverCampo(
      'discovery_real_pct',
      s.squadId,
      s.discoveryRealPct,
      actual?.discoveryRealPct,
      actual?.discoveryManualOverride ?? false,
      decisiones
    );

    const deliveryDeltaPct = delta(delivery.valor, esperado);
    const discoveryDeltaPct = delta(discovery.valor, esperado);
    const semaforo = recomputeSemaforo(deliveryDeltaPct, await risksDeSquad(s.squadId), period.fechaReferencia);

    const datos = {
      trimestre: period.trimestre.nombre,
      deliveryRealPct: delivery.valor,
      discoveryRealPct: discovery.valor,
      deliveryManualOverride: delivery.override,
      discoveryManualOverride: discovery.override,
      esperadoPct: esperado,
      deliveryDeltaPct,
      discoveryDeltaPct,
      semaforo,
      // El import nunca toca la frase de pronóstico: se conserva la que hubiera.
      frasePronostico: undefined as string | undefined,
      editadoPor,
      fechaReferencia: new Date(period.fechaReferencia),
    };

    const semanaInicio = new Date(period.semanaInicio);
    await prisma.squadSnapshot.upsert({
      where: { squadId_semanaInicio: { squadId: s.squadId, semanaInicio } },
      create: { squadId: s.squadId, semanaInicio, ...datos, frasePronostico: null },
      update: strip(datos),
    });
  }

  for (const i of initiatives) {
    await upsertInitiative(i);
  }

  return { squads_updated: snapshots.length, initiatives_upserted: initiatives.length };
}

// Resuelve un real: si no hay conflicto (o el equipo aceptó el import) se escribe
// el entrante y el override vuelve a false; si el equipo rechazó (o no decidió,
// default seguro) se conserva el valor manual con su override intacto.
function resolverCampo(
  field: 'delivery_real_pct' | 'discovery_real_pct',
  squadId: number,
  entrante: number,
  manual: number | undefined,
  overrideActivo: boolean,
  decisiones: Map<string, boolean>
): { valor: number; override: boolean } {
  const enConflicto = overrideActivo && manual !== undefined && manual !== entrante;
  if (!enConflicto) return { valor: entrante, override: false };

  const acepta = decisiones.get(claveDecision(squadId, field)) ?? false;
  return acepta ? { valor: entrante, override: false } : { valor: manual as number, override: true };
}

async function upsertInitiative(i: ParsedInitiative): Promise<void> {
  const data = {
    squadId: i.squadId,
    codigoExterno: i.codigoExterno,
    nombre: i.nombre,
    tipo: i.tipo,
    estado: i.estado,
    pctAvance: i.pctAvance,
    fechaInicio: new Date(i.fechaInicio),
    fechaFin: new Date(i.fechaFin),
    semanaInicio: new Date(i.semanaInicio),
  };
  // Sin codigo_externo no hay clave natural entre semanas: se inserta nueva.
  if (i.codigoExterno === null) {
    await prisma.initiative.create({ data });
    return;
  }
  await prisma.initiative.upsert({
    where: { squadId_codigoExterno: { squadId: i.squadId, codigoExterno: i.codigoExterno } },
    create: data,
    update: data,
  });
}

async function estadoActual(squadId: number, semanaInicio: string) {
  const row = await prisma.squadSnapshot.findUnique({
    where: { squadId_semanaInicio: { squadId, semanaInicio: new Date(semanaInicio) } },
  });
  if (!row) return null;
  return {
    deliveryRealPct: row.deliveryRealPct,
    deliveryManualOverride: row.deliveryManualOverride,
    discoveryRealPct: row.discoveryRealPct,
    discoveryManualOverride: row.discoveryManualOverride,
  };
}

async function risksDeSquad(squadId: number): Promise<Risk[]> {
  const risks = await prisma.risk.findMany({ where: { squads: { some: { squadId } } } });
  return risks.map((r) => ({
    categoriaImpacto: r.categoriaImpacto,
    resuelto: r.resuelto,
    semanaInicio: r.semanaInicio.toISOString().slice(0, 10),
    semanaFin: r.semanaFin.toISOString().slice(0, 10),
  }));
}

async function limpiarVencidos(): Promise<void> {
  await prisma.importStaging.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

// En el update no se pisa la frase (undefined = Prisma la deja intacta).
function strip(datos: { frasePronostico: string | undefined } & Record<string, unknown>) {
  const { frasePronostico, ...resto } = datos;
  return frasePronostico === undefined ? resto : datos;
}
