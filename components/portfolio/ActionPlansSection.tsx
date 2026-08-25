import { C, FONT } from '../../lib/ds-tokens';
import { Card, SectionTitle } from '../ds';
import type { ActionPlanItem } from '../../services/report/types';

// Planes de acción (mejora continua): de PORTAFOLIO, sin squad. Por eso viven en
// el comparativo `/` y no en cada squad. En B0 es read-only; B4 le agrega
// crear/editar/resolver. Es la única sección de escritura de portafolio en `/`.
export function ActionPlansSection({ actionPlans }: { actionPlans: ActionPlanItem[] }) {
  return (
    <>
      <SectionTitle>Planes de acción (portafolio)</SectionTitle>
      {actionPlans.length === 0 ? (
        <p style={{ fontSize: 14, color: C.gray400, fontStyle: 'italic', margin: 0 }}>Sin planes de acción.</p>
      ) : (
        <Card style={{ padding: '8px 0' }}>
          {actionPlans.map((p, i) => (
            <div
              key={p.id}
              style={{
                padding: '12px 20px',
                borderTop: i === 0 ? 'none' : `1px solid ${C.gray200}`,
                fontSize: 14,
                color: C.gray900,
                opacity: p.resuelto ? 0.6 : 1,
              }}
            >
              <span>{p.descripcion}</span>
              <span style={{ color: C.gray600, fontFamily: FONT.body }}>
                {' — '}
                {p.dueno || 's/d'} · {p.plazo} · {p.estado}
                {p.resuelto ? ' (resuelto)' : ''}
              </span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
