import { esperadoPct } from '../../domain/esperadoPct';
import { delta } from '../../domain/delta';
import { semaforo as calcSemaforo } from '../../domain/semaforo';
import type { Risk, Semaforo } from '../../domain/types';
import type { Trimestre } from './quarters';
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

// Esperado y brechas recalculados contra la fecha pedida. Sólo cuenta de fechas:
// no toca el color, que es el persistido. Sin reales todavía, las brechas van null.
export function calcAHoy(
  deliveryRealPct: number | null,
  discoveryRealPct: number | null,
  date: string,
  trimestre: Trimestre
): AHoy {
  const esperado = esperadoPct(date, { inicio: trimestre.inicio, fin: trimestre.fin });
  return {
    esperadoPct: esperado,
    deliveryDeltaPct: deliveryRealPct === null ? null : delta(deliveryRealPct, esperado),
    discoveryDeltaPct: discoveryRealPct === null ? null : delta(discoveryRealPct, esperado),
  };
}

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

// El color oficial se recomputa sólo en escrituras (write-through): confirmar un
// check-in o crear/editar/resolver un riesgo. La regla vive en domain/; acá se la
// llama con los riesgos ya filtrados por squad y la fecha de referencia de la fila.
export function recomputeSemaforo(
  deliveryDeltaPct: number,
  risksDelSquad: Risk[],
  fechaReferencia: string
): Semaforo {
  return calcSemaforo(deliveryDeltaPct, risksDelSquad, fechaReferencia);
}

export function assembleSquadReportView(input: {
  squadId: number;
  squadNombre: string;
  snapshot: PersistedSnapshot | null;
  date: string;
  trimestre: Trimestre; // el Q de la fila (o el del calendario si no hay fila)
  collections: Collections;
  // Los intakes de portafolio del trimestre (todas las squads): alimentan el KPI
  // acumulado, distinto de collections.unplannedIntake (los de la semana de esta
  // squad, para la sección del pre-informe).
  unplannedTrimestre: UnplannedIntakeItem[];
}): SquadReportView {
  const { squadId, squadNombre, snapshot, date, trimestre, collections, unplannedTrimestre } =
    input;

  const snapshotView: SnapshotView = snapshot
    ? {
        semaforo: snapshot.semaforo,
        deliveryRealPct: snapshot.deliveryRealPct,
        discoveryRealPct: snapshot.discoveryRealPct,
        esperadoPct: snapshot.esperadoPct,
        deliveryDeltaPct: snapshot.deliveryDeltaPct,
        discoveryDeltaPct: snapshot.discoveryDeltaPct,
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
    aHoy: calcAHoy(
      snapshot?.deliveryRealPct ?? null,
      snapshot?.discoveryRealPct ?? null,
      date,
      trimestre
    ),
    avisoRojoSinNeed: avisoRojoSinNeed(
      snapshotView.semaforo,
      collections.needs,
      snapshotView.semanaInicio
    ),
    kpiNoPlanificadas: kpiNoPlanificadas(unplannedTrimestre),
    collections,
  };
}

export function assembleCompact(input: {
  squadId: number;
  squadNombre: string;
  snapshot: PersistedSnapshot | null;
  date: string;
  trimestre: Trimestre;
}): SquadReportViewCompact {
  const { squadId, squadNombre, snapshot, date, trimestre } = input;
  return {
    squadId,
    squadNombre,
    semaforo: snapshot?.semaforo ?? null,
    deliveryDeltaPct: snapshot?.deliveryDeltaPct ?? null,
    discoveryDeltaPct: snapshot?.discoveryDeltaPct ?? null,
    frasePronostico: snapshot?.frasePronostico ?? null,
    datosDe: snapshot?.fechaReferencia ?? null,
    aHoy: calcAHoy(
      snapshot?.deliveryRealPct ?? null,
      snapshot?.discoveryRealPct ?? null,
      date,
      trimestre
    ),
  };
}
