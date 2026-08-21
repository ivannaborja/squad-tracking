import { NextRequest, NextResponse } from 'next/server';
import { errorJson } from './http';

export type Row = Record<string, unknown>;

// Sólo lo mínimo de un delegate de Prisma que la fábrica usa. Los delegates
// concretos se pasan casteados desde cada ruta.
export interface Delegate {
  create(args: { data: Row }): Promise<unknown>;
  update(args: { where: { id: number }; data: Row }): Promise<unknown>;
}

// Las entidades de entrada sin cálculo (needs, achievements, upcoming, intakes,
// planes) comparten el mismo patrón: POST crea, PATCH edita por id. Riesgos y
// snapshot NO pasan por acá porque recomputan el color (write-through).
export function crearEntidad(delegate: Delegate, requeridos: string[], aData: (b: Row) => Row) {
  return async function POST(request: NextRequest) {
    const body = (await request.json()) as Row;
    for (const c of requeridos) {
      if (body?.[c] === undefined || body[c] === null) {
        return errorJson('bad_request', `falta ${c}`, 400);
      }
    }
    const row = await delegate.create({ data: aData(body) });
    return NextResponse.json(row, { status: 201 });
  };
}

export function editarEntidad(delegate: Delegate, aDataParcial: (b: Row) => Row) {
  return async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) return errorJson('bad_request', 'id inválido', 400);
    const row = await delegate.update({ where: { id }, data: aDataParcial((await request.json()) as Row) });
    return NextResponse.json(row, { status: 200 });
  };
}

// Copia al objeto de update sólo las claves presentes en el body, traduciendo el
// nombre de API (snake) al de Prisma (camel) y aplicando la transformación opcional.
export function soloPresentes(body: Row, campos: [string, string, ((v: unknown) => unknown)?][]): Row {
  const data: Row = {};
  for (const [api, prismaKey, tf] of campos) {
    if (body[api] !== undefined) data[prismaKey] = tf ? tf(body[api]) : body[api];
  }
  return data;
}

export const aFecha = (v: unknown): Date => new Date(v as string);
