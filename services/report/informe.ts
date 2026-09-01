import { prisma } from '../../lib/prisma';
import type { Semaforo } from '../../domain/types';
import { resolverTrimestre, trimestreDeFecha } from './quarters';
import { getOverview, getHistory } from './reportService';

// Capa de lectura del informe ejecutivo. Agrega lo que ya está en la base
// (snapshots, iniciativas) en los 4 KPIs y la tendencia, y suma la narrativa que
// escribe Dai (InformeSemanal / InformeSquadSemanal). No persiste nada.

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const avg = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

// Un punto del gráfico de tendencia: los promedios de una semana. discoveryPct
// puede ser null si esa semana nadie tenía discovery (se ignoran los nulls).
export interface TrendPoint {
  semanaInicio: string;
  deliveryPct: number | null;
  discoveryPct: number | null;
  esperadoPct: number;
}

// Un pase a producción cuenta si la iniciativa de portafolio está en Despliegue,
// al 100% y Completo (regla confirmada por Dai). El KPI es hechos / total del Q.
export interface PasesProduccion {
  hechos: number;
  total: number;
}

export interface InformeKpis {
  deliveryPromedio: number | null;
  discoveryPromedio: number | null;
  esperadoPct: number;
  // Discovery de esta semana menos el de la semana anterior (pp). null si no hay
  // semana previa con dato.
  discoveryDeltaSemanaAnterior: number | null;
  pasesProduccion: PasesProduccion;
  // KPI 4: número manual que completa Dai, no cálculo. null si no lo cargó.
  pasesPlanificados: number | null;
}

export interface SemaforoRow {
  squadId: number;
  squadNombre: string;
  semaforo: Semaforo | null;
  // % comprometido (avance real) del squad + su delta vs. esperado.
  deliveryRealPct: number | null;
  discoveryRealPct: number | null;
  deliveryDeltaPct: number | null;
  discoveryDeltaPct: number | null;
}

export interface InformeGeneralView {
  semanaInicio: string | null;
  // id de la fila InformeSemanal de la semana (clave del historial de narrativa).
  // null si esa semana todavía no se guardó nunca.
  informeId: number | null;
  kpis: InformeKpis;
  semaforos: SemaforoRow[];
  trend: TrendPoint[];
  novedades: string | null;
  lectura: string | null;
}

export interface SimpleItem {
  id: number;
  descripcion: string;
}
export interface EntregaItem extends SimpleItem {
  fechaEstimada: string;
}
export interface NeedItem extends SimpleItem {
  dueno: string;
  resuelto: boolean;
}
export interface BloqueoItem extends SimpleItem {
  severidad: string;
  dueno: string;
  accionProxima: string;
  checkpoint: string;
}

export interface InformeSquadView {
  squadId: number;
  squadNombre: string;
  semanaInicio: string | null;
  // id de la fila InformeSquadSemanal (clave del historial). null si nunca se guardó.
  informeId: number | null;
  semaforo: Semaforo | null;
  datosDe: string | null;
  kpis: InformeKpis;
  trend: TrendPoint[];
  narrativa: {
    novedades: string | null;
    pasesProduccion: string | null;
    despriorizaciones: string | null;
    pasesPlanificados: number | null;
  };
  proximasEntregas: EntregaItem[];
  ingresosNoPlanificados: SimpleItem[];
  needs: NeedItem[];
  bloqueos: BloqueoItem[];
}

// Tendencia de portafolio: promedio de los 8 squads por semana. Se puebla solo a
// medida que Dai importa cada semana (al principio 1-2 puntos, es inherente).
export async function getPortfolioTrend(): Promise<TrendPoint[]> {
  const rows = await prisma.squadSnapshot.findMany({ orderBy: { semanaInicio: 'asc' } });
  const porSemana = new Map<string, { del: number[]; dis: number[]; esp: number[] }>();
  for (const r of rows) {
    const wk = iso(r.semanaInicio);
    const g = porSemana.get(wk) ?? { del: [], dis: [], esp: [] };
    g.del.push(r.deliveryRealPct);
    if (r.discoveryRealPct !== null) g.dis.push(r.discoveryRealPct);
    g.esp.push(r.esperadoPct);
    porSemana.set(wk, g);
  }
  return [...porSemana.entries()]
    .map(([semanaInicio, g]) => ({
      semanaInicio,
      deliveryPct: avg(g.del),
      discoveryPct: avg(g.dis),
      esperadoPct: avg(g.esp) ?? 0,
    }))
    .sort((a, b) => a.semanaInicio.localeCompare(b.semanaInicio));
}

// Pases a producción del Q: iniciativas de portafolio en Despliegue + 100% +
// Completo, sobre el total de portafolio del Q. `extra` acota a un squad.
async function pasesProduccion(date: string, extra: { squadId?: number }): Promise<PasesProduccion> {
  const tri = resolverTrimestre(trimestreDeFecha(date));
  const enQ = {
    portafolio: true,
    semanaInicio: { gte: new Date(tri.inicio), lte: new Date(tri.fin) },
    ...(extra.squadId !== undefined ? { squadId: extra.squadId } : {}),
  };
  const [total, hechos] = await Promise.all([
    prisma.initiative.count({ where: enQ }),
    prisma.initiative.count({ where: { ...enQ, etapa: 'Despliegue', pctAvance: 1, estado: 'Completo' } }),
  ]);
  return { hechos, total };
}

