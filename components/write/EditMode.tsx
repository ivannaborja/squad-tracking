'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { C, FONT } from '../../lib/ds-tokens';

// Modo lectura/edición a nivel página (SDD/decisión de IA: se edita in situ sin
// rutas nuevas). Un solo toggle por página revela los inputs del check-in y las
// acciones de las colecciones; las secciones leen `editing` de este contexto.
interface EditModeCtx {
  editing: boolean;
  setEditing: (v: boolean) => void;
}

const Ctx = createContext<EditModeCtx | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return <Ctx.Provider value={{ editing, setEditing }}>{children}</Ctx.Provider>;
}

export function useEditMode(): EditModeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEditMode fuera de EditModeProvider');
  return ctx;
}

// Botón que alterna el modo. Lo monta la cabecera de la página (no las secciones),
// para que un solo lugar controle el estado y las secciones sólo lo consuman.
export function EditModeToggle() {
  const { editing, setEditing } = useEditMode();
  return (
    <button
      type="button"
      onClick={() => setEditing(!editing)}
      className="no-print"
      style={{
        height: 34,
        padding: '0 16px',
        borderRadius: 8,
        border: `1px solid ${editing ? C.navy700 : C.gray300}`,
        background: editing ? C.navy700 : C.white,
        color: editing ? C.white : C.navy700,
        fontFamily: FONT.head,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {editing ? 'Listo' : 'Editar'}
    </button>
  );
}
