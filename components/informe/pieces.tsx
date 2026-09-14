import Link from 'next/link';
import { C, FONT, fmtPct, fmtPct1, fmtPp, deltaColor } from '../../lib/ds-tokens';
import { Card, Mono } from '../ds';
import type { InformeKpis, MetricaVista, MetricasVista, SemaforoRow, SimpleItem, EntregaItem, NeedItem, BloqueoItem } from '../../services/report/informe';

const brecha = (real: number | null, esperado: number | null): number | null =>
  real === null || esperado === null ? null : real - esperado;

// Resto de las métricas del Q por squad (vista de squad): Q3 total, Priorizado
// Avanzar y Discovery, cada una con su %real (1 decimal, como el Smartsheet), su
// esperado por fechas y el desvío. Avanzar/Discovery pueden no aplicar. Sólo
// lectura: la app es copia fiel del Smartsheet.
export function PanelMetricas({
  metricas,
  esperadoQ,
  deliveryDeltaQ,
  discoveryDeltaQ,
}: {
  metricas: MetricasVista;
  esperadoQ: number | null;
  deliveryDeltaQ: number | null;
  discoveryDeltaQ: number | null;
}) {
  // "Priorizado Finalizar" no va acá: es el dato oficial (real + esperado + color)
  // y ya se muestra arriba, en la card "Avance Delivery priorizado" del KpiRow.
  // Repetirlo acá sería redundante — este bloque es sólo el resto de las métricas
  // del Q en curso.
  // Avanzar/Discovery sólo si el squad tiene ese nodo (m no null): "no tiene" es
  // distinto de "lo tiene pero sin dato cargado esta semana" (eso sí se muestra,
  // como "No aplica" dentro de la card — ver MetricaCard).
  const opcionales: Array<{ label: string; m: MetricaVista }> = [
    ...(metricas.avanzar ? [{ label: 'Priorizado Avanzar', m: metricas.avanzar }] : []),
    ...(metricas.discovery ? [{ label: 'Discovery', m: metricas.discovery }] : []),
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      <MetricaCard label="Delivery Q3 total" m={metricas.q3Total} />
      <EsperadoQCard esperadoQ={esperadoQ} deliveryDeltaQ={deliveryDeltaQ} discoveryDeltaQ={discoveryDeltaQ} />
      {opcionales.map(({ label, m }) => (
        <MetricaCard key={label} label={label} m={m} />
      ))}
    </div>
  );
}

// Una card de métrica: %real + esperado por fechas del propio nodo + desvío. "No
// aplica" si el nodo existe pero no tiene dato cargado esta semana (hueco honesto).
function MetricaCard({ label, m }: { label: string; m: MetricaVista }) {
  return (
    <Card style={{ padding: '14px 16px', border: `1px solid ${C.gray200}` }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      {m.real !== null ? (
        <>
          <Mono style={{ display: 'block', fontSize: 22, fontWeight: 600, color: C.navy900, marginTop: 6 }}>{fmtPct1(m.real)}</Mono>
          <div style={{ fontSize: 12, color: C.gray600, marginTop: 4 }}>
            Esperado por fechas {fmtPct1(m.esperado)}
            {m.desvio !== null && (
              <>
                {' · '}
                <Mono style={{ color: deltaColor(m.desvio), fontWeight: 600 }}>{fmtPp(m.desvio)}</Mono>
              </>
            )}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 14, color: C.gray400, marginTop: 8 }}>No aplica</div>
      )}
    </Card>
  );
}

