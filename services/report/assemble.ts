import { esperadoDesdeFechas } from '../../domain/esperadoFechas';
import { esperadoPct } from '../../domain/esperadoPct';
import { resolverTrimestre, trimestreDeFecha } from './quarters';
import { delta } from '../../domain/delta';
import { semaforo as calcSemaforo } from '../../domain/semaforo';
import type { Semaforo } from '../../domain/types';
import type {
  AHoy,
  Collections,
  NeedItem,
  PersistedSnapshot,
  SnapshotView,
  SquadReportView,
  SquadReportViewCompact,
  UnplannedIntakeItem,
} from './types';

// Los valores mostrables derivados de un snapshot contra una fecha. Espejo fiel:
// nada de esto se guarda. `delivery` = "Priorizado Finalizar" (el comprometido).
// Hay DOS esperados:
//  - del Q: días de calendario del trimestre (como la bitácora de Dai). Es el que
//    define el desvío oficial y el COLOR, e igual para delivery y discovery.
//  - priorizado: por las fechas del nodo Finalizar (Smartsheet %Avance Esperado),
//    distinto por squad. Dato informativo del comprometido, no define el color.
export interface Derivado {
  deliveryRealPct: number | null;
  discoveryRealPct: number | null;
  esperadoPct: number | null; // del Q
  esperadoPriorizadoPct: number | null; // por fechas del Finalizar
  deliveryDeltaPct: number | null; // vs Q (define el color)
  discoveryDeltaPct: number | null; // vs Q
  deliveryDeltaPriorizadoPct: number | null; // vs priorizado (extra)
  semaforo: Semaforo | null;
}

export function derivar(snap: PersistedSnapshot, date: string): Derivado {
  // El Q del calendario de la fecha (Dai reporta contra el avance del trimestre).
  const q = resolverTrimestre(trimestreDeFecha(date));
  const esperadoQ = esperadoPct(date, { inicio: q.inicio, fin: q.fin });
  const esperadoPriorizado = esperadoDesdeFechas(date, snap.finalizar.inicio, snap.finalizar.fin);

  const deliveryRealPct = snap.finalizar.real;
  const discoveryRealPct = snap.discovery?.real ?? null;

  const deliveryDeltaPct = deliveryRealPct !== null ? delta(deliveryRealPct, esperadoQ) : null;
  const discoveryDeltaPct = discoveryRealPct !== null ? delta(discoveryRealPct, esperadoQ) : null;
  const deliveryDeltaPriorizadoPct =
    deliveryRealPct !== null && esperadoPriorizado !== null ? delta(deliveryRealPct, esperadoPriorizado) : null;

  return {
    deliveryRealPct,
    discoveryRealPct,
    esperadoPct: esperadoQ,
    esperadoPriorizadoPct: esperadoPriorizado,
    deliveryDeltaPct,
    discoveryDeltaPct,
    deliveryDeltaPriorizadoPct,
    semaforo: deliveryDeltaPct !== null ? calcSemaforo(deliveryDeltaPct) : null,
  };
}

const AHOY_VACIO: AHoy = {
  esperadoPct: null,
  esperadoPriorizadoPct: null,
  deliveryDeltaPct: null,
  discoveryDeltaPct: null,
  deliveryDeltaPriorizadoPct: null,
};
const aHoyDe = (d: Derivado): AHoy => ({
  esperadoPct: d.esperadoPct,
  esperadoPriorizadoPct: d.esperadoPriorizadoPct,
  deliveryDeltaPct: d.deliveryDeltaPct,
  discoveryDeltaPct: d.discoveryDeltaPct,
  deliveryDeltaPriorizadoPct: d.deliveryDeltaPriorizadoPct,
});

// Un squad en rojo esa semana debería tener al menos un Need activo (SDD, fuente
// real pág. 4). Es advertencia de armado, no bloquea.
export function avisoRojoSinNeed(
  semaforo: Semaforo | null,
  needs: NeedItem[],
  semanaInicio: string | null
): boolean {
  if (semaforo !== 'rojo') return false;
  const hayNeedActivo = needs.some((n) => !n.resuelto && n.semanaInicio === semanaInicio);
  return !hayNeedActivo;
}

// KPI "no planificadas": el acumulado de UnplannedIntake. El GROUP BY trimestre lo
// hace la query; acá se cuenta lo que llega.
export function kpiNoPlanificadas(unplannedIntake: UnplannedIntakeItem[]): number {
  return unplannedIntake.length;
}

export function assembleSquadReportView(input: {
  squadId: number;
  squadNombre: string;
  snapshot: PersistedSnapshot | null;
  date: string;
  collections: Collections;
  unplannedTrimestre: UnplannedIntakeItem[];
}): SquadReportView {
  const { squadId, squadNombre, snapshot, date, collections, unplannedTrimestre } = input;

  const d = snapshot ? derivar(snapshot, date) : null;
  const snapshotView: SnapshotView =
    snapshot && d
      ? {
          semaforo: d.semaforo,
          deliveryRealPct: d.deliveryRealPct,
          discoveryRealPct: d.discoveryRealPct,
          esperadoPct: d.esperadoPct,
          esperadoPriorizadoPct: d.esperadoPriorizadoPct,
          deliveryDeltaPct: d.deliveryDeltaPct,
          discoveryDeltaPct: d.discoveryDeltaPct,
          deliveryDeltaPriorizadoPct: d.deliveryDeltaPriorizadoPct,
          trimestre: snapshot.trimestre,
          semanaInicio: snapshot.semanaInicio,
          frasePronostico: snapshot.frasePronostico,
          editadoPor: snapshot.editadoPor,
        }
      : {
          semaforo: null,
          deliveryRealPct: null,
          discoveryRealPct: null,
          esperadoPct: null,
          esperadoPriorizadoPct: null,
          deliveryDeltaPct: null,
          discoveryDeltaPct: null,
          deliveryDeltaPriorizadoPct: null,
          trimestre: null,
          semanaInicio: null,
          frasePronostico: null,
          editadoPor: null,
        };

  return {
    squadId,
    squadNombre,
    snapshot: snapshotView,
    datosDe: snapshot?.fechaReferencia ?? null,
    aHoy: d ? aHoyDe(d) : AHOY_VACIO,
    avisoRojoSinNeed: avisoRojoSinNeed(snapshotView.semaforo, collections.needs, snapshotView.semanaInicio),
    kpiNoPlanificadas: kpiNoPlanificadas(unplannedTrimestre),
    collections,
  };
}

export function assembleCompact(input: {
  squadId: number;
  squadNombre: string;
  snapshot: PersistedSnapshot | null;
  date: string;
}): SquadReportViewCompact {
  const { squadId, squadNombre, snapshot, date } = input;
  const d = snapshot ? derivar(snapshot, date) : null;
  return {
    squadId,
    squadNombre,
    semaforo: d?.semaforo ?? null,
    deliveryRealPct: d?.deliveryRealPct ?? null,
    discoveryRealPct: d?.discoveryRealPct ?? null,
    deliveryDeltaPct: d?.deliveryDeltaPct ?? null,
    discoveryDeltaPct: d?.discoveryDeltaPct ?? null,
    deliveryDeltaPriorizadoPct: d?.deliveryDeltaPriorizadoPct ?? null,
    frasePronostico: snapshot?.frasePronostico ?? null,
    datosDe: snapshot?.fechaReferencia ?? null,
    aHoy: d ? aHoyDe(d) : AHOY_VACIO,
  };
}
