import { prisma } from '../../lib/prisma';
import type { Semaforo } from '../../domain/types';
import { resolverTrimestre, trimestreDeFecha } from './quarters';
import { assembleCompact, assembleSquadReportView, recomputeSemaforo } from './assemble';
import type {
  Collections,
  PersistedSnapshot,
  SquadReportView,
  SquadReportViewCompact,
} from './types';

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const isoN = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

// La fila más reciente por fecha_referencia, sin importar a qué semana pertenece
// (api.md): si no hubo check-in esta semana, se usa el último que exista.
function ultimoSnapshot(squadId: number) {
  return prisma.squadSnapshot.findFirst({
    where: { squadId },
    orderBy: { fechaReferencia: 'desc' },
  });
}

type SnapshotRow = NonNullable<Awaited<ReturnType<typeof ultimoSnapshot>>>;

function normalizar(row: SnapshotRow): PersistedSnapshot {
  return {
    semaforo: row.semaforo as Semaforo,
    deliveryRealPct: row.deliveryRealPct,
    discoveryRealPct: row.discoveryRealPct,
    esperadoPct: row.esperadoPct,
    deliveryDeltaPct: row.deliveryDeltaPct,
    discoveryDeltaPct: row.discoveryDeltaPct,
    trimestre: row.trimestre,
    semanaInicio: iso(row.semanaInicio),
    fechaReferencia: iso(row.fechaReferencia),
    frasePronostico: row.frasePronostico,
    editadoPor: row.editadoPor,
  };
}

// El Q para el "a hoy": el de la fila si existe, o el del calendario de la fecha
// pedida cuando el squad todavía no tiene snapshot.
function trimestreVigente(snapshot: PersistedSnapshot | null, date: string) {
  return resolverTrimestre(snapshot?.trimestre ?? trimestreDeFecha(date));
}

export async function getSquadReportView(
  squadId: number,
  date: string
): Promise<SquadReportView | null> {
  const squad = await prisma.squad.findUnique({ where: { id: squadId } });
  if (!squad) return null;

  const row = await ultimoSnapshot(squadId);
  const snapshot = row ? normalizar(row) : null;
  const semana = snapshot?.semanaInicio;
  const tri = trimestreVigente(snapshot, date);

  const [
    bloqueos,
    needs,
    achievements,
    upcomingDeliveries,
    initiatives,
    unplannedIntake,
    unplannedTrimestre,
  ] = await Promise.all([
    prisma.bloqueo.findMany({ where: { squads: { some: { squadId } } }, include: { squads: true } }),
    prisma.need.findMany({ where: { squadId, semanaInicio: semanaFiltro(semana) } }),
    prisma.achievement.findMany({ where: { squadId, semanaInicio: semanaFiltro(semana) } }),
    prisma.upcomingDelivery.findMany({ where: { squadId, semanaInicio: semanaFiltro(semana) } }),
    prisma.initiative.findMany({ where: { squadId, semanaInicio: semanaFiltro(semana) } }),
    // Semanal: la sección "ingresos no planificados" del pre-informe es de la semana.
    prisma.unplannedIntake.findMany({ where: { squadId, semanaInicio: semanaFiltro(semana) } }),
    // KPI "no planificadas": acumulado de PORTAFOLIO del Q (SDD literal:
    // COUNT(UnplannedIntake) GROUP BY trimestre, sin squad). Cuenta los intakes de
    // TODAS las squads del Q vigente — distinto de la sección semanal de arriba,
    // que sí es de esta squad.
    prisma.unplannedIntake.findMany({
      where: { semanaInicio: { gte: new Date(tri.inicio), lte: new Date(tri.fin) } },
    }),
  ]);

  const collections: Collections = {
    bloqueos: bloqueos.map((b) => ({
      id: b.id,
      descripcion: b.descripcion,
      severidad: b.severidad,
      desde: isoN(b.desde),
      hasta: isoN(b.hasta),
      resuelto: b.resuelto,
      squadIds: b.squads.map((s) => s.squadId),
    })),
    needs: needs.map((n) => ({
      id: n.id,
      descripcion: n.descripcion,
      dueno: n.dueno,
      semanaInicio: iso(n.semanaInicio),
      resuelto: n.resuelto,
    })),
    achievements: achievements.map((a) => ({
      id: a.id,
      descripcion: a.descripcion,
      semanaInicio: iso(a.semanaInicio),
    })),
    upcomingDeliveries: upcomingDeliveries.map((u) => ({
      id: u.id,
      descripcion: u.descripcion,
      fechaEstimada: iso(u.fechaEstimada),
      semanaInicio: iso(u.semanaInicio),
    })),
    initiatives: initiatives.map((i) => ({
      id: i.id,
      smartsheetRowId: i.smartsheetRowId,
      codigoExterno: i.codigoExterno,
      portafolio: i.portafolio,
      nombre: i.nombre,
      tipo: i.tipo,
      etapa: i.etapa,
      estado: i.estado,
      pctAvance: i.pctAvance,
      fechaInicio: isoN(i.fechaInicio),
      fechaFin: isoN(i.fechaFin),
      fechaFinReal: isoN(i.fechaFinReal),
      semanaInicio: iso(i.semanaInicio),
    })),
    unplannedIntake: unplannedIntake.map((u) => ({
      id: u.id,
      descripcion: u.descripcion,
      semanaInicio: iso(u.semanaInicio),
    })),
  };

  return assembleSquadReportView({
    squadId,
    squadNombre: squad.nombre,
    snapshot,
    date,
    trimestre: tri,
    collections,
    unplannedTrimestre: unplannedTrimestre.map((u) => ({
      id: u.id,
      descripcion: u.descripcion,
      semanaInicio: iso(u.semanaInicio),
    })),
  });
}

