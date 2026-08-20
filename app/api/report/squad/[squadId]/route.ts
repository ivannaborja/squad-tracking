import { NextRequest, NextResponse } from 'next/server';
import { getSquadReportView } from '../../../../../services/report/reportService';

const hoy = () => new Date().toISOString().slice(0, 10);

// Flujo 1/5: pre-informe de un squad. Calcula en vivo contra ?date sólo el
// esperado/deltas "a hoy"; el color y los deltas congelados salen persistidos.
// No crea ninguna fila.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  const squadId = Number((await params).squadId);
  if (!Number.isInteger(squadId)) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'squadId inválido' } }, { status: 400 });
  }

  const date = request.nextUrl.searchParams.get('date') ?? hoy();
  const view = await getSquadReportView(squadId, date);
  if (!view) {
    return NextResponse.json({ error: { code: 'not_found', message: 'squad inexistente' } }, { status: 404 });
  }
  return NextResponse.json(view, { status: 200 });
}
