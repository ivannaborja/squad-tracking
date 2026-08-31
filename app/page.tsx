import Link from 'next/link';
import { getOverview } from '../services/report/reportService';
import { C, FONT } from '../lib/ds-tokens';
import { Kpi, Mono } from '../components/ds';
import { ExportButton } from '../components/ExportButton';
import { hoyISO } from '../lib/dates';
import { SquadGrid } from '../components/portfolio/SquadGrid';
import { ImportPanel } from '../components/portfolio/ImportPanel';

// Lee la base en cada request y usa la fecha de hoy: nunca se prerenderiza.
export const dynamic = 'force-dynamic';

export default async function Comparativo() {
  const date = hoyISO();
  const squads = await getOverview(date);

  const cuenta = (s: string) => squads.filter((x) => x.semaforo === s).length;

  return (
    <div id="reporte" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: FONT.head, fontSize: 30, fontWeight: 600, color: C.navy900 }}>
            Comparativo de squads
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: C.gray600 }}>
            Estado al <Mono>{date}</Mono>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/informe"
            className="no-print"
            style={{
              height: 40,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 16px',
              borderRadius: 8,
              background: C.navy700,
              color: C.white,
              fontFamily: FONT.head,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Informe
          </Link>
          <ImportPanel />
          <ExportButton targetId="reporte" nombre={`comparativo-${date}`} />
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '24px 0 8px' }}>
        <Kpi label="Squads" value={squads.length} />
        <Kpi label="En verde" value={cuenta('verde')} color={C.verde} />
        <Kpi label="En amarillo" value={cuenta('amarillo')} color={C.amarilloFg} />
        <Kpi label="En rojo" value={cuenta('rojo')} color={C.rojo} />
      </div>

      <SquadGrid squads={squads} />
    </div>
  );
}
