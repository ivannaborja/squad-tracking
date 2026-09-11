import { prisma } from '../../lib/prisma';
import type { Period, ParsedInitiative } from '../../ports/DataSource';
import type { MetricasSquad } from '../../adapters/smartsheet/SmartsheetDataSource';
import { hoyISO, inicioDeSemana } from '../../lib/dates';
import { resolverTrimestre, trimestreDeFecha } from '../report/quarters';

// La fuente que el import de métricas necesita. El .xlsx de Smartsheet expone las
// 4 métricas del Q (fetchMetricas); el CSV plano no tiene ese desglose, así que ya
// no alimenta el snapshot. Se pide por estructura para no acoplar a la clase.
export interface FuenteMetricas {
  fetchMetricas(period: Period): MetricasSquad[];
  parseInitiatives(period: Period): ParsedInitiative[];
  warnings(): string[];
}

type ResultadoImport =
  | { status: 'invalid' }
  | {
      status: 'applied';
      summary: { squads_updated: number; initiatives_upserted: number };
      warnings: string[];
    };

// El import cuenta como un check-in: usa la fecha de hoy y el Q del calendario.
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

const fecha = (iso: string | null | undefined) => (iso ? new Date(iso) : null);

// Espejo fiel del Smartsheet: el import escribe SIEMPRE lo que trae la planilla,
// sin edición manual ni confirmación de conflictos. Guarda por métrica el %real y
// las fechas del nodo; el esperado/desvío/color se derivan al leer. La frase de
// pronóstico no se toca en el update (no va en `datos`, Prisma la deja intacta).
export async function procesarImport(source: FuenteMetricas, editadoPor: string): Promise<ResultadoImport> {
  const period = periodoDeHoy(editadoPor);

  let metricas: MetricasSquad[];
  let initiatives: ParsedInitiative[];
  let warnings: string[];
  try {
    metricas = source.fetchMetricas(period);
    initiatives = source.parseInitiatives(period);
    warnings = source.warnings();
  } catch {
    return { status: 'invalid' };
  }

  const semanaInicio = new Date(period.semanaInicio);
  for (const m of metricas) {
    const datos = {
      trimestre: period.trimestre.nombre,
      fechaReferencia: new Date(period.fechaReferencia),
      q3TotalReal: m.q3Total.real,
      q3TotalInicio: fecha(m.q3Total.inicio),
      q3TotalFin: fecha(m.q3Total.fin),
      finalizarReal: m.finalizar.real,
      finalizarInicio: fecha(m.finalizar.inicio),
      finalizarFin: fecha(m.finalizar.fin),
      avanzarReal: m.avanzar?.real ?? null,
      avanzarInicio: fecha(m.avanzar?.inicio),
      avanzarFin: fecha(m.avanzar?.fin),
      discoveryReal: m.discovery?.real ?? null,
      discoveryInicio: fecha(m.discovery?.inicio),
      discoveryFin: fecha(m.discovery?.fin),
      editadoPor,
    };
    await prisma.squadSnapshot.upsert({
      where: { squadId_semanaInicio: { squadId: m.squadId, semanaInicio } },
      create: { squadId: m.squadId, semanaInicio, ...datos, frasePronostico: null },
      update: datos,
    });
  }

  for (const i of initiatives) {
    await upsertInitiative(i);
  }

  return {
    status: 'applied',
    summary: { squads_updated: metricas.length, initiatives_upserted: initiatives.length },
    warnings,
  };
}

async function upsertInitiative(i: ParsedInitiative): Promise<void> {
  const data = {
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
    trimestre: i.trimestre,
    semanaInicio: new Date(i.semanaInicio),
  };
  // La identidad es la fila de Smartsheet: con ella se hace upsert (misma
  // iniciativa entre semanas). Sin ella (CSV) no hay clave natural → inserta nueva.
  if (i.smartsheetRowId === null) {
    await prisma.initiative.create({ data });
    return;
  }
  await prisma.initiative.upsert({
    where: { squadId_smartsheetRowId: { squadId: i.squadId, smartsheetRowId: i.smartsheetRowId } },
    create: data,
    update: data,
  });
}
