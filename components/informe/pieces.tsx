import Link from 'next/link';
import { C, FONT, fmtPct, fmtPp, deltaColor } from '../../lib/ds-tokens';
import { Card, Mono } from '../ds';
import type { InformeKpis, SemaforoRow, SimpleItem, EntregaItem, NeedItem, BloqueoItem } from '../../services/report/informe';

const brecha = (real: number | null, esperado: number): number | null => (real === null ? null : real - esperado);

// La fila de 4 KPIs de la cabecera del informe (general o individual, misma forma).
// pasesPlanificadosSlot: si se pasa, ocupa la 4ta celda (card editable inline) en
// vez del KpiInforme estático; sin él, se mantiene el comportamiento anterior.
export function KpiRow({ kpis, pasesPlanificadosSlot }: { kpis: InformeKpis; pasesPlanificadosSlot?: React.ReactNode }) {
  const { deliveryPromedio, discoveryPromedio, esperadoPct, discoveryDeltaSemanaAnterior, pasesProduccion, pasesPlanificados } = kpis;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '20px 0 8px' }}>
      <KpiInforme
        label="Avance Delivery"
        value={fmtPct(deliveryPromedio)}
        sub={
          <>
            Esperado {fmtPct(esperadoPct)} ·{' '}
            <Mono style={{ color: deltaColor(brecha(deliveryPromedio, esperadoPct)) }}>{fmtPp(brecha(deliveryPromedio, esperadoPct))}</Mono>
          </>
        }
      />
      <KpiInforme
        label="Discovery ponderado"
        value={fmtPct(discoveryPromedio)}
        sub={
          <>
            Esperado {fmtPct(esperadoPct)} ·{' '}
            <Mono style={{ color: deltaColor(brecha(discoveryPromedio, esperadoPct)) }}>{fmtPp(brecha(discoveryPromedio, esperadoPct))}</Mono>
            {discoveryDeltaSemanaAnterior !== null && (
              <>
                {' · '}
                <Mono style={{ color: deltaColor(discoveryDeltaSemanaAnterior) }}>{fmtPp(discoveryDeltaSemanaAnterior)}</Mono> vs sem. ant.
              </>
            )}
          </>
        }
      />
      <KpiInforme
        label="Pases a producción"
        value={`${pasesProduccion.hechos}/${pasesProduccion.total}`}
        sub="En producción / total del Q"
      />
      {pasesPlanificadosSlot ?? (
        <KpiInforme label="Pases planificados" value={pasesPlanificados ?? '—'} sub="Esta semana" />
      )}
    </div>
  );
}

function KpiInforme({ label, value, sub }: { label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: C.gray600 }}>{label}</div>
      <div style={{ fontFamily: FONT.head, fontSize: 32, fontWeight: 700, color: C.navy900, lineHeight: 1.1, margin: '6px 0 8px' }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: C.gray600 }}>{sub}</div>
    </Card>
  );
}

// Semáforo por squad del informe general: una fila por squad, enlazada a su
// informe individual.
export function SemaforoTabla({ rows }: { rows: SemaforoRow[] }) {
  const grid = 'minmax(200px, 3fr) 1fr 1fr';
  return (
    <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 8, overflowX: 'auto', background: C.white }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 16, padding: '12px 20px', background: C.navy100, minWidth: 460 }}>
        {['Squad', 'Delivery', 'Discovery'].map((h) => (
          <span key={h} style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.navy900 }}>{h}</span>
        ))}
      </div>
      {rows.map((r) => (
        <Link
          key={r.squadId}
          href={`/informe/squad/${r.squadId}`}
          style={{ textDecoration: 'none', color: 'inherit', display: 'grid', gridTemplateColumns: grid, gap: 16, padding: '12px 20px', borderTop: `1px solid ${C.gray200}`, alignItems: 'center', minWidth: 460 }}
        >
          {/* Nombre con dot de color del semáforo + brecha de delivery inline (el
              color ya no va como columna Estado aparte). */}
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600, color: C.navy700 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background:
                    r.semaforo === 'verde' ? C.verde : r.semaforo === 'amarillo' ? C.amarillo : r.semaforo === 'rojo' ? C.rojo : C.gray300,
                  marginRight: 8,
                  flexShrink: 0,
                }}
              />
              {r.squadNombre}
            </span>
            <span style={{ fontSize: 11, color: deltaColor(r.deliveryDeltaPct) }}>
              Avance vs. esperado: {fmtPp(r.deliveryDeltaPct)}
            </span>
          </span>
          <Mono style={{ fontSize: 14, color: deltaColor(r.deliveryDeltaPct) }}>{fmtPp(r.deliveryDeltaPct)}</Mono>
          <Mono style={{ fontSize: 14, color: deltaColor(r.discoveryDeltaPct) }}>{fmtPp(r.discoveryDeltaPct)}</Mono>
        </Link>
      ))}
    </div>
  );
}

// Bloque titulado del informe (encabezado + contenido).
export function Bloque({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontFamily: FONT.head, fontSize: 15, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.gray900 }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ListaInforme({ items, vacio }: { items: string[]; vacio: string }) {
  if (items.length === 0) return <p style={{ fontSize: 14, color: C.gray400, fontStyle: 'italic', margin: 0 }}>{vacio}</p>;
  return (
    <Card style={{ padding: '8px 0' }}>
      {items.map((t, i) => (
        <div key={i} style={{ padding: '10px 20px', borderTop: i === 0 ? 'none' : `1px solid ${C.gray200}`, fontSize: 14, color: C.gray900 }}>
          {t}
        </div>
      ))}
    </Card>
  );
}

// Bloqueos: aparte de los riesgos y prominentes (borde rojo). Reutiliza
// Risk.tipo='bloqueo'. Si no hay, se dice explícito (es buena noticia).
export function BloqueosSection({ bloqueos }: { bloqueos: BloqueoItem[] }) {
  if (bloqueos.length === 0) {
    return <p style={{ fontSize: 14, color: C.gray600, margin: 0 }}>Sin bloqueos activos.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {bloqueos.map((b) => (
        <Card key={b.id} style={{ borderLeft: `4px solid ${C.rojo}`, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.rojoFg }}>{b.descripcion}</div>
          <div style={{ fontSize: 13, color: C.gray600, marginTop: 6 }}>
            Severidad {b.severidad || 's/d'} · Dueño {b.dueno || 's/d'} · Próximo paso: {b.accionProxima || 's/d'}
            {b.checkpoint ? ` · Checkpoint ${b.checkpoint}` : ''}
          </div>
        </Card>
      ))}
    </div>
  );
}

// Helpers de mapeo a texto para las listas reutilizadas.
export const entregaTexto = (e: EntregaItem): string => `${e.descripcion} — ${e.fechaEstimada}`;
export const needTexto = (n: NeedItem): string => `${n.descripcion} — ${n.dueno || 's/d'}`;
export const simpleTexto = (s: SimpleItem): string => s.descripcion;
