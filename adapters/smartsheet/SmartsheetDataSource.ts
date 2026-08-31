import ExcelJS from 'exceljs';
import type { DataSource, Period, ParsedInitiative } from '../../ports/DataSource';
import type { SquadSnapshot } from '../../domain/types';
import { esperadoPct } from '../../domain/esperadoPct';
import { delta } from '../../domain/delta';
import { semaforo as calcSemaforo } from '../../domain/semaforo';

// Adaptador del export real de Smartsheet (.xlsx). A diferencia del CSV (plano, ya
// reprocesado), acá llega la planilla jerárquica: cada squad es una fila raíz y
// abajo cuelgan los nodos Delivery/Discovery cuyo `% Completo` son los reales.
// Sólo produce los snapshots de squad; las iniciativas quedan diferidas (ver más
// abajo) porque en la planilla los códigos IBD se repiten dentro de un mismo squad
// y chocarían contra la clave única (squadId, codigoExterno).

// Columnas (1-based) confirmadas leyendo el archivo real. Si el export cambia de
// forma, acá es donde se reajusta.
const COL = { codigo: 1, nombre: 5, completo: 13, filaId: 22, padre: 24 } as const;

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
}

interface SquadReal {
  squadId: number;
  deliveryRealPct: number;
  discoveryRealPct: number | null;
}

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

function cellNum(cell: ExcelJS.Cell): number | null {
  let v: unknown = cell.value;
  if (v && typeof v === 'object' && 'result' in v) v = (v as { result: unknown }).result;
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

export class SmartsheetDataSource implements DataSource {
  private constructor(
    private readonly squads: SquadReal[],
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
      });
    }

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

    // Iniciativas diferidas a v1.1: en la planilla los códigos se repiten dentro de
    // un mismo squad (chocan contra la clave única) y cuelgan de nodos intermedios.
    // No se tocan hasta definir su identidad; se reporta el conteo detectado.
    const idsTemplate = descendientesDe(nodos, raizTemplate(nodos));
    const conCodigo = nodos.filter((n) => n.codigo !== '' && !idsTemplate.has(n.id)).length;
    if (conCodigo > 0) {
      avisos.push(
        `Iniciativas no importadas en esta versión: ${conCodigo} filas con código detectadas (se poblarán aparte).`
      );
    }

    return new SmartsheetDataSource(squads, avisos);
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
        // Sin riesgos en la planilla: color base con lista vacía. El write-through
        // lo refresca si luego se vincula un riesgo de ingresos activo.
        semaforo: calcSemaforo(deliveryDeltaPct, [], period.fechaReferencia),
        frasePronostico: null,
        editadoPor: period.editadoPor,
      };
    });
  }

  // Diferidas a v1.1 (ver cabecera): el adaptador xlsx no escribe iniciativas.
  parseInitiatives(): ParsedInitiative[] {
    return [];
  }

  warnings(): string[] {
    return this.avisos;
  }
}

// La fila raíz del molde "Plantilla squads", si está.
function raizTemplate(nodos: Nodo[]): string | null {
  const t = nodos.find((n) => n.padre === '' && normalizar(n.nombre) === TEMPLATE);
  return t ? t.id : null;
}

// Ids de todo el subárbol que cuelga de `raiz` (incluida), por BFS sobre Padre.
function descendientesDe(nodos: Nodo[], raiz: string | null): Set<string> {
  const out = new Set<string>();
  if (raiz === null) return out;
  out.add(raiz);
  const hijosDe = new Map<string, Nodo[]>();
  for (const n of nodos) {
    if (!hijosDe.has(n.padre)) hijosDe.set(n.padre, []);
    hijosDe.get(n.padre)!.push(n);
  }
  const cola = [raiz];
  while (cola.length) {
    const actual = cola.shift()!;
    for (const h of hijosDe.get(actual) ?? []) {
      if (!out.has(h.id)) {
        out.add(h.id);
        cola.push(h.id);
      }
    }
  }
  return out;
}
