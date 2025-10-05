"use client";

import React from "react";
import type { FieldConfig } from "@/switchboard/types";
import RelationSelect from "./RelationSelect";

type SmartFormProps<T extends Record<string, unknown>> = {
  title: string;
  fields: FieldConfig[];
  initialValues?: T;
  submitLabel?: string;
  cancelHref?: string;
  action: (formData: FormData) => Promise<void>;
};

export function SmartForm<T extends Record<string, unknown>>({
  title,
  fields,
  initialValues,
  submitLabel = "Save",
  cancelHref,
  action,
}: SmartFormProps<T>) {
  const renderField = (f: FieldConfig) => {
    const rawVal = initialValues?.[f.name];
    const defaultVal = typeof rawVal === "string" ? rawVal : rawVal != null ? String(rawVal) : "";

    switch (f.widget.type) {
      case "textarea":
        return (
          <textarea
            name={f.name}
            rows={f.widget.rows ?? 6}
            placeholder={f.widget.placeholder}
            className="mt-1 w-full rounded border px-3 py-2"
            defaultValue={defaultVal}
            required={f.required}
          />
        );

      case "email":
        return (
          <input
            type="email"
            name={f.name}
            placeholder={f.widget.placeholder}
            className="mt-1 w-full rounded border px-3 py-2"
            defaultValue={defaultVal}
            required={f.required}
          />
        );

      case "checkbox":
        return (
          <input
            type="checkbox"
            name={f.name}
            className="h-4 w-4"
            defaultChecked={Boolean(rawVal)}
          />
        );

      case "datetime":
        return (
          <input
            type="datetime-local"
            name={f.name}
            className="mt-1 w-full rounded border px-3 py-2"
            defaultValue={
              rawVal
                ? new Date(String(rawVal)).toISOString().slice(0, 16)
                : ""
            }
          />
        );

      case "select":
        return (
          <select
            name={f.name}
            defaultValue={defaultVal}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {f.widget.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );

      case "relation":
        return (
          <RelationSelect
            name={f.name}
            model={f.widget.model}
            valueKey={f.widget.valueKey}
            labelKey={f.widget.labelKey}
            defaultValue={defaultVal}
          />
        );

      default:
        return (
          <input
            type="text"
            name={f.name}
            placeholder={(f.widget as { placeholder?: string }).placeholder}
            className="mt-1 w-full rounded border px-3 py-2"
            defaultValue={defaultVal}
            required={f.required}
          />
        );
    }
  };

  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <form action={action} className="space-y-3 rounded border bg-white p-4">
        {fields.map((f) => (
          <div key={f.name} style={f.width ? { width: f.width } : undefined}>
            <label className="block text-sm font-medium">{f.label}</label>
            {renderField(f)}
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
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
