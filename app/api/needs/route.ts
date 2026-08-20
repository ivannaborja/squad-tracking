import { prisma } from '../../../lib/prisma';
import { aFecha, crearEntidad, type Delegate, type Row } from '../../../lib/crud';

export const POST = crearEntidad(
  prisma.need as unknown as Delegate,
  ['squad_id', 'descripcion', 'semana_inicio'],
  (b: Row) => ({
    squadId: b.squad_id,
    descripcion: b.descripcion,
    dueno: b.dueno ?? b['dueño'] ?? '',
    semanaInicio: aFecha(b.semana_inicio),
    resuelto: b.resuelto ?? false,
  })
);
