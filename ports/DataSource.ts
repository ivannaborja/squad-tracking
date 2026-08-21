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

// El contrato que separa la capa de informe de la fuente de datos. CSV hoy,
// Smartsheet API después: el mismo test de contrato valida a ambos, y sumar el
// segundo adaptador no toca nada aguas abajo.
export interface DataSource {
  fetchSnapshot(period: Period): Promise<SquadSnapshot[]>;
}
