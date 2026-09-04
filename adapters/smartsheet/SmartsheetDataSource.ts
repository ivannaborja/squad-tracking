import ExcelJS from 'exceljs';
import type { DataSource, Period, ParsedInitiative } from '../../ports/DataSource';
import type { SquadSnapshot } from '../../domain/types';
import { esperadoPct } from '../../domain/esperadoPct';
import { delta } from '../../domain/delta';
import { semaforo as calcSemaforo } from '../../domain/semaforo';

// Adaptador del export real de Smartsheet (.xlsx). A diferencia del CSV (plano, ya
// reprocesado), acá llega la planilla jerárquica: cada squad es una fila raíz y
// abajo cuelgan los nodos Delivery/Discovery cuyo `% Completo` son los reales.
// Produce dos cosas: los snapshots de squad (de los nodos Delivery/Discovery) y
// las iniciativas de portafolio (las filas con Portafolio=true, a cualquier
// profundidad del árbol), identificadas por el "Identificador de la fila".

// Columnas (1-based) confirmadas leyendo el archivo real. Si el export cambia de
// forma, acá es donde se reajusta.
const COL = {
  codigo: 1, // A — Codigo Etica (IBD…), informativo, se repite entre filas
  portafolio: 3, // C — Portafolio (booleano)
  nombre: 5, // E — Nombre de Iniciativa
  fechaInicio: 8, // H — Fecha de Inicio
  fechaFin: 9, // I — Fecha de Finalización (planificada)
  etapa: 12, // L — Etapa ("Despliegue", …)
  completo: 13, // M — % Completo (fracción 0–1)
  fechaFinReal: 18, // R — Fecha Fin Real
  estado: 20, // T — Estado ("Completo", …)
  filaId: 22, // V — Identificador de la fila (identidad estable)
  padre: 24, // X — Padre (arma el árbol)
} as const;

// El molde vacío que la planilla arrastra arriba de todo: no es un squad real.
const TEMPLATE = 'plantilla squads';

export interface SquadRef {
  id: number;
  nombre: string;
}

interface Nodo {
  id: string;
  nombre: string;
  completo: number | null;
  padre: string;
  codigo: string;
  portafolio: boolean;
  etapa: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaFinReal: string | null;
}

interface SquadReal {
  squadId: number;
  deliveryRealPct: number;
  discoveryRealPct: number | null;
}

// Iniciativa ya resuelta salvo la semana, que la pone el período del import.
type PreInitiative = Omit<ParsedInitiative, 'semanaInicio'>;

// trim + sin acentos + minúsculas + espacios colapsados: para matchear nombres
// que las personas cargan con capitalización y espaciado variables.
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function unwrap(v: unknown): unknown {
  if (v && typeof v === 'object' && 'result' in v) return (v as { result: unknown }).result;
  return v;
}

function cellNum(cell: ExcelJS.Cell): number | null {
  const v = unwrap(cell.value);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function cellText(cell: ExcelJS.Cell): string {
  let v: unknown = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('error' in o) return '';
    if ('result' in o) v = o.result;
    else if ('text' in o) v = o.text;
    else if ('richText' in o) v = (o.richText as { text: string }[]).map((r) => r.text).join('');
  }
  return v == null ? '' : String(v).trim();
}

function cellBool(cell: ExcelJS.Cell): boolean {
  return unwrap(cell.value) === true;
}

// Las fechas del .xlsx llegan como Date (medianoche UTC). Se guardan como
// YYYY-MM-DD; null si la celda está vacía o no es fecha.
function cellDate(cell: ExcelJS.Cell): string | null {
  const v = unwrap(cell.value);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  return null;
}

export class SmartsheetDataSource implements DataSource {
  private constructor(
    private readonly squads: SquadReal[],
    private readonly initiatives: PreInitiative[],
    private readonly avisos: string[]
  ) {}

