'use client';

import { EditableCollection } from '../write/EditableCollection';
import type { UpcomingDeliveryItem } from '../../services/report/types';

// Próximas entregas: agregar / editar (descripción + fecha) / quitar (DELETE).
export function UpcomingSection({
  squadId,
  upcomingDeliveries,
  semanaActual,
}: {
  squadId: number;
  upcomingDeliveries: UpcomingDeliveryItem[];
  semanaActual: string;
}) {
  return (
    <EditableCollection<UpcomingDeliveryItem>
      title="Próximas entregas"
      items={upcomingDeliveries}
      fields={[
        { key: 'descripcion', label: 'Descripción', type: 'text', apiKey: 'descripcion' },
        { key: 'fecha_estimada', label: 'Fecha estimada', type: 'date', apiKey: 'fecha_estimada' },
      ]}
      endpoint="/api/upcoming-deliveries"
      emptyText="Sin entregas próximas."
      createExtra={() => ({ squad_id: squadId, semana_inicio: semanaActual })}
      toForm={(u) => ({ descripcion: u.descripcion, fecha_estimada: u.fechaEstimada })}
      readLine={(u) => `${u.descripcion} — ${u.fechaEstimada}`}
      deletable
    />
  );
}
