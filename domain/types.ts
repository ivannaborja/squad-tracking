export interface Risk {
  categoriaImpacto: string;
  resuelto: boolean;
  semanaInicio: string; // formato YYYY-MM-DD
  semanaFin: string;
}

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
  discoveryRealPct: number;
  deliveryManualOverride: boolean;
  discoveryManualOverride: boolean;
  esperadoPct: number;
  deliveryDeltaPct: number;
  discoveryDeltaPct: number;
  semaforo: Semaforo;
  frasePronostico: string | null;
  editadoPor: string;
}