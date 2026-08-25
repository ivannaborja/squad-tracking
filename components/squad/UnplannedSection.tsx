import { SectionTitle } from '../ds';
import { ListaSimple } from './shared';
import type { UnplannedIntakeItem } from '../../services/report/types';

// Ingresos no planificados (intake, NO plata). En B0 read-only; B2 agrega
// crear/editar/quitar (DELETE).
export function UnplannedSection({
  unplannedIntake,
}: {
  squadId: number;
  unplannedIntake: UnplannedIntakeItem[];
  semanaActual: string;
}) {
  return (
    <>
      <SectionTitle>Ingresos no planificados</SectionTitle>
      <ListaSimple items={unplannedIntake.map((u) => u.descripcion)} vacio="Sin ingresos no planificados." />
    </>
  );
}
