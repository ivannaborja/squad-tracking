'use client';

import { EditableCollection } from '../write/EditableCollection';
import type { UnplannedIntakeItem } from '../../services/report/types';

// Ingresos no planificados (intake, NO plata): agregar / editar / quitar (DELETE).
export function UnplannedSection({
  squadId,
  unplannedIntake,
  semanaActual,
}: {
  squadId: number;
  unplannedIntake: UnplannedIntakeItem[];
  semanaActual: string;
}) {
  return (
    <EditableCollection<UnplannedIntakeItem>
      title="Ingresos no planificados"
      items={unplannedIntake}
      fields={[{ key: 'descripcion', label: 'Descripción', type: 'text', apiKey: 'descripcion' }]}
      endpoint="/api/unplanned-intake"
      emptyText="Sin ingresos no planificados."
      createExtra={() => ({ squad_id: squadId, semana_inicio: semanaActual })}
      toForm={(u) => ({ descripcion: u.descripcion })}
      readLine={(u) => u.descripcion}
      deletable
    />
  );
}
