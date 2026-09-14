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

// Una métrica del Q en curso: el %real que trae la planilla y las fechas de ese
// mismo nodo. Todo nullable porque la planilla tiene huecos honestos (un nodo que
// existe pero sin % o sin fechas cargadas) que preferimos mostrar vacíos.
export interface Metrica {
  real: number | null;
  inicio: string | null;
  fin: string | null;
}

// Las 4 métricas de un squad para el Q en curso. `q3Total` se llama así por el
// caso vigente (Q3) pero representa el Q que elija el período. `avanzar` y
// `discovery` son null cuando el squad no tiene ese nodo (no todos lo tienen).
export interface MetricasSquad {
  squadId: number;
  q3Total: Metrica;
  finalizar: Metrica;
  avanzar: Metrica | null;
  discovery: Metrica | null;
}

// Un squad matcheado con su raíz del árbol: lo mínimo que fetchMetricas necesita
// para caminar los nodos del Q sin recomputar el match.
interface SquadArbol {
  squadId: number;
  raiz: Nodo;
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
  // Delivery comprometido por trimestre ("q3" → 0.63): el % del nodo "Priorizado
  // directorio - Finalizar" dentro de Delivery → Q{n}. El Q a usar lo elige
  // fetchSnapshot según el período. Si falta ese desglose, se cae a deliveryGeneral.
  deliveryPorQ: Record<string, number>;
  deliveryGeneral: number;
  discoveryRealPct: number | null;
}

// Iniciativa ya resuelta salvo lo que depende del período del import: la semana y
// el año del trimestre. `quarterNode` es el Q del árbol ("Q3") sin año; el año lo
// pone parseInitiatives para armar el trimestre final ("Q3-2026").
type PreInitiative = Omit<ParsedInitiative, 'semanaInicio' | 'trimestre'> & { quarterNode: string | null };

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

