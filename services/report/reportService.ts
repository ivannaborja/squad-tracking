import { prisma } from '../../lib/prisma';
import type { Risk, Semaforo } from '../../domain/types';
import { resolverTrimestre, trimestreDeFecha } from './quarters';
import { assembleCompact, assembleSquadReportView, recomputeSemaforo } from './assemble';
import type {
  Collections,
  PersistedSnapshot,
  SquadReportView,
  SquadReportViewCompact,
} from './types';

const iso = (d: Date): string => d.toISOString().slice(0, 10);

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
    risks,
    needs,
    achievements,
    upcomingDeliveries,
    initiatives,
    unplannedIntake,
    unplannedTrimestre,
    actionPlans,
  ] = await Promise.all([
    prisma.risk.findMany({ where: { squads: { some: { squadId } } } }),
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
    // Sólo los planes en curso, no el historial ya resuelto.
    prisma.actionPlan.findMany({ where: { resuelto: false } }),
  ]);

  const collections: Collections = {
    risks: risks.map((r) => ({
      descripcion: r.descripcion,
      categoriaImpacto: r.categoriaImpacto,
      severidad: r.severidad,
      dueno: r.dueno,
      accionProxima: r.accionProxima,
      checkpoint: r.checkpoint,
      tipo: r.tipo,
      semanaInicio: iso(r.semanaInicio),
      semanaFin: iso(r.semanaFin),
      resuelto: r.resuelto,
    })),
    needs: needs.map((n) => ({
      descripcion: n.descripcion,
      dueno: n.dueno,
      semanaInicio: iso(n.semanaInicio),
      resuelto: n.resuelto,
    })),
    achievements: achievements.map((a) => ({
      descripcion: a.descripcion,
      semanaInicio: iso(a.semanaInicio),
    })),
    upcomingDeliveries: upcomingDeliveries.map((u) => ({
      descripcion: u.descripcion,
      fechaEstimada: iso(u.fechaEstimada),
      semanaInicio: iso(u.semanaInicio),
    })),
    initiatives: initiatives.map((i) => ({
      codigoExterno: i.codigoExterno,
      nombre: i.nombre,
      tipo: i.tipo,
      estado: i.estado,
      pctAvance: i.pctAvance,
      fechaInicio: iso(i.fechaInicio),
      fechaFin: iso(i.fechaFin),
      semanaInicio: iso(i.semanaInicio),
    })),
    unplannedIntake: unplannedIntake.map((u) => ({
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
      descripcion: u.descripcion,
      semanaInicio: iso(u.semanaInicio),
    })),
    actionPlans: actionPlans.map((p) => ({
      descripcion: p.descripcion,
      dueno: p.dueno,
      plazo: p.plazo,
      estado: p.estado,
      semanaInicio: iso(p.semanaInicio),
      resuelto: p.resuelto,
    })),
  });
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

// Write-through: recomputa y REESCRIBE el color de la fila más reciente contra
// los riesgos vinculados. Lo llaman las escrituras de check-in y de riesgos; los
// reads nunca lo tocan. Devuelve el color nuevo, o null si el squad no tiene fila.
export async function persistRecomputedSemaforo(squadId: number): Promise<Semaforo | null> {
  const row = await ultimoSnapshot(squadId);
  if (!row) return null;

  const risks = await prisma.risk.findMany({ where: { squads: { some: { squadId } } } });
  const risksDominio: Risk[] = risks.map((r) => ({
    categoriaImpacto: r.categoriaImpacto,
    resuelto: r.resuelto,
    semanaInicio: iso(r.semanaInicio),
    semanaFin: iso(r.semanaFin),
  }));

  const color = recomputeSemaforo(row.deliveryDeltaPct, risksDominio, iso(row.fechaReferencia));
  await prisma.squadSnapshot.update({ where: { id: row.id }, data: { semaforo: color } });
  return color;
}

// Las colecciones semanales se acotan a la semana de la fila leída; sin fila, no
// hay semana y no se traen (se pasa una fecha imposible de matchear).
function semanaFiltro(semana: string | undefined): Date {
  return new Date(semana ?? '1900-01-01');
}
