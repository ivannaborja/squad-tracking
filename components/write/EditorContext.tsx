'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Auditoría blanda (SDD/ARD): sin login real, editado_por es un selector
// auto-declarado. Se elige una vez por sesión y viaja en cada escritura que lo
// use (check-in, import). Se persiste en localStorage para no re-preguntar.
export type Editor = 'Equipo de Agile Coach' | 'Equipo dev';

const EDITORES: Editor[] = ['Equipo de Agile Coach', 'Equipo dev'];
const STORAGE_KEY = 'seguimiento.editadoPor';

interface EditorCtx {
  editadoPor: Editor;
  setEditadoPor: (e: Editor) => void;
}

const Ctx = createContext<EditorCtx | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [editadoPor, setEditadoPor] = useState<Editor>('Equipo de Agile Coach');

  // Se hidrata del localStorage después del primer render: leerlo en el render
  // rompería el SSR (no existe window) y daría mismatch de hidratación. Sincronizar
  // estado de React desde un sistema externo es justo para lo que existe el efecto.
  useEffect(() => {
    const guardado = window.localStorage.getItem(STORAGE_KEY);
    if (guardado && (EDITORES as string[]).includes(guardado)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación one-shot desde localStorage
      setEditadoPor(guardado as Editor);
    }
  }, []);

  const set = (e: Editor) => {
    setEditadoPor(e);
    window.localStorage.setItem(STORAGE_KEY, e);
  };

  return <Ctx.Provider value={{ editadoPor, setEditadoPor: set }}>{children}</Ctx.Provider>;
}

export function useEditor(): EditorCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEditor fuera de EditorProvider');
  return ctx;
}

export { EDITORES };