  // Construcción asíncrona: leer el .xlsx es async, así el resto del contrato
  // (fetchSnapshot/parseInitiatives/warnings) trabaja sobre datos ya resueltos.
  static async fromArrayBuffer(
    buffer: ArrayBuffer | Uint8Array,
    squadRefs: SquadRef[]
  ): Promise<SmartsheetDataSource> {
    const wb = new ExcelJS.Workbook();
    const data = buffer instanceof Uint8Array ? buffer : Buffer.from(buffer);
    // Cast al tipo que declara exceljs: los Buffer de @types/node y los suyos difieren
    // por la genérica ArrayBufferLike; en runtime es el mismo Buffer.
    await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('el .xlsx no tiene ninguna hoja');

    const nodos: Nodo[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const id = cellText(row.getCell(COL.filaId));
      const nombre = cellText(row.getCell(COL.nombre));
      if (id === '' && nombre === '') continue;
      nodos.push({
        id,
        nombre,
        completo: cellNum(row.getCell(COL.completo)),
        padre: cellText(row.getCell(COL.padre)),
        codigo: cellText(row.getCell(COL.codigo)),
        portafolio: cellBool(row.getCell(COL.portafolio)),
        etapa: cellText(row.getCell(COL.etapa)),
        estado: cellText(row.getCell(COL.estado)),
        fechaInicio: cellDate(row.getCell(COL.fechaInicio)),
        fechaFin: cellDate(row.getCell(COL.fechaFin)),
        fechaFinReal: cellDate(row.getCell(COL.fechaFinReal)),
      });
    }

    const porId = new Map(nodos.map((n) => [n.id, n]));
    const idPorNombre = new Map(squadRefs.map((s) => [normalizar(s.nombre), s.id]));

    const squads: SquadReal[] = [];
    const avisos: string[] = [];
    const matcheados = new Set<number>();

    // Los squads son las filas raíz (sin Padre), menos el molde "Plantilla squads".
    const raices = nodos.filter((n) => n.padre === '' && normalizar(n.nombre) !== TEMPLATE);
    for (const raiz of raices) {
      const squadId = idPorNombre.get(normalizar(raiz.nombre));
      if (squadId === undefined) {
        avisos.push(`Squad de la planilla sin correspondencia en el sistema: "${raiz.nombre}".`);
        continue;
      }

      // Sólo hijos DIRECTOS: una iniciativa con "delivery" en el nombre, más abajo
      // en el árbol, no debe confundirse con el nodo Delivery del squad.
      const hijos = nodos.filter((n) => n.padre === raiz.id);
      const deliveryNode = hijos.find((n) => /delivery/.test(normalizar(n.nombre)));
      const discoveryNode = hijos.find((n) => /discovery/.test(normalizar(n.nombre)));

      // Delivery: del nodo Delivery si existe; si no (caso Empresas), del top-level.
      const deliveryRealPct = deliveryNode ? deliveryNode.completo : raiz.completo;
      if (deliveryRealPct === null) {
        avisos.push(`No se pudo leer el % de delivery de "${raiz.nombre}": se omite el squad.`);
        continue;
      }

      // Discovery: del nodo Discovery si existe; si no, null (solo-delivery válido).
      let discoveryRealPct: number | null = null;
      if (discoveryNode) {
        discoveryRealPct = discoveryNode.completo;
        if (discoveryRealPct === null) {
          avisos.push(`No se pudo leer el % de discovery de "${raiz.nombre}": queda vacío.`);
        }
      }

      squads.push({ squadId, deliveryRealPct, discoveryRealPct });
      matcheados.add(squadId);
    }

    // Squads del sistema que no aparecieron en la planilla: se avisan (no se pisan
    // con nada), para que el hueco sea visible en vez de silencioso.
    for (const s of squadRefs) {
      if (!matcheados.has(s.id)) {
        avisos.push(`Squad del sistema sin fila en la planilla: "${s.nombre}".`);
      }
    }

    // Iniciativas de portafolio: las filas con Portafolio=true, a cualquier
    // profundidad. Su squad es la raíz del árbol; su identidad, el Identificador de
    // la fila (col V). Las que cuelgan de una raíz sin correspondencia (ej. el
    // molde) se omiten con aviso, no se inventan.
    const initiatives: PreInitiative[] = [];
    let omitidas = 0;
    const deColuna = nodos.filter((n) => n.portafolio);
    for (const n of deColuna) {
      const raiz = raizDe(n, porId);
      const squadId = idPorNombre.get(normalizar(raiz.nombre));
      if (squadId === undefined) {
        omitidas++;
        continue;
      }
      initiatives.push({
        squadId,
        smartsheetRowId: n.id,
        codigoExterno: n.codigo || null,
        portafolio: true,
        nombre: n.nombre,
        // Discovery si cuelga de un nodo Discovery; delivery en cualquier otro caso
        // (incluida Empresas, solo-delivery, cuyas iniciativas cuelgan de Q2/Q3).
        tipo: tipoDe(n, porId),
        etapa: n.etapa || null,
        estado: n.estado,
        pctAvance: n.completo,
        fechaInicio: n.fechaInicio,
        fechaFin: n.fechaFin,
        fechaFinReal: n.fechaFinReal,
      });
    }
    avisos.push(
      `Iniciativas de portafolio detectadas: ${deColuna.length} (importadas: ${initiatives.length}` +
        (omitidas > 0 ? `, omitidas sin squad: ${omitidas}` : '') +
        ').'
    );

    return new SmartsheetDataSource(squads, initiatives, avisos);
  }

