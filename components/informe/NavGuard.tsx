'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { C } from '../../lib/ds-tokens';

// Guard de navegación para el modo edición del informe. El link de back vive fuera
// del NarrativaEditor (la página es Server Component), así que el "hay cambios sin
// guardar" viaja por este contexto: el editor lo empuja con setDirty y el BackLink
// lo lee para interceptar la salida.
interface NavGuardCtx {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
}

const Ctx = createContext<NavGuardCtx | null>(null);

export function NavGuardProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false);

  // beforeunload cubre el cierre de tab / recarga, que router no intercepta. Sólo
  // se arma el listener cuando hay cambios pendientes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return <Ctx.Provider value={{ isDirty, setDirty }}>{children}</Ctx.Provider>;
}

export function useNavGuard(): NavGuardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNavGuard fuera de NavGuardProvider');
  return ctx;
}

// Link de "← volver" que, si el editor tiene cambios sin guardar, pide confirmación
// antes de navegar. Conserva el destino etiquetado (href), sólo lo gatea.
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  const { isDirty } = useNavGuard();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    if (isDirty && !window.confirm('Tenés cambios sin guardar. ¿Salir de todas formas?')) return;
    router.push(href);
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className="no-print"
      style={{ fontSize: 14, fontWeight: 700, color: C.navy700, textDecoration: 'none' }}
    >
      {children}
    </Link>
  );
}
