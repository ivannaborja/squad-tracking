import { prisma } from '../../../../lib/prisma';
import { borrarEntidad, editarEntidad, soloPresentes, type Delegate, type Row } from '../../../../lib/crud';

export const PATCH = editarEntidad(prisma.unplannedIntake as unknown as Delegate, (b: Row) =>
  soloPresentes(b, [['descripcion', 'descripcion']])
);

export const DELETE = borrarEntidad(prisma.unplannedIntake as unknown as Delegate);
