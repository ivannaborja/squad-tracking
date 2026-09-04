export type Semaforo = 'rojo' | 'amarillo' | 'verde';

// El modelo canónico de la fila persistida. camelCase en domain/ aunque en la
// tabla viva en snake_case. Los adaptadores producen esto; nunca dejan salir un
// CSV ni un JSON de Smartsheet hacia services/report.
export interface SquadSnapshot {
  squadId: number;
  semanaInicio: string; // YYYY-MM-DD, agrupa la semana
  fechaReferencia: string; // YYYY-MM-DD, el día real del check-in
  trimestre: string;
  deliveryRealPct: number; // fracción 0–1
  // Nullable: un squad solo-delivery (ej. Empresas, sin nodo Discovery en
  // Smartsheet) no tiene discovery. Un null honesto, no un 0 que fingiría brecha.
  discoveryRealPct: number | null;
  deliveryManualOverride: boolean;
  discoveryManualOverride: boolean;
  esperadoPct: number;
  deliveryDeltaPct: number;
  discoveryDeltaPct: number | null; // null cuando no hay discovery real
  semaforo: Semaforo;
  frasePronostico: string | null;
  editadoPor: string;
}