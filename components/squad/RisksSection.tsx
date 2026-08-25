import { SectionTitle, Mono } from '../ds';
import { Tabla } from './shared';
import type { RiskItem } from '../../services/report/types';

// Riesgos y bloqueos del squad. En B0 es read-only; B3 le agrega crear/editar/
// resolver + multi-select de squads. `squads` y `semanaActual` ya viajan como
// props para que B3 no tenga que tocar la página.
export function RisksSection({
  risks,
}: {
  squadId: number;
  risks: RiskItem[];
  squads: { id: number; nombre: string }[];
  semanaActual: string;
}) {
  return (
    <>
      <SectionTitle>Riesgos y bloqueos</SectionTitle>
      <Tabla
        columnas={['Riesgo', 'Categoría', 'Severidad', 'Responsable', 'Tipo', 'Vence', 'Estado']}
        filas={risks.map((r) => [
          r.descripcion,
          r.categoriaImpacto,
          r.severidad || '—',
          r.dueno || '—',
          r.tipo,
          <Mono key="v">{r.semanaFin}</Mono>,
          r.resuelto ? 'Resuelto' : 'Abierto',
        ])}
        vacio="Sin riesgos cargados."
      />
    </>
  );
}
