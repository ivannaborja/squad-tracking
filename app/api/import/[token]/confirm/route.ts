import { NextRequest, NextResponse } from 'next/server';
import { errorJson } from '../../../../../lib/http';
import { confirmarImport } from '../../../../../services/import/importService';

// Fase 2 del import: el equipo decide por campo cuáles conflictos acepta. Recién
// acá se persiste. Un conflicto omitido se trata como rechazo (default seguro:
// no pisar lo manual sin confirmación explícita), y eso lo resuelve el servicio.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  if (!body?.editado_por) return errorJson('bad_request', 'falta editado_por', 400);

  const resultado = await confirmarImport(token, body.decisions ?? [], body.editado_por);

  if (resultado.status === 'token_not_found') {
    return errorJson('token_not_found', 'el staging no existe, re-subí el CSV', 409);
  }
  if (resultado.status === 'token_expired') {
    return errorJson('token_expired', 'el staging venció, re-subí el CSV', 409);
  }
  return NextResponse.json(resultado, { status: 200 });
}
