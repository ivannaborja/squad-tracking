// Un conflicto es un real que el equipo ya corrigió a mano esta semana (su flag
// de override está activo) y que el CSV entrante trae distinto. Sólo esos dos
// campos pueden chocar; el resto (frase, needs, risks) el import nunca los toca.
export interface Conflicto {
  squad_id: number;
  field: 'delivery_real_pct' | 'discovery_real_pct';
  current_manual_value: number;
  incoming_value: number;
}

export interface RealesEntrantes {
  squadId: number;
  deliveryRealPct: number;
  discoveryRealPct: number | null;
}

export interface EstadoActual {
  deliveryRealPct: number;
  deliveryManualOverride: boolean;
  discoveryRealPct: number | null;
  discoveryManualOverride: boolean;
}

export function detectarConflictos(
  entrante: RealesEntrantes,
  actual: EstadoActual | null
): Conflicto[] {
  if (!actual) return [];
  const conflictos: Conflicto[] = [];

  if (actual.deliveryManualOverride && actual.deliveryRealPct !== entrante.deliveryRealPct) {
    conflictos.push({
      squad_id: entrante.squadId,
      field: 'delivery_real_pct',
      current_manual_value: actual.deliveryRealPct,
      incoming_value: entrante.deliveryRealPct,
    });
  }
  // Sólo hay conflicto de discovery si el import trae un valor (los squads
  // solo-delivery llegan con discovery null: no pisan nada, no preguntan).
  if (
    entrante.discoveryRealPct !== null &&
    actual.discoveryManualOverride &&
    actual.discoveryRealPct !== entrante.discoveryRealPct
  ) {
    conflictos.push({
      squad_id: entrante.squadId,
      field: 'discovery_real_pct',
      current_manual_value: actual.discoveryRealPct as number,
      incoming_value: entrante.discoveryRealPct,
    });
  }
  return conflictos;
}

// Clave de una decisión por campo, para cruzar conflictos con lo que el equipo
// aceptó en la fase 2.
export function claveDecision(squadId: number, field: string): string {
  return `${squadId}:${field}`;
}
