// src/components/form/Form.tsx
import React from "react";

export type FieldKind = "text" | "email" | "select";
export type SelectOption = { label: string; value: string };

export type FieldConfig = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[]; // for select
};

export function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded border bg-white p-4">
      {title && <h2 className="text-sm font-semibold text-gray-700">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ cfg, defaultValue }: { cfg: FieldConfig; defaultValue?: string }) {
  const base = "mt-1 w-full rounded border px-3 py-2";
  if (cfg.kind === "select") {
    return (
      <div>
        <label className="block text-sm font-medium">{cfg.label}</label>
        <select
          name={cfg.name}
          defaultValue={defaultValue}
          className={base}
          required={cfg.required}
        >
          {(cfg.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const type = cfg.kind === "email" ? "email" : "text";
  return (
    <div>
      <label className="block text-sm font-medium">{cfg.label}</label>
      <input
        type={type}
        name={cfg.name}
        defaultValue={defaultValue}
        placeholder={cfg.placeholder}
        className={base}
        required={cfg.required}
      />
    </div>
  );
}

export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
      {children}
    </button>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="rounded border px-3 py-2 text-sm">
      {children}
    </a>
  );
}