// Una fila es una iniciativa si su Código Ética (col A) tiene formato de código:
// letras + números (ej. "IBD055"). Las subtareas/fases lo dejan vacío. Se usa el
// FORMATO y no el prefijo "IBD" a propósito, para tolerar que el prefijo cambie de
// un trimestre a otro (lo aclaró la usuaria).
const esCodigoIniciativa = (codigo: string): boolean => /^[A-Za-z]+\d+$/.test(codigo.trim());

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
    private readonly avisos: string[],
    // El árbol crudo y los squads matcheados: fetchMetricas los recorre al vuelo
    // porque el Q a extraer depende del período, no del momento del parseo.
    private readonly nodos: Nodo[],
    private readonly arboles: SquadArbol[]
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
    const arboles: SquadArbol[] = [];
    const matcheados = new Set<number>();

    // Los squads son las filas raíz (sin Padre), menos el molde "Plantilla squads".
    const raices = nodos.filter((n) => n.padre === '' && normalizar(n.nombre) !== TEMPLATE);
    for (const raiz of raices) {
      const squadId = idPorNombre.get(normalizar(raiz.nombre));
      if (squadId === undefined) {
        avisos.push(`Squad de la planilla sin correspondencia en el sistema: "${raiz.nombre}".`);
        continue;
      }

      // Se registra el árbol apenas hay match, aparte del snapshot: las métricas
      // se quieren para todo squad matcheado aunque después el snapshot se omita
      // por no poder leer el % general.
      arboles.push({ squadId, raiz });

      // Sólo hijos DIRECTOS: una iniciativa con "delivery" en el nombre, más abajo
      // en el árbol, no debe confundirse con el nodo Delivery del squad.
      const hijos = nodos.filter((n) => n.padre === raiz.id);
      const deliveryNode = hijos.find((n) => /delivery/.test(normalizar(n.nombre)));
      const discoveryNode = hijos.find((n) => /discovery/.test(normalizar(n.nombre)));

      // Delivery general (fallback): del nodo Delivery si existe; si no (Empresas),
      // del top-level. Es lo que se usa cuando el squad no tiene desglose por Q.
      const deliveryGeneral = deliveryNode ? deliveryNode.completo : raiz.completo;
      if (deliveryGeneral === null) {
        avisos.push(`No se pudo leer el % de delivery de "${raiz.nombre}": se omite el squad.`);
        continue;
      }

      // Comprometido por Q: Delivery → Q{n} → "Priorizado directorio - Finalizar".
      // Ese nodo es el delivery COMPROMETIDO de ese trimestre (no el agregado de
      // todos los Q ni el "No planificado"). Si un Q no tiene ese nodo, se aproxima
      // con el % del Q entero.
      const deliveryPorQ: Record<string, number> = {};
      if (deliveryNode) {
        const qNodes = nodos.filter((n) => n.padre === deliveryNode.id && /^q[1-4]$/.test(normalizar(n.nombre)));
        for (const q of qNodes) {
          const finalizar = nodos.find(
            (n) => n.padre === q.id && normalizar(n.nombre).includes('priorizado') && normalizar(n.nombre).includes('finalizar')
          );
          const val = finalizar?.completo ?? q.completo;
          if (val !== null) deliveryPorQ[normalizar(q.nombre)] = val;
        }
      }
      if (deliveryNode && Object.keys(deliveryPorQ).length === 0) {
        avisos.push(`"${raiz.nombre}": sin desglose de delivery por Q; se usa el % general del Delivery.`);
      }

      // Discovery: del nodo Discovery si existe; si no, null (solo-delivery válido).
      // No se desglosa por Q (decisión de negocio): se usa el nodo general.
      let discoveryRealPct: number | null = null;
      if (discoveryNode) {
        discoveryRealPct = discoveryNode.completo;
        if (discoveryRealPct === null) {
          avisos.push(`No se pudo leer el % de discovery de "${raiz.nombre}": queda vacío.`);
        }
      }

      squads.push({ squadId, deliveryPorQ, deliveryGeneral, discoveryRealPct });
      matcheados.add(squadId);
    }

    // Squads del sistema que no aparecieron en la planilla: se avisan (no se pisan
    // con nada), para que el hueco sea visible en vez de silencioso.
    for (const s of squadRefs) {
      if (!matcheados.has(s.id)) {
        avisos.push(`Squad del sistema sin fila en la planilla: "${s.nombre}".`);
      }
    }

    // Iniciativas: las filas con Código Ética (col A), a cualquier profundidad. Una
    // iniciativa siempre tiene código (ej. "IBD055"); las subtareas/fases no. Esto
    // reemplaza al viejo filtro por la casilla "Portafolio", que se perdía iniciativas
    // con código pero sin ese tilde. Su squad es la raíz del árbol; su identidad, el
    // Identificador de la fila (col V). Las que cuelgan de una raíz sin correspondencia
    // (ej. el molde) se omiten con aviso, no se inventan.
    const initiatives: PreInitiative[] = [];
    let omitidas = 0;
    const deColuna = nodos.filter((n) => esCodigoIniciativa(n.codigo));
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
        // Se conserva el tilde real de Portafolio (col C) como metadato; ya no define
        // qué se importa (eso lo decide el código).
        portafolio: n.portafolio,
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
        // Q ancestro en el árbol ("Q3"), para acotar los pases a producción al Q.
        quarterNode: quarterDe(n, porId),
      });
    }
    avisos.push(
      `Iniciativas detectadas (con código): ${deColuna.length} (importadas: ${initiatives.length}` +
        (omitidas > 0 ? `, omitidas sin squad: ${omitidas}` : '') +
        ').'
    );

    return new SmartsheetDataSource(squads, initiatives, avisos, nodos, arboles);
  }

  async fetchSnapshot(period: Period): Promise<SquadSnapshot[]> {
    const esperado = esperadoPct(period.fechaReferencia, {
      inicio: period.trimestre.inicio,
      fin: period.trimestre.fin,
    });

    // "Q3-2026" → "q3": el trimestre cuyo comprometido corresponde a este import.
    const q = normalizar(period.trimestre.nombre.split('-')[0]);

    return this.squads.map((s) => {
      // Delivery comprometido del Q en curso; si el squad no tiene ese desglose,
      // el % general del Delivery.
      const deliveryRealPct = s.deliveryPorQ[q] ?? s.deliveryGeneral;
      const deliveryDeltaPct = delta(deliveryRealPct, esperado);
      const discoveryDeltaPct = s.discoveryRealPct === null ? null : delta(s.discoveryRealPct, esperado);
      return {
        squadId: s.squadId,
        semanaInicio: period.semanaInicio,
        fechaReferencia: period.fechaReferencia,
        trimestre: period.trimestre.nombre,
        deliveryRealPct,
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
    // El año del trimestre sale del período ("Q3-2026" → "2026"); el Q, del árbol.
    const anio = period.trimestre.nombre.split('-')[1] ?? '';
    return this.initiatives.map(({ quarterNode, ...i }) => ({
      ...i,
      trimestre: quarterNode ? `${quarterNode}-${anio}` : null,
      semanaInicio: period.semanaInicio,
    }));
  }

  // Las 4 métricas por squad del Q en curso, cada una con su %real y sus fechas.
  // Aditivo respecto a fetchSnapshot: éste devuelve un delivery agregado; acá se
  // exponen los nodos crudos (Q entero, Finalizar, Avanzar, Discovery) tal como
  // los carga la planilla, para pintarlos por separado.
  fetchMetricas(period: Period): MetricasSquad[] {
    // "Q3-2026" → "q3": el trimestre que este import representa.
    const q = normalizar(period.trimestre.nombre.split('-')[0]);

    // Un nodo → su métrica; el hueco (nodo ausente) se representa con todo null
    // para que el vacío sea visible en vez de inventarse un 0.
    const metricaDe = (n: Nodo | undefined): Metrica =>
      n ? { real: n.completo, inicio: n.fechaInicio, fin: n.fechaFin } : { real: null, inicio: null, fin: null };

    return this.arboles.map(({ squadId, raiz }) => {
      const hijosRaiz = this.nodos.filter((n) => n.padre === raiz.id);

      // El Q puede colgar de un nodo "Delivery" o directo de la raíz (caso
      // Empresas, sin ese contenedor intermedio).
      const deliveryNode = hijosRaiz.find((n) => normalizar(n.nombre).includes('delivery'));
      const contenedorQ = deliveryNode ?? raiz;
      const qNode = this.nodos.find((n) => n.padre === contenedorQ.id && normalizar(n.nombre) === q);

      // Discovery cuelga siempre de la raíz (no se desglosa por Q); null si no está.
      const discoveryNode = hijosRaiz.find((n) => normalizar(n.nombre).includes('discovery'));
      const discovery = discoveryNode ? metricaDe(discoveryNode) : null;

      if (!qNode) {
        this.avisos.push(`"${raiz.nombre}": no se encontró el nodo ${q.toUpperCase()}; sus métricas del Q quedan vacías.`);
        return { squadId, q3Total: metricaDe(undefined), finalizar: metricaDe(undefined), avanzar: null, discovery };
      }

      const hijosQ = this.nodos.filter((n) => n.padre === qNode.id);

      // Finalizar: el "Priorizado … Finalizar". Si NINGÚN hijo dice "finalizar"
      // pero hay un "Priorizado …" (Empresas: "Priorizado por el directorio"),
      // ése hace de finalizar.
      let finalizar = hijosQ.find(
        (n) => normalizar(n.nombre).startsWith('priorizado') && normalizar(n.nombre).includes('finalizar')
      );
      if (!finalizar && !hijosQ.some((n) => normalizar(n.nombre).includes('finalizar'))) {
        finalizar = hijosQ.find((n) => normalizar(n.nombre).startsWith('priorizado'));
      }
      if (!finalizar) {
        this.avisos.push(`"${raiz.nombre}": ${q.toUpperCase()} sin nodo "Priorizado … Finalizar"; esa métrica queda vacía.`);
      }

      // Avanzar: el "Priorizado … Avanzar"; null si el squad no lo tiene.
      const avanzarNode = hijosQ.find(
        (n) => normalizar(n.nombre).startsWith('priorizado') && normalizar(n.nombre).includes('avanzar')
      );

      return {
        squadId,
        q3Total: metricaDe(qNode),
        finalizar: metricaDe(finalizar),
        avanzar: avanzarNode ? metricaDe(avanzarNode) : null,
        discovery,
      };
    });
  }

  warnings(): string[] {
    // Sin duplicados: fetchMetricas agrega sus avisos al leer, así que una llamada
    // repetida no debe inflar el resumen del import con el mismo mensaje dos veces.
    return Array.from(new Set(this.avisos));
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

// El trimestre de una iniciativa según su nodo Q ancestro ("Q3"), o null si no
// cuelga de ningún Q (ej. algunas ramas de Discovery).
function quarterDe(nodo: Nodo, porId: Map<string, Nodo>): string | null {
  let cur = nodo;
  const visto = new Set<string>();
  while (cur.padre && porId.has(cur.padre) && !visto.has(cur.id)) {
    visto.add(cur.id);
    cur = porId.get(cur.padre)!;
    const m = /^q([1-4])$/.exec(normalizar(cur.nombre));
    if (m) return `Q${m[1]}`;
  }
  return null;
}
