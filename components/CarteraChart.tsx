'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { C, FONT } from '../lib/ds-tokens';

// Cartera por estado: cuántas iniciativas hay en cada estado. Es el gráfico que
// promete scope.md; sale de las iniciativas del import, no de un agregado.
export function CarteraChart({ data }: { data: { estado: string; cantidad: number }[] }) {
  if (data.length === 0) {
    return <p style={{ fontSize: 14, color: C.gray600 }}>Sin iniciativas cargadas para este período.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} vertical={false} />
        <XAxis dataKey="estado" tick={{ fontSize: 12, fontFamily: FONT.body, fill: C.gray600 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fontFamily: FONT.mono, fill: C.gray600 }} />
        <Tooltip cursor={{ fill: C.navy050 }} />
        <Bar dataKey="cantidad" fill={C.navy700} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
