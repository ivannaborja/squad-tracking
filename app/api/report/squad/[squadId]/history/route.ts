import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getHistory } from '../../../../../../services/report/reportService';

// Lectura histórica: las filas congeladas del squad en [from, to], sin recalcular
// nada. Es lo que hace usable el historial completo (comparar Q contra Q, ver
// amarillo sostenido). Lista vacía si no hay filas en el rango, no 404.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  const squadId = Number((await params).squadId);
  if (!Number.isInteger(squadId)) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'squadId inválido' } }, { status: 400 });
  }

  const squad = await prisma.squad.findUnique({ where: { id: squadId } });
  if (!squad) {
    return NextResponse.json({ error: { code: 'not_found', message: 'squad inexistente' } }, { status: 404 });
  }

  const from = request.nextUrl.searchParams.get('from') ?? undefined;
  const to = request.nextUrl.searchParams.get('to') ?? undefined;
  const snapshots = await getHistory(squadId, from, to);
  return NextResponse.json({ squad_id: squadId, snapshots }, { status: 200 });
}
