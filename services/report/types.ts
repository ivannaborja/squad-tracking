import type { Semaforo } from '../../domain/types';

// Los calculados recomputados en vivo contra la fecha pedida. Van SEPARADOS de
// los persistidos: son cuenta de fechas, no el color oficial (ver SDD/api.md).
export interface AHoy {
  esperadoPct: number;
  // null cuando el squad no tiene reales cargados todavía: sin real no hay brecha.
  deliveryDeltaPct: number | null;
  discoveryDeltaPct: number | null;
}

// La fila persistida ya normalizada (fechas en ISO string), como la pasa
// reportService al ensamblador puro.
export interface PersistedSnapshot {
  semaforo: import('../../domain/types').Semaforo;
  deliveryRealPct: number;
  discoveryRealPct: number;
  esperadoPct: number;
  deliveryDeltaPct: number;
  discoveryDeltaPct: number;
  trimestre: string;
  semanaInicio: string;
  fechaReferencia: string;
  frasePronostico: string | null;
  editadoPor: string;
}

// Colecciones tal como las consume el pre-informe. Fechas ya en ISO string.
// El `id` va en cada item para que la UI de escritura pueda editar/resolver/quitar
// una fila puntual (PATCH/DELETE /api/{entidad}/{id}); las lecturas lo ignoran.
export interface RiskItem {
  id: number;
  descripcion: string;
  categoriaImpacto: string;
  severidad: string;
  dueno: string;
  accionProxima: string;
  checkpoint: string;
  tipo: string;
  semanaInicio: string;
  semanaFin: string;
  resuelto: boolean;
  // Todos los squads que el riesgo afecta (RiskSquad), para reasignar desde el form.
  squadIds: number[];
}
export interface NeedItem {
  id: number;
  descripcion: string;
  dueno: string;
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
  codigoExterno: string | null;
  nombre: string;
  tipo: string;
  estado: string;
  pctAvance: number;
  fechaInicio: string;
  fechaFin: string;
  semanaInicio: string;
}
export interface UnplannedIntakeItem {
  id: number;
  descripcion: string;
  semanaInicio: string;
}
export interface ActionPlanItem {
  id: number;
  descripcion: string;
  dueno: string;
  plazo: string;
  estado: string;
  semanaInicio: string;
  resuelto: boolean;
}

export interface Collections {
  risks: RiskItem[];
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
  esperadoPct: number | null;
  deliveryDeltaPct: number | null;
  discoveryDeltaPct: number | null;
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
  actionPlans: ActionPlanItem[]; // de portafolio, no del squad
}

// La proyección resumida del comparativo (sin colecciones completas).
export interface SquadReportViewCompact {
  squadId: number;
  squadNombre: string;
  semaforo: Semaforo | null;
  deliveryDeltaPct: number | null;
  discoveryDeltaPct: number | null;
  frasePronostico: string | null;
  datosDe: string | null;
  aHoy: AHoy;
}
