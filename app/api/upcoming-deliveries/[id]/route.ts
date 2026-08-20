import { prisma } from '../../../../lib/prisma';
import { aFecha, editarEntidad, soloPresentes, type Delegate, type Row } from '../../../../lib/crud';

export const PATCH = editarEntidad(prisma.upcomingDelivery as unknown as Delegate, (b: Row) =>
  soloPresentes(b, [
    ['descripcion', 'descripcion'],
    ['fecha_estimada', 'fechaEstimada', aFecha],
  ])
);
