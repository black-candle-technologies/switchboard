// src/components/form/SmartForm.tsx
"use client";
import React from "react";
import type { FieldConfig } from "@/switchboard/types";

type Props = {
  title: string;
  fields: FieldConfig[];
  initialValues?: Record<string, unknown>;
  submitLabel?: string;
  cancelHref?: string;
  action: (formData: FormData) => Promise<void>;
};

export function SmartForm({ title, fields, initialValues = {}, submitLabel = "Save", cancelHref, action }: Props) {
  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <form action={action} className="space-y-4 rounded border bg-white p-4">
        {fields.map((f) => {
          const name = f.name;
          const label = f.label;
          const value = (initialValues as Record<string, unknown>)[name];

          switch (f.widget.type) {
            case "select":
              return (
                <div key={name}>
                  <label className="block text-sm font-medium">{label}</label>
                  <select
                    name={name}
                    defaultValue={String(value ?? "")}
                    className="mt-1 w-full rounded border px-3 py-2"
                    required={f.required}
                  >
                    <option value=""></option>
                    {f.widget.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );

            case "textarea":
              return (
                <div key={name}>
                  <label className="block text-sm font-medium">{label}</label>
                  <textarea
                    name={name}
                    defaultValue={String(value ?? "")}
                    rows={f.widget.rows ?? 4}
                    placeholder={("placeholder" in f.widget && f.widget.placeholder) || ""}
                    className="mt-1 w-full rounded border px-3 py-2"
                    required={f.required}
                  />
                </div>
              );

            case "email":
              return (
                <div key={name}>
                  <label className="block text-sm font-medium">{label}</label>
                  <input
                    type="email"
                    name={name}
                    defaultValue={String(value ?? "")}
                    placeholder={f.widget.placeholder}
                    className="mt-1 w-full rounded border px-3 py-2"
                    required={f.required}
                  />
                </div>
              );

            case "checkbox":
              return (
                <div key={name} className="flex items-center gap-2">
                  <input type="checkbox" name={name} defaultChecked={Boolean(value)} className="h-4 w-4" />
                  <label className="text-sm">{label}</label>
                </div>
              );

            case "datetime":
              return (
                <div key={name}>
                  <label className="block text-sm font-medium">{label}</label>
                  <input
                    type="datetime-local"
                    name={name}
                    defaultValue={typeof value === "string" ? value : ""}
                    className="mt-1 w-full rounded border px-3 py-2"
                    required={f.required}
                  />
                </div>
              );

            case "text":
            default:
              return (
                <div key={name}>
                  <label className="block text-sm font-medium">{label}</label>
                  <input
                    name={name}
                    defaultValue={String(value ?? "")}
                    placeholder={("placeholder" in f.widget && f.widget.placeholder) || ""}
                    className="mt-1 w-full rounded border px-3 py-2"
                    required={f.required}
                  />
                </div>
              );
          }
        })}

        <div className="flex gap-2">
          <button type="submit" className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
            {submitLabel}
          </button>
          {cancelHref && (
            <a href={cancelHref} className="rounded border px-3 py-2 text-sm">
              Cancel
            </a>
          )}
        </div>
      </form>
    </section>
  );
}
