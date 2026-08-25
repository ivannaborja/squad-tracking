'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

// La forma de error única del contrato (api.md): { error: { code, message } }.
export interface ApiError {
  code: string;
  message: string;
}

interface MutateOpts {
  url: string;
  method?: 'POST' | 'PATCH' | 'DELETE';
  json?: unknown; // cuerpo JSON (POST/PATCH); se ignora en DELETE sin body
  body?: BodyInit; // cuerpo crudo (multipart del import); excluyente con json
  refresh?: boolean; // default true: re-render del Server Component tras escribir
}

// Envoltorio único de escritura contra /api/*: parsea el sobre de error, refresca
// la página al éxito (las páginas son Server Components → traen color/datos
// recomputados de la base) y expone pending/error para la UI. No inyecta
// editado_por: quien lo necesita (check-in, import) lo pasa en `json` desde
// useEditor(), porque el resto de las entidades no tienen ese campo.
export function useApiWrite() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async <T = unknown>(opts: MutateOpts): Promise<T | null> => {
      setPending(true);
      setError(null);
      try {
        const init: RequestInit = { method: opts.method ?? 'POST' };
        if (opts.json !== undefined) {
          init.headers = { 'Content-Type': 'application/json' };
          init.body = JSON.stringify(opts.json);
        } else if (opts.body !== undefined) {
          init.body = opts.body;
        }
        const res = await fetch(opts.url, init);
        const data = res.status === 204 ? null : await res.json().catch(() => null);
        if (!res.ok) {
          const err: ApiError =
            data && typeof data === 'object' && 'error' in data
              ? (data as { error: ApiError }).error
              : { code: String(res.status), message: 'Error inesperado' };
          setError(err);
          return null;
        }
        if (opts.refresh !== false) router.refresh();
        return data as T;
      } catch (e) {
        setError({ code: 'network', message: e instanceof Error ? e.message : 'Error de red' });
        return null;
      } finally {
        setPending(false);
      }
    },
    [router]
  );

  return { pending, error, setError, mutate };
}
