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

// La fila de iniciativa que va a la tabla Initiative. codigoExterno nullable: el
// Smartsheet real no siempre trae ID. Vive en el puerto (no en un adaptador
// puntual) porque es parte del contrato que todo adaptador y el import comparten.
export interface ParsedInitiative {
  squadId: number;
  codigoExterno: string | null;
  nombre: string;
  tipo: string;
  estado: string;
  pctAvance: number;
  fechaInicio: string;
  fechaFin: string;
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
