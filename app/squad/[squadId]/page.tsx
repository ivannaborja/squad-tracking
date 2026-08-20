import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSquadReportView } from '../../../services/report/reportService';
import type { SquadReportView } from '../../../services/report/types';
import { C, FONT, deltaColor, fmtPct, fmtPp } from '../../../lib/ds-tokens';
import { Badge, Card, Kpi, SectionTitle, SemaforoBadge, Mono, stripeColor } from '../../../components/ds';
import { ExportButton } from '../../../components/ExportButton';
import { CarteraChart } from '../../../components/CarteraChart';

export const dynamic = 'force-dynamic';

const hoy = () => new Date().toISOString().slice(0, 10);

export default async function Detalle({ params }: { params: Promise<{ squadId: string }> }) {
  const squadId = Number((await params).squadId);
  if (!Number.isInteger(squadId)) notFound();

  const date = hoy();
  const view = await getSquadReportView(squadId, date);
  if (!view) notFound();

  const s = view.snapshot;
  const cartera = agruparPorEstado(view.collections.initiatives);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <Link href="/" className="no-print" style={{ fontSize: 14, fontWeight: 700, color: C.navy700, textDecoration: 'none' }}>
        ← Comparativo
      </Link>

      <div id="reporte" style={{ marginTop: 16 }}>
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ height: 4, background: stripeColor(s.semaforo) }} />
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <h1 style={{ margin: 0, fontFamily: FONT.head, fontSize: 26, fontWeight: 600, color: C.navy900 }}>
                {view.squadNombre}
              </h1>
              <SemaforoBadge semaforo={s.semaforo} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 13, color: C.gray600 }}>
                Datos de <Mono style={{ color: C.gray900 }}>{view.datosDe ?? '—'}</Mono>
              </span>
              <ExportButton targetId="reporte" nombre={`${view.squadNombre}-${date}`} />
            </div>
          </div>
        </Card>

        {view.avisoRojoSinNeed && (
          <Card style={{ borderLeft: `4px solid ${C.rojo}`, padding: 16, marginTop: 16 }}>
            <strong style={{ color: C.rojoFg }}>Rojo sin pedido de ayuda:</strong>{' '}
            <span style={{ color: C.gray600, fontSize: 14 }}>
              este squad está en rojo y no tiene un “Necesitamos de ustedes” activo esta semana.
            </span>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
          <Kpi label="Esperado (congelado)" value={fmtPct(s.esperadoPct)} />
          <KpiDelta label="Delivery real" real={s.deliveryRealPct} delta={s.deliveryDeltaPct} />
          <KpiDelta label="Discovery real" real={s.discoveryRealPct} delta={s.discoveryDeltaPct} />
          <Kpi label="No planificadas" value={view.kpiNoPlanificadas} color={C.navy700} />
        </div>

        <Card style={{ padding: 16, marginTop: 16, background: C.navy050, border: 'none' }}>
          <span style={{ fontSize: 13, color: C.gray600 }}>Esperado a hoy ({date}): </span>
          <Mono style={{ fontWeight: 500, color: C.navy900 }}>{fmtPct(view.aHoy.esperadoPct)}</Mono>
          <span style={{ fontSize: 13, color: C.gray600 }}>
            {'  ·  '}Delivery <Mono style={{ color: deltaColor(view.aHoy.deliveryDeltaPct) }}>{fmtPp(view.aHoy.deliveryDeltaPct)}</Mono>
            {'  ·  '}Discovery <Mono style={{ color: deltaColor(view.aHoy.discoveryDeltaPct) }}>{fmtPp(view.aHoy.discoveryDeltaPct)}</Mono>
          </span>
        </Card>

        {s.frasePronostico && (
          <Card style={{ padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray600 }}>Pronóstico</div>
            <p style={{ margin: '8px 0 0', fontSize: 16, color: C.navy900 }}>“{s.frasePronostico}”</p>
          </Card>
        )}

        <SectionTitle>Riesgos y bloqueos</SectionTitle>
        <Tabla
          columnas={['Riesgo', 'Categoría', 'Severidad', 'Responsable', 'Tipo', 'Vence', 'Estado']}
          filas={view.collections.risks.map((r) => [
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

        <SectionTitle>Necesitamos de ustedes</SectionTitle>
        <ListaSimple items={view.collections.needs.map((n) => `${n.descripcion} — ${n.dueno || 's/d'}${n.resuelto ? ' (resuelto)' : ''}`)} vacio="Sin pedidos." />

        <SectionTitle>Logros de la semana</SectionTitle>
        <ListaSimple items={view.collections.achievements.map((a) => a.descripcion)} vacio="Sin logros cargados." />

        <SectionTitle>Próximas entregas</SectionTitle>
        <ListaSimple items={view.collections.upcomingDeliveries.map((u) => `${u.descripcion} — ${u.fechaEstimada}`)} vacio="Sin entregas próximas." />

        <SectionTitle>Cartera por estado</SectionTitle>
        <Card style={{ padding: 20 }}>
          <CarteraChart data={cartera} />
        </Card>

        <SectionTitle>Ingresos no planificados</SectionTitle>
        <ListaSimple items={view.collections.unplannedIntake.map((u) => u.descripcion)} vacio="Sin ingresos no planificados." />

        <SectionTitle>Planes de acción (portafolio)</SectionTitle>
        <ListaSimple
          items={view.actionPlans.map((p) => `${p.descripcion} — ${p.dueno || 's/d'} · ${p.plazo} · ${p.estado}${p.resuelto ? ' (resuelto)' : ''}`)}
          vacio="Sin planes de acción."
        />
      </div>
    </div>
  );
}

function KpiDelta({ label, real, delta }: { label: string; real: number | null; delta: number | null }) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: C.gray600 }}>{label}</div>
      <div style={{ fontFamily: FONT.head, fontSize: 34, fontWeight: 700, color: C.navy900, lineHeight: 1.1, marginTop: 6 }}>
        {fmtPct(real)}
      </div>
      <Mono style={{ fontSize: 14, fontWeight: 500, color: deltaColor(delta) }}>{fmtPp(delta)}</Mono>
    </Card>
  );
}

function Tabla({ columnas, filas, vacio }: { columnas: string[]; filas: ReactNode[][]; vacio: string }) {
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

function ListaSimple({ items, vacio }: { items: string[]; vacio: string }) {
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

function Vacio({ texto }: { texto: string }) {
  return <p style={{ fontSize: 14, color: C.gray400, fontStyle: 'italic', margin: 0 }}>{texto}</p>;
}

function agruparPorEstado(initiatives: { estado: string }[]): { estado: string; cantidad: number }[] {
  const mapa = new Map<string, number>();
  for (const i of initiatives) mapa.set(i.estado, (mapa.get(i.estado) ?? 0) + 1);
  return Array.from(mapa, ([estado, cantidad]) => ({ estado, cantidad }));
}
