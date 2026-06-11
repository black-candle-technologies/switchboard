"use client";

import { useActionState } from "react";

import type { FieldConfig } from "@/switchboard/types";
import type { FormActionState, RelationOption } from "@/switchboard/types";

type Props = {
  title: string;
  fields: FieldConfig[];
  initialValues?: Record<string, unknown>;
  relationOptions?: Record<string, RelationOption[]>;
  submitLabel?: string;
  cancelHref?: string;
  action: (
    previousState: FormActionState,
    formData: FormData,
  ) => Promise<FormActionState>;
};

export function SmartForm({
  title,
  fields,
  initialValues = {},
  relationOptions = {},
  submitLabel = "Save",
  cancelHref,
  action,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <section className="sb-page sb-page-narrow">
      <div className="sb-page-header">
        <div>
          <p className="sb-eyebrow">Resource editor</p>
          <h1 className="sb-page-title">{title}</h1>
        </div>
      </div>
      <form action={formAction} className="sb-card sb-form">
        {state.error ? (
          <p className="sb-form-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {fields.map((field) => {
          const value = initialValues[field.name];
          if (
            field.widget.type === "select" ||
            field.widget.type === "relation"
          ) {
            const options =
              field.widget.type === "select"
                ? field.widget.options
                : (relationOptions[field.name] ?? []);
            return (
              <label className="sb-form-field" key={field.name}>
                <span className="sb-form-label">{field.label}</span>
                <select
                  className="sb-form-control sb-select"
                  defaultValue={String(value ?? "")}
                  name={field.name}
                  required={field.required}
                >
                  <option value="" />
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          if (
            field.widget.type === "textarea" ||
            field.widget.type === "json"
          ) {
            return (
              <label className="sb-form-field" key={field.name}>
                <span className="sb-form-label">{field.label}</span>
                <textarea
                  className="sb-form-control sb-textarea"
                  defaultValue={String(value ?? "")}
                  name={field.name}
                  required={field.required}
                  rows={field.widget.rows ?? 6}
                />
              </label>
            );
          }
          if (field.widget.type === "checkbox") {
            if (field.widget.nullable) {
              return (
                <label className="sb-form-field" key={field.name}>
                  <span className="sb-form-label">{field.label}</span>
                  <select
                    className="sb-form-control sb-select"
                    defaultValue={
                      value === null || value === undefined
                        ? ""
                        : String(Boolean(value))
                    }
                    name={field.name}
                    required={field.required}
                  >
                    <option value="">Not set</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
              );
            }
            return (
              <label
                className="sb-form-field sb-checkbox-field"
                key={field.name}
              >
                <input
                  className="sb-checkbox"
                  defaultChecked={Boolean(value)}
                  name={field.name}
                  type="checkbox"
                  value="true"
                />
                <input name={field.name} type="hidden" value="false" />
                <span className="sb-form-label">{field.label}</span>
              </label>
            );
          }
          const inputType =
            field.widget.type === "email"
              ? "email"
              : field.widget.type === "password"
                ? "password"
                : field.widget.type === "number"
                  ? "number"
                  : field.widget.type === "datetime"
                    ? "datetime-local"
                    : "text";
          return (
            <label className="sb-form-field" key={field.name}>
              <span className="sb-form-label">{field.label}</span>
              <input
                className="sb-form-control"
                autoComplete={
                  field.widget.type === "password" ? "new-password" : undefined
                }
                defaultValue={
                  field.widget.type === "password" ? "" : String(value ?? "")
                }
                name={field.name}
                step={
                  field.widget.type === "number" ? field.widget.step : undefined
                }
                required={
                  field.required &&
                  !(
                    field.widget.type === "password" &&
                    Object.keys(initialValues).length > 0
                  )
                }
                type={inputType}
              />
            </label>
          );
        })}
        <div className="sb-form-actions">
          <button className="sb-button" disabled={isPending} type="submit">
            {isPending ? "Saving..." : submitLabel}
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
