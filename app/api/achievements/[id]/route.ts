import { prisma } from '../../../../lib/prisma';
import { editarEntidad, soloPresentes, type Delegate, type Row } from '../../../../lib/crud';

export const PATCH = editarEntidad(prisma.achievement as unknown as Delegate, (b: Row) =>
  soloPresentes(b, [['descripcion', 'descripcion']])
);