// Los 8 squads (id + nombre) para poblar el multi-select del form de riesgos:
// un riesgo puede reasignarse a cualquiera de ellos (RiskSquad).
export async function getSquads(): Promise<{ id: number; nombre: string }[]> {
  return prisma.squad.findMany({ orderBy: { id: 'asc' }, select: { id: true, nombre: true } });
}

export async function getOverview(date: string): Promise<SquadReportViewCompact[]> {
  const squads = await prisma.squad.findMany({ orderBy: { id: 'asc' } });
  return Promise.all(
    squads.map(async (squad) => {
      const row = await ultimoSnapshot(squad.id);
      const snapshot = row ? normalizar(row) : null;
      return assembleCompact({
        squadId: squad.id,
        squadNombre: squad.nombre,
        snapshot,
        date,
        trimestre: trimestreVigente(snapshot, date),
      });
    })
  );
}

export async function getHistory(squadId: number, from?: string, to?: string) {
  const rows = await prisma.squadSnapshot.findMany({
    where: {
      squadId,
      fechaReferencia: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    },
    orderBy: { fechaReferencia: 'asc' },
  });
  return rows.map(normalizar);
}

// Write-through: recomputa y REESCRIBE el color de la fila más reciente. Lo llama
// la escritura de check-in; los reads nunca lo tocan. Devuelve el color nuevo, o
// null si el squad no tiene fila. Hoy el color sólo depende del delta de delivery.
export async function persistRecomputedSemaforo(squadId: number): Promise<Semaforo | null> {
  const row = await ultimoSnapshot(squadId);
  if (!row) return null;

  const color = recomputeSemaforo(row.deliveryDeltaPct);
  await prisma.squadSnapshot.update({ where: { id: row.id }, data: { semaforo: color } });
  return color;
}

// Las colecciones semanales se acotan a la semana de la fila leída; sin fila, no
// hay semana y no se traen (se pasa una fecha imposible de matchear).
function semanaFiltro(semana: string | undefined): Date {
  return new Date(semana ?? '1900-01-01');
}
