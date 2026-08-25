import { SectionTitle } from '../ds';
import { ListaSimple } from './shared';
import type { NeedItem } from '../../services/report/types';

// "Necesitamos de ustedes". En B0 read-only; B2 agrega crear/editar/resolver.
export function NeedsSection({
  needs,
}: {
  squadId: number;
  needs: NeedItem[];
  semanaActual: string;
}) {
  return (
    <>
      <SectionTitle>Necesitamos de ustedes</SectionTitle>
      <ListaSimple
        items={needs.map((n) => `${n.descripcion} — ${n.dueno || 's/d'}${n.resuelto ? ' (resuelto)' : ''}`)}
        vacio="Sin pedidos."
      />
    </>
  );
}
