'use client';

import type { CSSProperties, ReactNode } from 'react';
import { C, FONT } from '../../lib/ds-tokens';
import type { ApiError } from './useApiWrite';

// Primitivas de formulario del Design System de escritura. Reusan la paleta y las
// fuentes de lib/ds-tokens — no inventan estilos nuevos. Las comparten B1–B5.

const inputBase: CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  borderRadius: 6,
  border: `1px solid ${C.gray300}`,
  background: C.white,
  color: C.gray900,
  fontSize: 14,
  fontFamily: FONT.body,
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: C.gray600,
  marginBottom: 4,
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input style={inputBase} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea
        style={{ ...inputBase, height: 'auto', padding: 10, resize: 'vertical' }}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

// Porcentaje: la UI trabaja en 0–100 pero el contrato es fracción 0–1. Este campo
// muestra 0–100 y devuelve la fracción, para no repetir la conversión en cada form.
export function PctField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (fraccion: number | null) => void;
}) {
  const shown = value === null ? '' : String(Math.round(value * 100));
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          style={{ ...inputBase, width: 90, fontFamily: FONT.mono }}
          type="number"
          min={0}
          max={100}
          value={shown}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(null);
            const n = Number(raw);
            onChange(Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : null);
          }}
        />
        <span style={{ fontSize: 14, color: C.gray600 }}>%</span>
      </div>
    </Field>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <input style={{ ...inputBase, fontFamily: FONT.mono }} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <select style={inputBase} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

const buttonStyles: Record<ButtonKind, CSSProperties> = {
  primary: { background: C.navy700, color: C.white, border: `1px solid ${C.navy700}` },
  secondary: { background: C.white, color: C.navy700, border: `1px solid ${C.gray300}` },
  danger: { background: C.white, color: C.rojoFg, border: `1px solid ${C.rojo}` },
};

export function Button({
  children,
  onClick,
  kind = 'primary',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="no-print"
      style={{
        height: 34,
        padding: '0 16px',
        borderRadius: 8,
        fontFamily: FONT.head,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...buttonStyles[kind],
      }}
    >
      {children}
    </button>
  );
}

// Acciones compactas de una fila (editar/resolver/quitar), estilo texto-link.
export function RowAction({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="no-print"
      style={{
        background: 'none',
        border: 'none',
        padding: '2px 6px',
        color: danger ? C.rojoFg : C.navy700,
        fontFamily: FONT.body,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function ErrorText({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <p style={{ margin: '8px 0 0', fontSize: 13, color: C.rojoFg }} role="alert">
      {error.message}
    </p>
  );
}

// Modal simple centrado sobre un velo. No dispara diálogos nativos del navegador
// (que bloquearían la automatización); es puro DOM. Cierra con el velo o "Cerrar".
export function Modal({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      className="no-print"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,47,92,0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
        zIndex: 50,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: 10,
          border: `1px solid ${C.gray200}`,
          boxShadow: '0 12px 32px rgba(10,47,92,0.22)',
          width: '100%',
          maxWidth: width,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: `1px solid ${C.gray200}`,
          }}
        >
          <h3 style={{ margin: 0, fontFamily: FONT.head, fontSize: 17, fontWeight: 600, color: C.navy900 }}>{title}</h3>
          <RowAction onClick={onClose}>Cerrar</RowAction>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      </div>
    </div>
  );
}

// Cabecera de sección con acción a la derecha (ej. "+ agregar" en modo edición).
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        margin: '32px 0 12px',
        gap: 12,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontFamily: FONT.head,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: C.gray900,
        }}
      >
        {title}
      </h3>
      {action}
    </div>
  );
}
