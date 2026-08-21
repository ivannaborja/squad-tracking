import { NextRequest, NextResponse } from 'next/server';
import { errorJson } from '../../../../lib/http';
import { descartarImport } from '../../../../services/import/importService';

// Descartar un import sin confirmar. Si no se llama, el staging vence solo por TTL.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const borrado = await descartarImport(token);
  if (!borrado) return errorJson('token_not_found', 'el staging no existe', 404);
  return NextResponse.json({ status: 'discarded' }, { status: 200 });
}
