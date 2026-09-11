import { esperadoDesdeFechas } from '../../domain/esperadoFechas';
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
// nada de esto se guarda, se calcula al leer. `delivery` es la métrica "Priorizado
// Finalizar" (lo comprometido que pinta el color); `discovery`, su propio nodo. El
// esperado sale de las fechas del nodo (fórmula del Smartsheet), el desvío es
// real − esperado, y el color del desvío de delivery. Todo puede ser null si falta
// el real o las fechas (hueco honesto).
export interface Derivado {
  deliveryRealPct: number | null;
  discoveryRealPct: number | null;
  esperadoPct: number | null;
  deliveryDeltaPct: number | null;
  discoveryDeltaPct: number | null;
  semaforo: Semaforo | null;
}

export function derivar(snap: PersistedSnapshot, date: string): Derivado {
  const deliveryEsperado = esperadoDesdeFechas(date, snap.finalizar.inicio, snap.finalizar.fin);
  const deliveryRealPct = snap.finalizar.real;
  const deliveryDeltaPct =
    deliveryRealPct !== null && deliveryEsperado !== null ? delta(deliveryRealPct, deliveryEsperado) : null;

  const discoveryRealPct = snap.discovery?.real ?? null;
  const discoveryEsperado = snap.discovery
    ? esperadoDesdeFechas(date, snap.discovery.inicio, snap.discovery.fin)
    : null;
  const discoveryDeltaPct =
    discoveryRealPct !== null && discoveryEsperado !== null ? delta(discoveryRealPct, discoveryEsperado) : null;

  return {
    deliveryRealPct,
    discoveryRealPct,
    esperadoPct: deliveryEsperado,
    deliveryDeltaPct,
    discoveryDeltaPct,
    semaforo: deliveryDeltaPct !== null ? calcSemaforo(deliveryDeltaPct) : null,
  };
}

const AHOY_VACIO: AHoy = { esperadoPct: null, deliveryDeltaPct: null, discoveryDeltaPct: null };
const aHoyDe = (d: Derivado): AHoy => ({
  esperadoPct: d.esperadoPct,
  deliveryDeltaPct: d.deliveryDeltaPct,
  discoveryDeltaPct: d.discoveryDeltaPct,
});

// Un squad en rojo esa semana debería tener al menos un Need activo (SDD, fuente
// real pág. 4). Es advertencia de armado, no bloquea. Need activo = no resuelto
// y de esa misma semana.
export function avisoRojoSinNeed(
  semaforo: Semaforo | null,
  needs: NeedItem[],
  semanaInicio: string | null
): boolean {
  if (semaforo !== 'rojo') return false;
  const hayNeedActivo = needs.some((n) => !n.resuelto && n.semanaInicio === semanaInicio);
  return !hayNeedActivo;
}

// KPI "no planificadas": es el acumulado de UnplannedIntake, no un flag en
// Initiative. El GROUP BY trimestre lo hace la query; acá se cuenta lo que llega.
export function kpiNoPlanificadas(unplannedIntake: UnplannedIntakeItem[]): number {
  return unplannedIntake.length;
}

export function assembleSquadReportView(input: {
  squadId: number;
  squadNombre: string;
  snapshot: PersistedSnapshot | null;
  date: string;
  collections: Collections;
  // Los intakes de portafolio del trimestre (todas las squads): alimentan el KPI
  // acumulado, distinto de collections.unplannedIntake (los de la semana de esta
  // squad, para la sección del pre-informe).
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
          deliveryDeltaPct: d.deliveryDeltaPct,
          discoveryDeltaPct: d.discoveryDeltaPct,
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
          deliveryDeltaPct: null,
          discoveryDeltaPct: null,
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
    frasePronostico: snapshot?.frasePronostico ?? null,
    datosDe: snapshot?.fechaReferencia ?? null,
    aHoy: d ? aHoyDe(d) : AHOY_VACIO,
  };
}
