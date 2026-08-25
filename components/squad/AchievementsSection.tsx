import { SectionTitle } from '../ds';
import { ListaSimple } from './shared';
import type { AchievementItem } from '../../services/report/types';

// Logros de la semana. En B0 read-only; B2 agrega crear/editar/quitar (DELETE).
export function AchievementsSection({
  achievements,
}: {
  squadId: number;
  achievements: AchievementItem[];
  semanaActual: string;
}) {
  return (
    <>
      <SectionTitle>Logros de la semana</SectionTitle>
      <ListaSimple items={achievements.map((a) => a.descripcion)} vacio="Sin logros cargados." />
    </>
  );
}
