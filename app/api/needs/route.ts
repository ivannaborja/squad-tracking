import { prisma } from '../../../lib/prisma';
import { aFecha, crearEntidad, type Delegate, type Row } from '../../../lib/crud';

// "Necesitamos ayuda": el estado (ABIERTA / MITIGADA_PARCIALMENTE / RESUELTA) manda;
// `resuelto` se conserva derivado (= RESUELTA) para no romper los filtros existentes.
// La fecha arranca hoy si no viene, pero es editable.
export const POST = crearEntidad(
  prisma.need as unknown as Delegate,
  ['squad_id', 'descripcion', 'semana_inicio'],
  (b: Row) => {
    const estado = (b.estado as string) ?? 'ABIERTA';
    return {
      squadId: b.squad_id,
      descripcion: b.descripcion,
      dueno: b.dueno ?? b['dueño'] ?? '',
      fecha: b.fecha ? aFecha(b.fecha) : new Date(),
      estado,
      resuelto: estado === 'RESUELTA',
      semanaInicio: aFecha(b.semana_inicio),
    };
  }
);
