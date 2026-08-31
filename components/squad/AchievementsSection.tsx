'use client';

import { EditableCollection } from '../write/EditableCollection';
import type { AchievementItem } from '../../services/report/types';

// Logros de la semana: agregar / editar / quitar (sin `resuelto`; usa DELETE).
export function AchievementsSection({
  squadId,
  achievements,
  semanaActual,
}: {
  squadId: number;
  achievements: AchievementItem[];
  semanaActual: string;
}) {
  return (
    <EditableCollection<AchievementItem>
      title="Logros de la semana"
      items={achievements}
      fields={[{ key: 'descripcion', label: 'Descripción', type: 'text', apiKey: 'descripcion' }]}
      endpoint="/api/achievements"
      emptyText="Sin logros cargados."
      createExtra={() => ({ squad_id: squadId, semana_inicio: semanaActual })}
      toForm={(a) => ({ descripcion: a.descripcion })}
      readLine={(a) => a.descripcion}
      deletable
    />
  );
}
