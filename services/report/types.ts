import type { Semaforo } from '../../domain/types';

// Los calculados derivados contra la fecha pedida. Cuenta de fechas del Smartsheet,
// no algo persistido (ver SDD). esperadoPct null cuando la métrica de delivery
// (Finalizar) no tiene fechas cargadas; los deltas null sin real o sin esperado.
export interface AHoy {
  // Esperado del trimestre (días de calendario del Q), como la bitácora de Dai.
  // Es el que define el desvío y el color. Igual para todos los squads.
  esperadoPct: number | null;
  // Esperado del Priorizado Finalizar por sus fechas (Smartsheet %Avance Esperado):
  // distinto por squad. Es dato informativo, no define el color.
  esperadoPriorizadoPct: number | null;
  // Desvíos del comprometido: vs el esperado del Q (el oficial) y vs el priorizado.
  deliveryDeltaPct: number | null;
  discoveryDeltaPct: number | null;
  deliveryDeltaPriorizadoPct: number | null;
}

// Una métrica cruda del Smartsheet tal como se persiste: el %real del nodo y sus
// fechas planificadas. Con esto se deriva el esperado (esperadoDesdeFechas). Todo
// nullable: la métrica puede faltar (hueco) o venir sin fechas.
export interface MetricaPersistida {
  real: number | null;
  inicio: string | null; // YYYY-MM-DD
  fin: string | null;
}

// La fila persistida ya normalizada (fechas en ISO string). Guarda las 4 métricas
// crudas; el esperado/desvío/color NO se guardan, se derivan al leer con la fecha
// pedida (a hoy la fecha real; en el histórico la de la semana).
export interface PersistedSnapshot {
  q3Total: MetricaPersistida;
  finalizar: MetricaPersistida;
  avanzar: MetricaPersistida | null;
  discovery: MetricaPersistida | null;
  trimestre: string;
  semanaInicio: string;
  fechaReferencia: string;
  frasePronostico: string | null;
  editadoPor: string;
}

// Colecciones tal como las consume el pre-informe. Fechas ya en ISO string.
// El `id` va en cada item para que la UI de escritura pueda editar/resolver/quitar
// una fila puntual (PATCH/DELETE /api/{entidad}/{id}); las lecturas lo ignoran.
export interface BloqueoItem {
  id: number;
  descripcion: string;
  severidad: string; // 'ALTA' | 'MEDIA' | 'BAJA'
  desde: string | null;
  hasta: string | null;
  resuelto: boolean;
  notaResolucion: string | null;
  // Todos los squads que el bloqueo afecta (BloqueoSquad), para reasignar desde el form.
  squadIds: number[];
}
export interface NeedItem {
  id: number;
  descripcion: string;
  dueno: string;
  fecha: string;
  estado: string; // 'ABIERTA' | 'MITIGADA_PARCIALMENTE' | 'RESUELTA'
  semanaInicio: string;
  resuelto: boolean;
}
export interface AchievementItem {
  id: number;
  descripcion: string;
  semanaInicio: string;
}
export interface UpcomingDeliveryItem {
  id: number;
  descripcion: string;
  fechaEstimada: string;
  semanaInicio: string;
}
export interface InitiativeItem {
  id: number;
  smartsheetRowId: string | null;
  codigoExterno: string | null;
  portafolio: boolean;
  nombre: string;
  tipo: string;
  etapa: string | null;
  estado: string;
  pctAvance: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaFinReal: string | null;
  semanaInicio: string;
}
export interface UnplannedIntakeItem {
  id: number;
  descripcion: string;
  semanaInicio: string;
}
export interface Collections {
  bloqueos: BloqueoItem[];
  needs: NeedItem[];
  achievements: AchievementItem[];
  upcomingDeliveries: UpcomingDeliveryItem[];
  initiatives: InitiativeItem[];
  unplannedIntake: UnplannedIntakeItem[];
}

// Lo persistido del último check-in. null en cada campo cuando el squad todavía
// no tuvo ningún snapshot (404-sin-fila de api.md).
export interface SnapshotView {
  semaforo: Semaforo | null;
  deliveryRealPct: number | null;
  discoveryRealPct: number | null;
  esperadoPct: number | null; // del Q
  esperadoPriorizadoPct: number | null; // por fechas del Finalizar
  deliveryDeltaPct: number | null; // vs Q
  discoveryDeltaPct: number | null; // vs Q
  deliveryDeltaPriorizadoPct: number | null; // vs priorizado
  trimestre: string | null;
  semanaInicio: string | null;
  frasePronostico: string | null;
  editadoPor: string | null;
}

// El objeto que services/report ensambla al leer. NO se persiste así.
export interface SquadReportView {
  squadId: number;
  squadNombre: string;
  snapshot: SnapshotView;
  datosDe: string | null; // fecha_referencia de la fila leída
  aHoy: AHoy;
  avisoRojoSinNeed: boolean;
  kpiNoPlanificadas: number;
  collections: Collections;
}

// La proyección resumida del comparativo (sin colecciones completas).
export interface SquadReportViewCompact {
  squadId: number;
  squadNombre: string;
  semaforo: Semaforo | null;
  // % comprometido (avance real persistido) del squad, para mostrarlo junto al delta.
  deliveryRealPct: number | null;
  discoveryRealPct: number | null;
  deliveryDeltaPct: number | null; // vs Q
  discoveryDeltaPct: number | null; // vs Q
  deliveryDeltaPriorizadoPct: number | null; // vs priorizado (dato extra)
  frasePronostico: string | null;
  datosDe: string | null;
  aHoy: AHoy;
}
