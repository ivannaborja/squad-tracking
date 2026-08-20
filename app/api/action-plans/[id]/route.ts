import { prisma } from '../../../../lib/prisma';
import { editarEntidad, soloPresentes, type Delegate, type Row } from '../../../../lib/crud';

export const PATCH = editarEntidad(prisma.actionPlan as unknown as Delegate, (b: Row) =>
  soloPresentes(b, [
    ['descripcion', 'descripcion'],
    ['dueno', 'dueno'],
    ['dueño', 'dueno'],
    ['plazo', 'plazo'],
    ['estado', 'estado'],
    ['resuelto', 'resuelto'],
  ])
);
