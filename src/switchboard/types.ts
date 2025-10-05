// src/switchboard/types.ts
import React from "react";

export type TextWidget = { type: "text"; placeholder?: string };
export type TextAreaWidget = { type: "textarea"; rows?: number; placeholder?: string };
export type EmailWidget = { type: "email"; placeholder?: string };
export type CheckboxWidget = { type: "checkbox" };
export type DateTimeWidget = { type: "datetime" };
export type SelectWidget = { type: "select"; options: { value: string; label: string }[] };
export type RelationWidget = {
  type: "relation";
  model: string;        // Prisma model name, e.g. "User"
  valueKey?: string;    // defaults to "id"
  labelKey?: string;    // defaults to "name" | "title" | "id"
};

export type Widget =
  | TextWidget
  | TextAreaWidget
  | EmailWidget
  | CheckboxWidget
  | DateTimeWidget
  | SelectWidget
  | RelationWidget;

export type FieldConfig = {
  name: string;
  label: string;
  required?: boolean;
  widget: Widget;
  width?: string;
};

export type ListConfig = {
  perPage?: number;              // default 20
  searchable?: string[];         // field names to search "contains" on
  columns?: Array<{
    key: string;
    header?: string;
    width?: string;
    format?: "date" | "datetime" | "boolean"; // display helpers
  }>;
  defaultSort?: { key: string; dir: "asc" | "desc" };
};

export type ResourceConfig<T> = {
  resource: string;       // Prisma model name (singular)
  displayName: string;    // "Users"
  fields: FieldConfig[];
  list?: ListConfig;
};
