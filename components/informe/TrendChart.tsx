'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { C, FONT } from '../../lib/ds-tokens';
import type { TrendPoint } from '../../services/report/informe';

// Tendencia Delivery / Discovery / Esperado por semana. Delivery y Discovery son
// dos series categóricas (identidad); Esperado es la línea de referencia (la
// rampa del Q), por eso va gris y punteada, no como una tercera categoría. El par
// categórico #1565C0 / #C2410C pasó el validador de daltonismo (ΔE ≫ 12) en
// tema claro — la app es un solo tema. Leyenda siempre presente: la identidad
// nunca queda sólo en el color.
const COL = { delivery: '#1565C0', discovery: '#C2410C', esperado: C.gray400 };

interface Row {
  semana: string;
  Delivery: number | null;
  Discovery: number | null;
  Esperado: number;
}

// Fracción 0–1 → 0–100 para el eje; null se conserva (hueco, no 0).
const pct = (v: number | null): number | null => (v === null ? null : Math.round(v * 1000) / 10);
// La semana como dd/MM, corto para el eje.
const corto = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <p style={{ fontSize: 14, color: C.gray600, margin: 0 }}>
        Sin historial todavía: la tendencia se puebla a medida que se importa cada semana.
      </p>
    );
  }

  const rows: Row[] = data.map((p) => ({
    semana: corto(p.semanaInicio),
    Delivery: pct(p.deliveryPct),
    Discovery: pct(p.discoveryPct),
    Esperado: pct(p.esperadoPct) ?? 0,
  }));

  const tick = { fontSize: 12, fontFamily: FONT.mono, fill: C.gray600 };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 12, right: 20, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} vertical={false} />
        <XAxis dataKey="semana" tick={tick} tickLine={false} axisLine={{ stroke: C.gray300 }} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={tick}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          formatter={(v) => (typeof v === 'number' ? `${v}%` : '—')}
          contentStyle={{ fontSize: 13, fontFamily: FONT.body, borderRadius: 8, border: `1px solid ${C.gray200}` }}
        />
        <Legend wrapperStyle={{ fontSize: 13, fontFamily: FONT.body }} />
        <Line type="monotone" dataKey="Esperado" stroke={COL.esperado} strokeWidth={2} strokeDasharray="5 4" dot={false} />
        <Line type="monotone" dataKey="Delivery" stroke={COL.delivery} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
        <Line type="monotone" dataKey="Discovery" stroke={COL.discovery} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