// El esperado del Q (el que Dai reporta y define el color) en formato card, como
// el resto — antes era una línea de texto suelta, más difícil de leer al lado de
// las demás tarjetas.
function EsperadoQCard({
  esperadoQ,
  deliveryDeltaQ,
  discoveryDeltaQ,
}: {
  esperadoQ: number | null;
  deliveryDeltaQ: number | null;
  discoveryDeltaQ: number | null;
}) {
  return (
    <Card style={{ padding: '14px 16px', border: `1px solid ${C.gray200}` }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gray600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Esperado del Q (a hoy)
      </div>
      <Mono style={{ display: 'block', fontSize: 22, fontWeight: 600, color: C.navy900, marginTop: 6 }}>{fmtPct1(esperadoQ)}</Mono>
      <div style={{ fontSize: 12, color: C.gray600, marginTop: 4 }}>
        Delivery vs Q <Mono style={{ color: deltaColor(deliveryDeltaQ), fontWeight: 600 }}>{fmtPp(deliveryDeltaQ)}</Mono>
        {discoveryDeltaQ !== null && (
          <>
            <br />
            Discovery vs Q <Mono style={{ color: deltaColor(discoveryDeltaQ), fontWeight: 600 }}>{fmtPp(discoveryDeltaQ)}</Mono>
          </>
        )}
      </div>
    </Card>
  );
}

// La fila de 4 KPIs de la cabecera del informe (general o individual, misma forma).
// pasesPlanificadosSlot: si se pasa, ocupa la 4ta celda (card editable inline) en
// vez del KpiInforme estático; sin él, se mantiene el comportamiento anterior.
export function KpiRow({ kpis, pasesPlanificadosSlot }: { kpis: InformeKpis; pasesPlanificadosSlot?: React.ReactNode }) {
  const {
    deliveryPromedio,
    discoveryPromedio,
    esperadoPct,
    esperadoPriorizadoPct,
    discoveryDeltaSemanaAnterior,
    pasesProduccion,
    pasesPlanificados,
  } = kpis;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '20px 0 8px' }}>
      {/* "Priorizado" en el nombre → compara contra el esperado priorizado (el
          oficial), no contra el del Q (ese es el dato de "Métricas del Q" de abajo). */}
      <KpiInforme
        label="Avance Delivery priorizado"
        value={fmtPct(deliveryPromedio)}
        sub={
          <>
            Esperado priorizado {fmtPct(esperadoPriorizadoPct)} ·{' '}
            <Mono style={{ color: deltaColor(brecha(deliveryPromedio, esperadoPriorizadoPct)) }}>
              {fmtPp(brecha(deliveryPromedio, esperadoPriorizadoPct))}
            </Mono>
          </>
        }
      />
      <KpiInforme
        label="Discovery ponderado"
        value={fmtPct(discoveryPromedio)}
        sub={
          <>
            Esperado del Q {fmtPct(esperadoPct)} ·{' '}
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
  const grid = 'minmax(160px, 2.2fr) 1fr 1fr';
  return (
    <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 8, overflowX: 'auto', background: C.white }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 16, padding: '12px 20px', background: C.navy100, minWidth: 560 }}>
        {['Squad', 'Delivery comprometido priorizado', 'Discovery comprometido'].map((h) => (
          <span key={h} style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.navy900 }}>{h}</span>
        ))}
      </div>
      {rows.map((r) => (
        <Link
          key={r.squadId}
          href={`/informe/squad/${r.squadId}`}
          style={{ textDecoration: 'none', color: 'inherit', display: 'grid', gridTemplateColumns: grid, gap: 16, padding: '12px 20px', borderTop: `1px solid ${C.gray200}`, alignItems: 'center', minWidth: 560 }}
        >
          {/* Nombre con dot de color del semáforo. El "avance vs. esperado" ya no va
              por fila: aparece una sola vez en el título del bloque. */}
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
          <ComprometidoCell real={r.deliveryRealPct} delta={r.deliveryDeltaPriorizadoPct} />
          <ComprometidoCell real={r.discoveryRealPct} delta={r.discoveryDeltaPct} />
        </Link>
      ))}
    </div>
  );
}

// Celda "comprometido": el % de avance real del squad y, a la derecha, la brecha
// vs. el esperado con flecha — verde si llegó o superó (delta ≥ 0), rojo si quedó
// abajo. Discovery puede no aplicar (ej. Empresa Actual, sin discovery): se dice
// explícito.
function ComprometidoCell({ real, delta }: { real: number | null; delta: number | null }) {
  if (real === null) {
    return <span style={{ fontSize: 13, color: C.gray400 }}>No aplica</span>;
  }
  const positivo = (delta ?? 0) >= 0;
  const pp = delta === null ? null : Math.round(Math.abs(delta) * 100);
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <Mono style={{ fontSize: 15, fontWeight: 600, color: C.navy900 }}>{fmtPct(real)}</Mono>
      {pp !== null && (
        <span style={{ fontSize: 12, fontWeight: 600, color: positivo ? C.verdeFg : C.rojoFg }}>
          {positivo ? '▲ +' : '▼ '}{pp} pp
        </span>
      )}
    </span>
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

// Título-case de la severidad (viene como enum ALTA/MEDIA/BAJA).
const sevLabel = (s: string): string => (s ? s.charAt(0) + s.slice(1).toLowerCase() : 's/d');

// Bloqueos: prominentes (borde rojo), entidad propia separada de los riesgos. Si
// no hay, se dice explícito (es buena noticia).
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
            Severidad {sevLabel(b.severidad)}
            {b.desde ? ` · Desde ${b.desde}` : ''}
            {b.hasta ? ` · Hasta ${b.hasta}` : ''}
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
