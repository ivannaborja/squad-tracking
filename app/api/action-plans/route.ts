import { prisma } from '../../../lib/prisma';
import { aFecha, crearEntidad, type Delegate, type Row } from '../../../lib/crud';

// De portafolio, no de squad: sin squad_id (SDD, fuente real pág. 3).
export const POST = crearEntidad(
  prisma.actionPlan as unknown as Delegate,
  ['descripcion', 'plazo', 'estado', 'semana_inicio'],
  (b: Row) => ({
    descripcion: b.descripcion,
    dueno: b.dueno ?? b['dueño'] ?? '',
    plazo: b.plazo,
    estado: b.estado,
    semanaInicio: aFecha(b.semana_inicio),
    resuelto: b.resuelto ?? false,
  })
);
