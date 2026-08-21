import { NextRequest, NextResponse } from 'next/server';
import { getOverview } from '../../../../services/report/reportService';
import { hoyISO } from '../../../../lib/dates';

// Flujo 6: comparativo de los 8 squads. Cada fila trae su color persistido, los
// deltas congelados, la frase y el bloque a_hoy, más su datos_de para ver de un
// vistazo si algún squad arrastra reales viejos. No persiste.
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? hoyISO();
  const overview = await getOverview(date);
  return NextResponse.json(overview, { status: 200 });
}