export async function getInformeGeneral(date: string): Promise<InformeGeneralView> {
  const [trend, semaforos, pases] = await Promise.all([
    getPortfolioTrend(),
    getOverview(date),
    pasesProduccion(date, {}),
  ]);

  const ultima = trend.at(-1) ?? null;
  const previa = trend.length >= 2 ? trend[trend.length - 2] : null;
  const semanaInicio = ultima?.semanaInicio ?? null;

  const informe = semanaInicio
    ? await prisma.informeSemanal.findUnique({ where: { semanaInicio: new Date(semanaInicio) } })
    : null;

  return {
    semanaInicio,
    informeId: informe?.id ?? null,
    kpis: {
      deliveryPromedio: ultima?.deliveryPct ?? null,
      discoveryPromedio: ultima?.discoveryPct ?? null,
      esperadoPct: ultima?.esperadoPct ?? 0,
      discoveryDeltaSemanaAnterior: deltaDiscovery(ultima, previa),
      pasesProduccion: pases,
      pasesPlanificados: informe?.pasesPlanificados ?? null,
    },
    semaforos: semaforos.map((s) => ({
      squadId: s.squadId,
      squadNombre: s.squadNombre,
      semaforo: s.semaforo,
      deliveryRealPct: s.deliveryRealPct,
      discoveryRealPct: s.discoveryRealPct,
      deliveryDeltaPct: s.deliveryDeltaPct,
      discoveryDeltaPct: s.discoveryDeltaPct,
    })),
    trend,
    novedades: informe?.novedades ?? null,
    lectura: informe?.lectura ?? null,
  };
}

export async function getInformeSquad(squadId: number, date: string): Promise<InformeSquadView | null> {
  const squad = await prisma.squad.findUnique({ where: { id: squadId } });
  if (!squad) return null;

  const historia = await getHistory(squadId); // orden ascendente por fecha_referencia
  const trend: TrendPoint[] = historia.map((h) => ({
    semanaInicio: h.semanaInicio,
    deliveryPct: h.deliveryRealPct,
    discoveryPct: h.discoveryRealPct,
    esperadoPct: h.esperadoPct,
  }));
  const ultima = trend.at(-1) ?? null;
  const previa = trend.length >= 2 ? trend[trend.length - 2] : null;
  const semanaInicio = ultima?.semanaInicio ?? null;

  const [pases, informe, upcoming, intake, needs, bloqueos] = await Promise.all([
    pasesProduccion(date, { squadId }),
    semanaInicio
      ? prisma.informeSquadSemanal.findUnique({
          where: { squadId_semanaInicio: { squadId, semanaInicio: new Date(semanaInicio) } },
        })
      : Promise.resolve(null),
    semanaInicio
      ? prisma.upcomingDelivery.findMany({ where: { squadId, semanaInicio: new Date(semanaInicio) } })
      : Promise.resolve([]),
    semanaInicio
      ? prisma.unplannedIntake.findMany({ where: { squadId, semanaInicio: new Date(semanaInicio) } })
      : Promise.resolve([]),
    prisma.need.findMany({ where: { squadId, resuelto: false } }),
    // Bloqueos: Risk.tipo='bloqueo' activos vinculados al squad (aparte de los
    // riesgos), surfaceados prominentes en el informe.
    prisma.risk.findMany({
      where: { tipo: 'bloqueo', resuelto: false, squads: { some: { squadId } } },
    }),
  ]);

  const ultimoSnap = historia.at(-1) ?? null;

  return {
    squadId,
    squadNombre: squad.nombre,
    semanaInicio,
    informeId: informe?.id ?? null,
    semaforo: ultimoSnap ? (ultimoSnap.semaforo as Semaforo) : null,
    datosDe: ultimoSnap?.fechaReferencia ?? null,
    kpis: {
      deliveryPromedio: ultima?.deliveryPct ?? null,
      discoveryPromedio: ultima?.discoveryPct ?? null,
      esperadoPct: ultima?.esperadoPct ?? 0,
      discoveryDeltaSemanaAnterior: deltaDiscovery(ultima, previa),
      pasesProduccion: pases,
      pasesPlanificados: informe?.pasesPlanificados ?? null,
    },
    trend,
    narrativa: {
      novedades: informe?.novedades ?? null,
      pasesProduccion: informe?.pasesProduccion ?? null,
      despriorizaciones: informe?.despriorizaciones ?? null,
      pasesPlanificados: informe?.pasesPlanificados ?? null,
    },
    proximasEntregas: upcoming.map((u) => ({
      id: u.id,
      descripcion: u.descripcion,
      fechaEstimada: iso(u.fechaEstimada),
    })),
    ingresosNoPlanificados: intake.map((u) => ({ id: u.id, descripcion: u.descripcion })),
    needs: needs.map((n) => ({ id: n.id, descripcion: n.descripcion, dueno: n.dueno, resuelto: n.resuelto })),
    bloqueos: bloqueos.map((r) => ({
      id: r.id,
      descripcion: r.descripcion,
      severidad: r.severidad,
      dueno: r.dueno,
      accionProxima: r.accionProxima,
      checkpoint: r.checkpoint,
    })),
  };
}

function deltaDiscovery(ultima: TrendPoint | null, previa: TrendPoint | null): number | null {
  if (!ultima || ultima.discoveryPct === null || !previa || previa.discoveryPct === null) return null;
  return ultima.discoveryPct - previa.discoveryPct;
}
