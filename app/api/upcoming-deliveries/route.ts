import { prisma } from '../../../lib/prisma';
import { aFecha, crearEntidad, type Delegate, type Row } from '../../../lib/crud';

export const POST = crearEntidad(
  prisma.upcomingDelivery as unknown as Delegate,
  ['squad_id', 'descripcion', 'fecha_estimada', 'semana_inicio'],
  (b: Row) => ({
    squadId: b.squad_id,
    descripcion: b.descripcion,
    fechaEstimada: aFecha(b.fecha_estimada),
    semanaInicio: aFecha(b.semana_inicio),
  })
);