  async fetchSnapshot(period: Period): Promise<SquadSnapshot[]> {
    const esperado = esperadoPct(period.fechaReferencia, {
      inicio: period.trimestre.inicio,
      fin: period.trimestre.fin,
    });

    return this.squads.map((s) => {
      const deliveryDeltaPct = delta(s.deliveryRealPct, esperado);
      const discoveryDeltaPct = s.discoveryRealPct === null ? null : delta(s.discoveryRealPct, esperado);
      return {
        squadId: s.squadId,
        semanaInicio: period.semanaInicio,
        fechaReferencia: period.fechaReferencia,
        trimestre: period.trimestre.nombre,
        deliveryRealPct: s.deliveryRealPct,
        discoveryRealPct: s.discoveryRealPct,
        // El import no es edición manual: los overrides arrancan en false.
        deliveryManualOverride: false,
        discoveryManualOverride: false,
        // Esperado calculado por la app (SDD), no importado de Smartsheet.
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

  parseInitiatives(period: Period): ParsedInitiative[] {
    return this.initiatives.map((i) => ({ ...i, semanaInicio: period.semanaInicio }));
  }

  warnings(): string[] {
    return this.avisos;
  }
}

// La raíz del árbol de un nodo (el squad): sube por Padre hasta el tope.
function raizDe(nodo: Nodo, porId: Map<string, Nodo>): Nodo {
  let cur = nodo;
  const visto = new Set<string>();
  while (cur.padre && porId.has(cur.padre) && !visto.has(cur.id)) {
    visto.add(cur.id);
    cur = porId.get(cur.padre)!;
  }
  return cur;
}

// Tipo de una iniciativa por la rama de la que cuelga: discovery si algún ancestro
// es un nodo Discovery; delivery en cualquier otro caso.
function tipoDe(nodo: Nodo, porId: Map<string, Nodo>): string {
  let cur = nodo;
  const visto = new Set<string>();
  while (cur.padre && porId.has(cur.padre) && !visto.has(cur.id)) {
    visto.add(cur.id);
    cur = porId.get(cur.padre)!;
    if (/discovery/.test(normalizar(cur.nombre))) return 'discovery';
  }
  return 'delivery';
}
