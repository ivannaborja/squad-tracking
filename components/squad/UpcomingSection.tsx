import { SectionTitle } from '../ds';
import { ListaSimple } from './shared';
import type { UpcomingDeliveryItem } from '../../services/report/types';

// Próximas entregas. En B0 read-only; B2 agrega crear/editar/quitar (DELETE).
export function UpcomingSection({
  upcomingDeliveries,
}: {
  squadId: number;
  upcomingDeliveries: UpcomingDeliveryItem[];
  semanaActual: string;
}) {
  return (
    <>
      <SectionTitle>Próximas entregas</SectionTitle>
      <ListaSimple
        items={upcomingDeliveries.map((u) => `${u.descripcion} — ${u.fechaEstimada}`)}
        vacio="Sin entregas próximas."
      />
    </>
  );
}
