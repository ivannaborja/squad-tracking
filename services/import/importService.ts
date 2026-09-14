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
  // Fecha de exportación del archivo (workbook.created); null si no la trae. Con
  // ella el import detecta un re-import de una planilla más vieja que la última.
  exportadoEn(): Date | null;
}

type ResultadoImport =
  | { status: 'invalid' }
  // El archivo es más viejo que el último ya importado: no se escribe nada y se
  // piden las dos fechas para que el llamador confirme antes de pisar.
  | { status: 'stale'; archivoCreado: Date; ultimoImport: Date }
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
export async function procesarImport(
  source: FuenteMetricas,
  editadoPor: string,
  // El import ignora la fecha del archivo (siempre escribe en la semana de hoy), así
  // que un .xlsx viejo se importaría en silencio pisando datos nuevos. Con `confirmar`
  // en false frenamos si el export es más viejo que el último ya cargado; en true el
  // llamador ya aceptó el aviso y se escribe igual.
  { confirmar = false }: { confirmar?: boolean } = {}
): Promise<ResultadoImport> {
  const period = periodoDeHoy(editadoPor);

  let metricas: MetricasSquad[];
  let initiatives: ParsedInitiative[];
  let warnings: string[];
  let exportadoEn: Date | null;
  try {
    metricas = source.fetchMetricas(period);
    initiatives = source.parseInitiatives(period);
    warnings = source.warnings();
    exportadoEn = source.exportadoEn();
  } catch {
    return { status: 'invalid' };
  }

  // Guard de re-import viejo: se compara la fecha de exportación del archivo contra
  // el máximo ya guardado. Si el archivo no trae fecha, o es el primer import, o el
  // usuario ya confirmó, no aplica.
  if (!confirmar && exportadoEn) {
    const { _max } = await prisma.squadSnapshot.aggregate({ _max: { archivoCreado: true } });
    const ultimoImport = _max.archivoCreado;
    if (ultimoImport && exportadoEn < ultimoImport) {
      return { status: 'stale', archivoCreado: exportadoEn, ultimoImport };
    }
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
      // Sella la fila con la fecha del archivo que la escribió; alimenta el MAX que
      // el guard compara en el próximo import.
      archivoCreado: exportadoEn,
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
