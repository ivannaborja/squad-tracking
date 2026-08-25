import type { ReactNode } from 'react';
import { C, FONT, deltaColor, fmtPct, fmtPp } from '../../lib/ds-tokens';
import { Card } from '../ds';

// Helpers de presentación del detalle de squad, extraídos de la página para que
// cada sección los reuse (antes vivían inline en app/squad/[squadId]/page.tsx).

export function KpiDelta({ label, real, delta }: { label: string; real: number | null; delta: number | null }) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: C.gray600 }}>{label}</div>
      <div style={{ fontFamily: FONT.head, fontSize: 34, fontWeight: 700, color: C.navy900, lineHeight: 1.1, marginTop: 6 }}>
        {fmtPct(real)}
      </div>
      <span style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 500, color: deltaColor(delta) }}>{fmtPp(delta)}</span>
    </Card>
  );
}

export function Tabla({ columnas, filas, vacio }: { columnas: string[]; filas: ReactNode[][]; vacio: string }) {
  if (filas.length === 0) return <Vacio texto={vacio} />;
  const grid = `minmax(200px, 2fr) repeat(${columnas.length - 1}, minmax(90px, 1fr))`;
  return (
    <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 8, overflowX: 'auto', background: C.white }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 16, padding: '12px 20px', background: C.navy100, minWidth: 820 }}>
        {columnas.map((c) => (
          <span key={c} style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.navy900 }}>{c}</span>
        ))}
      </div>
      {filas.map((fila, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: grid, gap: 16, padding: '14px 20px', borderTop: `1px solid ${C.gray200}`, alignItems: 'center', minWidth: 820, fontSize: 14, color: C.gray900 }}>
          {fila.map((celda, j) => (
            <span key={j} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{celda}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListaSimple({ items, vacio }: { items: string[]; vacio: string }) {
  if (items.length === 0) return <Vacio texto={vacio} />;
  return (
    <Card style={{ padding: '8px 0' }}>
      {items.map((t, i) => (
        <div key={i} style={{ padding: '12px 20px', borderTop: i === 0 ? 'none' : `1px solid ${C.gray200}`, fontSize: 14, color: C.gray900 }}>
          {t}
        </div>
      ))}
    </Card>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return <p style={{ fontSize: 14, color: C.gray400, fontStyle: 'italic', margin: 0 }}>{texto}</p>;
}

export function agruparPorEstado(initiatives: { estado: string }[]): { estado: string; cantidad: number }[] {
  const mapa = new Map<string, number>();
  for (const i of initiatives) mapa.set(i.estado, (mapa.get(i.estado) ?? 0) + 1);
  return Array.from(mapa, ([estado, cantidad]) => ({ estado, cantidad }));
}
