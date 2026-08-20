import type { CSSProperties, ReactNode } from 'react';
import type { Semaforo } from '../domain/types';
import { C, FONT, semaforoTheme } from '../lib/ds-tokens';

// Badge tint: punto + texto. Base de todos los estados del DS.
export function Badge({ bg, fg, dot, children }: { bg: string; fg: string; dot?: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 28,
        padding: '0 12px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />}
      {children}
    </span>
  );
}

export function SemaforoBadge({ semaforo }: { semaforo: Semaforo | null }) {
  if (semaforo === null) {
    return <Badge bg="#EEF0F2" fg={C.gray600} dot={C.gray400}>Sin datos</Badge>;
  }
  const t = semaforoTheme(semaforo);
  return <Badge bg={t.bg} fg={t.fg} dot={t.dot}>{t.label}</Badge>;
}

// Barra lateral de 4px con el color del semáforo (card con estado del DS).
export function stripeColor(semaforo: Semaforo | null): string {
  if (semaforo === 'verde') return C.verde;
  if (semaforo === 'amarillo') return C.amarillo;
  if (semaforo === 'rojo') return C.rojo;
  return C.gray300;
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 8,
        boxShadow: '0 1px 2px rgba(10,47,92,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// KPI tile: label chico gris + número grande Poppins, coloreable por estado.
export function Kpi({ label, value, color = C.navy900 }: { label: string; value: ReactNode; color?: string }) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: C.gray600 }}>{label}</div>
      <div style={{ fontFamily: FONT.head, fontSize: 34, fontWeight: 700, color, lineHeight: 1.1, marginTop: 6 }}>
        {value}
      </div>
    </Card>
  );
}

export function ProgressBar({ pct, color = C.navy700 }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(1, pct)) * 100;
  return (
    <div style={{ height: 8, borderRadius: 999, background: C.gray200, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        margin: '32px 0 12px',
        fontFamily: FONT.head,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: C.gray900,
      }}
    >
      {children}
    </h3>
  );
}

export function Mono({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontFamily: FONT.mono, ...style }}>{children}</span>;
}
