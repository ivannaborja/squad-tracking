'use client';

import { C, FONT } from '../../lib/ds-tokens';
import { EDITORES, useEditor, type Editor } from './EditorContext';

// Selector de "editando como" para el header. Una vez por sesión; se manda solo
// en cada escritura que lo use. No es atribución confiable (auditoría blanda).
export function EditorSelector() {
  const { editadoPor, setEditadoPor } = useEditor();
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONT.body }}>
      <span style={{ fontSize: 12, color: C.gray600 }}>Editando como</span>
      <select
        value={editadoPor}
        onChange={(e) => setEditadoPor(e.target.value as Editor)}
        style={{
          height: 30,
          padding: '0 8px',
          borderRadius: 6,
          border: `1px solid ${C.gray300}`,
          background: C.white,
          color: C.gray900,
          fontSize: 13,
          fontFamily: FONT.body,
        }}
      >
        {EDITORES.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
    </label>
  );
}
