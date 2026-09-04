import { prisma } from '../../../../lib/prisma';
import { aFecha, editarEntidad, soloPresentes, type Delegate, type Row } from '../../../../lib/crud';

// Edición parcial de un pedido de ayuda. Al cambiar el estado se re-deriva `resuelto`
// (= RESUELTA), que es lo que consume el resto de la app.
export const PATCH = editarEntidad(prisma.need as unknown as Delegate, (b: Row) => {
  const data = soloPresentes(b, [
    ['descripcion', 'descripcion'],
    ['fecha', 'fecha', aFecha],
    ['estado', 'estado'],
  ]);
  if (b.estado !== undefined) data.resuelto = (b.estado as string) === 'RESUELTA';
  return data;
});
