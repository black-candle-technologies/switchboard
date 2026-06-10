import path from "path";

export function supportFiles(layout) {
  const switchboardImport = "@/switchboard";
  return [
    {
      path: path.join(layout.libDir, "prisma.ts"),
      content: `import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export { prisma };
`,
    },
    {
      path: path.join(layout.switchboardDir, "types.ts"),
      content: `export type TextWidget = { type: "text"; placeholder?: string };
export type EmailWidget = { type: "email"; placeholder?: string };
export type TextareaWidget = {
  type: "textarea";
  rows?: number;
  placeholder?: string;
};
export type CheckboxWidget = { type: "checkbox" };
export type DatetimeWidget = { type: "datetime" };
export type SelectWidget = {
  type: "select";
  options: { value: string; label: string }[];
};
export type RelationWidget = {
  type: "relation";
  model: string;
  valueKey?: string;
  labelKey?: string;
};

export type FieldWidget =
  | TextWidget
  | EmailWidget
  | TextareaWidget
  | CheckboxWidget
  | DatetimeWidget
  | SelectWidget
  | RelationWidget;

export type FieldConfig = {
  name: string;
  label: string;
  required?: boolean;
  width?: string;
  widget: FieldWidget;
};

export type ColumnConfig = {
  key: string;
  header?: string;
  format?: "datetime" | "date" | "boolean";
};
export type SortConfig = { key: string; dir: "asc" | "desc" };
export type ListConfig = {
  perPage?: number;
  searchable?: string[];
  columns?: ColumnConfig[];
  defaultSort?: SortConfig;
};

export type ResourceConfig<T = unknown> = {
  resource: string;
  displayName: string;
  fields: FieldConfig[];
  list?: ListConfig;
} & Record<never, T>;
`,
    },
    {
      path: path.join(layout.switchboardDir, "overrides.ts"),
      content: `import type { ResourceConfig } from "${switchboardImport}/types";

export type ResourcePatch<T = unknown> = Partial<ResourceConfig<T>>;

export function mergeResource<T>(
  base: ResourceConfig<T>,
  patch?: ResourcePatch<T>,
): ResourceConfig<T> {
  const resolvedPatch = patch ?? {};
  return {
    ...base,
    ...resolvedPatch,
    fields: resolvedPatch.fields ?? base.fields,
    list: { ...(base.list ?? {}), ...(resolvedPatch.list ?? {}) },
  };
}

export const overrides: Readonly<
  Partial<Record<string, ResourcePatch<unknown>>>
> = {};
`,
    },
    {
      path: path.join(layout.switchboardDir, "registry.ts"),
      content: `import type { ResourceConfig } from "${switchboardImport}/types";

export const resources: ResourceConfig[] = [];
`,
    },
    {
      path: path.join(layout.componentsDir, "form", "SmartForm.tsx"),
      content: `"use client";

import type { FieldConfig } from "${switchboardImport}/types";

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
`,
    },
    {
      path: path.join(layout.componentsDir, "table", "SimpleTable.tsx"),
      content: `import type { ReactNode } from "react";

export type Column<T> = {
  key: Extract<keyof T, string> | string;
  header?: string;
  width?: string;
  cell?: (row: T) => ReactNode;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
};

export function SimpleTable<T>({
  rows,
  columns,
  empty = "No records found.",
}: Props<T>) {
  return (
    <div className="sb-table-wrap">
      <table className="sb-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>
                {column.header ?? String(column.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={String(column.key)}>
                  {column.cell
                    ? column.cell(row)
                    : String(
                        (row as unknown as Record<string, unknown>)[
                          String(column.key)
                        ] ?? "",
                      )}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                className="sb-empty-state"
                colSpan={columns.length}
              >
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
`,
    },
    {
      path: path.join(layout.appDir, "admin", "switchboard.css"),
      content: `:root {
  --sb-bg: #f4f6f8;
  --sb-surface: #ffffff;
  --sb-surface-muted: #f8fafc;
  --sb-border: #dfe4ea;
  --sb-text: #17202a;
  --sb-muted: #64748b;
  --sb-accent: #1d4ed8;
  --sb-accent-hover: #1e40af;
  --sb-danger: #b42318;
  --sb-radius: 10px;
  --sb-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

body {
  margin: 0;
}

.sb-admin-shell {
  min-height: 100vh;
  background: var(--sb-bg);
  color: var(--sb-text);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  line-height: 1.5;
}

.sb-admin-shell *,
.sb-admin-shell *::before,
.sb-admin-shell *::after {
  box-sizing: border-box;
}

.sb-admin-shell a {
  color: inherit;
  text-decoration: none;
}

.sb-admin-header {
  border-bottom: 1px solid var(--sb-border);
  background: var(--sb-surface);
}

.sb-admin-nav,
.sb-admin-main {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
}

.sb-admin-nav {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.sb-admin-brand {
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.sb-admin-home-link,
.sb-action-link,
.sb-table a {
  color: var(--sb-accent);
  font-weight: 600;
}

.sb-admin-home-link:hover,
.sb-action-link:hover,
.sb-table a:hover {
  text-decoration: underline;
}

.sb-admin-main {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 28px;
  padding: 28px 0 48px;
}

.sb-admin-sidebar {
  position: sticky;
  top: 24px;
  align-self: start;
}

.sb-resource-nav,
.sb-card {
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius);
  background: var(--sb-surface);
  box-shadow: var(--sb-shadow);
}

.sb-resource-nav {
  padding: 16px;
}

.sb-resource-nav-title,
.sb-eyebrow {
  margin: 0 0 8px;
  color: var(--sb-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sb-resource-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sb-resource-link {
  display: block;
  padding: 9px 10px;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 600;
}

.sb-resource-link:hover {
  background: var(--sb-surface-muted);
  color: var(--sb-accent);
}

.sb-admin-content,
.sb-page {
  min-width: 0;
}

.sb-page {
  display: grid;
  gap: 18px;
}

.sb-page-narrow {
  max-width: 720px;
}

.sb-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.sb-page-title {
  margin: 0;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.sb-page-description {
  margin: 6px 0 0;
  color: var(--sb-muted);
}

.sb-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}

.sb-resource-card {
  display: block;
  padding: 20px;
  transition:
    border-color 150ms ease,
    transform 150ms ease;
}

.sb-resource-card:hover {
  border-color: #9fb7e8;
  transform: translateY(-1px);
}

.sb-resource-card-title {
  display: block;
  margin-bottom: 4px;
  font-size: 17px;
  font-weight: 700;
}

.sb-resource-card-copy {
  color: var(--sb-muted);
  font-size: 14px;
}

.sb-button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border: 1px solid var(--sb-accent);
  border-radius: 8px;
  background: var(--sb-accent);
  color: #ffffff !important;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.sb-button:hover {
  border-color: var(--sb-accent-hover);
  background: var(--sb-accent-hover);
  text-decoration: none !important;
}

.sb-button-secondary {
  border-color: var(--sb-border);
  background: var(--sb-surface);
  color: var(--sb-text) !important;
}

.sb-button-secondary:hover {
  border-color: #b9c2cc;
  background: var(--sb-surface-muted);
}

.sb-button-danger {
  border: 0;
  background: transparent;
  color: var(--sb-danger);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.sb-button-danger:hover {
  text-decoration: underline;
}

.sb-search-form,
.sb-form-actions,
.sb-actions,
.sb-pagination {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sb-search-form {
  max-width: 540px;
}

.sb-input {
  width: 100%;
  min-height: 40px;
  padding: 9px 11px;
  border: 1px solid #cbd3dc;
  border-radius: 8px;
  background: var(--sb-surface);
  color: var(--sb-text);
  font: inherit;
  font-size: 14px;
}

.sb-input:focus {
  border-color: var(--sb-accent);
  outline: 3px solid rgba(29, 78, 216, 0.14);
}

.sb-form {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.sb-form-row {
  display: grid;
  gap: 7px;
}

.sb-label {
  font-size: 14px;
  font-weight: 650;
}

.sb-checkbox-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.sb-checkbox {
  width: 17px;
  height: 17px;
  accent-color: var(--sb-accent);
}

.sb-form-actions {
  padding-top: 4px;
}

.sb-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius);
  background: var(--sb-surface);
  box-shadow: var(--sb-shadow);
}

.sb-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 14px;
}

.sb-table th {
  padding: 12px 14px;
  border-bottom: 1px solid var(--sb-border);
  background: var(--sb-surface-muted);
  color: #475569;
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.sb-table td {
  padding: 13px 14px;
  border-bottom: 1px solid #edf0f3;
  vertical-align: middle;
}

.sb-table tbody tr:last-child td {
  border-bottom: 0;
}

.sb-table tbody tr:hover:not(:only-child) {
  background: #fbfcfd;
}

.sb-empty-state {
  padding: 42px 20px !important;
  color: var(--sb-muted);
  text-align: center;
}

.sb-pagination {
  justify-content: space-between;
  color: var(--sb-muted);
  font-size: 14px;
}

.sb-pagination-actions {
  display: flex;
  gap: 8px;
}

.sb-pagination-link {
  padding: 7px 11px;
  border: 1px solid var(--sb-border);
  border-radius: 7px;
  background: var(--sb-surface);
  color: var(--sb-text);
  font-weight: 600;
}

.sb-pagination-link:hover {
  border-color: #b9c2cc;
  background: var(--sb-surface-muted);
}

.sb-is-disabled {
  pointer-events: none;
  opacity: 0.45;
}

@media (max-width: 760px) {
  .sb-admin-main {
    grid-template-columns: 1fr;
  }

  .sb-admin-sidebar {
    position: static;
  }

  .sb-resource-list {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .sb-page-header,
  .sb-search-form {
    align-items: stretch;
    flex-direction: column;
  }

  .sb-page-header .sb-button,
  .sb-search-form .sb-button {
    width: 100%;
  }
}
`,
    },
    {
      path: path.join(layout.appDir, "admin", "layout.tsx"),
      content: `import "./switchboard.css";
import Link from "next/link";
import { resources } from "${switchboardImport}/registry";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sb-admin-shell">
      <header className="sb-admin-header">
        <nav className="sb-admin-nav">
          <Link className="sb-admin-brand" href="/admin">
            Switchboard
          </Link>
          <Link className="sb-admin-home-link" href="/">
            Back to site
          </Link>
        </nav>
      </header>
      <main className="sb-admin-main">
          <aside className="sb-admin-sidebar">
            <nav className="sb-resource-nav" aria-label="Admin resources">
              <h2 className="sb-resource-nav-title">Resources</h2>
              <ul className="sb-resource-list">
                {resources.map((resource) => (
                  <li key={resource.resource}>
                    <Link
                      className="sb-resource-link"
                      href={"/admin/" + resource.resource.toLowerCase() + "s"}
                    >
                      {resource.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          <section className="sb-admin-content">{children}</section>
      </main>
    </div>
  );
}
`,
    },
    {
      path: path.join(layout.appDir, "admin", "page.tsx"),
      content: `import Link from "next/link";
import { resources } from "${switchboardImport}/registry";

export default function AdminIndex() {
  return (
    <section className="sb-page">
      <div className="sb-page-header">
        <div>
          <p className="sb-eyebrow">Switchboard</p>
          <h1 className="sb-page-title">Admin dashboard</h1>
          <p className="sb-page-description">
            Choose a resource to view and manage its records.
          </p>
        </div>
      </div>
      {resources.length ? (
        <div className="sb-dashboard-grid">
          {resources.map((resource) => (
            <Link
              className="sb-card sb-resource-card"
              href={"/admin/" + resource.resource.toLowerCase() + "s"}
              key={resource.resource}
            >
              <span className="sb-resource-card-title">
                {resource.displayName}
              </span>
              <span className="sb-resource-card-copy">
                View and manage {resource.displayName.toLowerCase()}.
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="sb-card sb-empty-state">
          Run npx switchboard generate --pages to add resources.
        </div>
      )}
    </section>
  );
}
`,
    },
  ];
}
