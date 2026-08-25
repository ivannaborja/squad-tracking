import { SectionTitle, Card } from '../ds';
import { CarteraChart } from '../CarteraChart';
import { agruparPorEstado } from './shared';
import type { InitiativeItem } from '../../services/report/types';

// Cartera por estado. Read-only siempre: las iniciativas son espejo del CSV
// (import-only, sin endpoint de escritura), ningún bloque las edita.
export function CarteraSection({ initiatives }: { initiatives: InitiativeItem[] }) {
  return (
    <>
      <SectionTitle>Cartera por estado</SectionTitle>
      <Card style={{ padding: 20 }}>
        <CarteraChart data={agruparPorEstado(initiatives)} />
      </Card>
    </>
  );
}
