import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { errorJson } from '../../../../lib/http';

// Consulta del historial de narrativa (Bloque E). Devuelve las últimas 5 versiones
// previas de un campo, de más nueva a más vieja. Sólo lectura: la escritura la hace
// el PATCH del informe (ver lib/narrativeHistory).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tabla = params.get('tabla');
  const id = Number(params.get('id'));
  const campo = params.get('campo');

  if (!tabla || !campo || !Number.isInteger(id)) {
    return errorJson('bad_request', 'faltan tabla, id (entero) y campo', 400);
  }

  const filas = await prisma.narrativeHistory.findMany({
    where: { tabla, registroId: id, campo },
    orderBy: [{ cambiadoEn: 'desc' }, { id: 'desc' }],
    take: 5,
  });

  return NextResponse.json(
    filas.map((f) => ({
      id: f.id,
      valorAnterior: f.valorAnterior,
      valorNuevo: f.valorNuevo,
      cambiadoEn: f.cambiadoEn.toISOString(),
    }))
  );
}
