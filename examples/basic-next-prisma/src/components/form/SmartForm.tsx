"use client";

import type { FieldConfig } from "@/switchboard/types";

type Props = {
  title: string;
  fields: FieldConfig[];
  initialValues?: Record<string, unknown>;
  submitLabel?: string;
  cancelHref?: string;
  action: (formData: FormData) => Promise<void>;
};

export function SmartForm({
  title,
  fields,
  initialValues = {},
  submitLabel = "Save",
  cancelHref,
  action,
}: Props) {
  return (
    <section className="sb-page sb-page-narrow">
      <div className="sb-page-header">
        <div>
          <p className="sb-eyebrow">Resource editor</p>
          <h1 className="sb-page-title">{title}</h1>
        </div>
      </div>
      <form action={action} className="sb-card sb-form">
        {fields.map((field) => {
          const value = initialValues[field.name];
          if (field.widget.type === "select") {
            return (
              <label className="sb-form-row" key={field.name}>
                <span className="sb-label">{field.label}</span>
                <select
                  className="sb-input"
                  defaultValue={String(value ?? "")}
                  name={field.name}
                  required={field.required}
                >
                  <option value="" />
                  {field.widget.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          if (field.widget.type === "textarea") {
            return (
              <label className="sb-form-row" key={field.name}>
                <span className="sb-label">{field.label}</span>
                <textarea
                  className="sb-input"
                  defaultValue={String(value ?? "")}
                  name={field.name}
                  required={field.required}
                  rows={field.widget.rows ?? 4}
                />
              </label>
            );
          }
          if (field.widget.type === "checkbox") {
            return (
              <label className="sb-checkbox-row" key={field.name}>
                <input
                  className="sb-checkbox"
                  defaultChecked={Boolean(value)}
                  name={field.name}
                  type="checkbox"
                />
                <span className="sb-label">{field.label}</span>
              </label>
            );
          }
          const inputType =
            field.widget.type === "email"
              ? "email"
              : field.widget.type === "datetime"
                ? "datetime-local"
                : "text";
          return (
            <label className="sb-form-row" key={field.name}>
              <span className="sb-label">{field.label}</span>
              <input
                className="sb-input"
                defaultValue={String(value ?? "")}
                name={field.name}
                required={field.required}
                type={inputType}
              />
            </label>
          );
        })}
        <div className="sb-form-actions">
          <button className="sb-button" type="submit">
            {submitLabel}
          </button>
          {cancelHref ? (
            <a className="sb-button sb-button-secondary" href={cancelHref}>
              Cancel
            </a>
          ) : null}
        </div>
      </form>
    </section>
  );
}
