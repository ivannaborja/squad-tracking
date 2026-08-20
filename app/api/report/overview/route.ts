import { NextRequest, NextResponse } from 'next/server';
import { getOverview } from '../../../../services/report/reportService';

const hoy = () => new Date().toISOString().slice(0, 10);

// Flujo 6: comparativo de los 8 squads. Cada fila trae su color persistido, los
// deltas congelados, la frase y el bloque a_hoy, más su datos_de para ver de un
// vistazo si algún squad arrastra reales viejos. No persiste.
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? hoy();
  const overview = await getOverview(date);
  return NextResponse.json(overview, { status: 200 });
}
