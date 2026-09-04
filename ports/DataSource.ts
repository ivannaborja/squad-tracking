import type { SquadSnapshot } from '../domain/types';

// El período del check-in que se está importando. Trae la fecha de referencia
// (día real del check-in, no un jueves asumido) y el trimestre con sus fechas,
// porque el esperado se congela contra esa fecha y ese Q.
export interface Period {
  fechaReferencia: string; // YYYY-MM-DD
  semanaInicio: string; // YYYY-MM-DD
  trimestre: { nombre: string; inicio: string; fin: string };
  editadoPor: string;
}

// La fila de iniciativa que va a la tabla Initiative. Vive en el puerto (no en un
// adaptador puntual) porque es parte del contrato que todo adaptador y el import
// comparten. Muchos campos son nullable: la planilla real tiene huecos honestos
// (filas sin código, sin etapa, sin % o sin fechas cargadas), y el CSV no trae
// `smartsheetRowId`. La identidad del upsert es `smartsheetRowId` cuando existe.
export interface ParsedInitiative {
  squadId: number;
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
  // Trimestre de la iniciativa ("Q3-2026") según su nodo Q ancestro; null si no
  // aplica (CSV, o fila sin Q ancestro).
  trimestre: string | null;
  semanaInicio: string;
}

// El contrato que separa la capa de informe de la fuente de datos. CSV (plano) y
// Smartsheet (.xlsx jerárquico) hoy; API de Smartsheet después. El mismo test de
// contrato valida a todos, y sumar un adaptador no toca nada aguas abajo.
export interface DataSource {
  fetchSnapshot(period: Period): Promise<SquadSnapshot[]>;
  parseInitiatives(period: Period): ParsedInitiative[];
  // Lo que el adaptador no pudo leer con confianza (o decidió no importar): se
  // reporta en el resumen del import en vez de inventar o clobbear en silencio.
  warnings(): string[];
}
