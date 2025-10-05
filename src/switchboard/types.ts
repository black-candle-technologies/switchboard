// src/switchboard/types.ts

export type TextWidget = { type: "text"; placeholder?: string };
export type EmailWidget = { type: "email"; placeholder?: string };
export type TextareaWidget = { type: "textarea"; rows?: number; placeholder?: string };
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
  /** display hints */
  format?: "datetime" | "date" | "boolean";
};

export type SortConfig = {
  key: string;
  dir: "asc" | "desc";
};

/** Filter configuration for the FilterBar */
export type FilterConfig =
  | { type: "text"; key: string; label?: string; placeholder?: string }
  | { type: "select"; key: string; label?: string; options: { value: string; label: string }[] }
  | { type: "boolean"; key: string; label?: string }
  | { type: "dateRange"; key: string; label?: string }; // expects start/end params

export type ListConfig = {
  perPage?: number;
  searchable?: string[];
  columns?: ColumnConfig[];
  defaultSort?: SortConfig;
  /** New: Filters rendered at top of list; keys correspond to model fields */
  filters?: FilterConfig[];
};

export type ResourceConfig<T> = {
  resource: string; // Prisma model name, e.g., "Post"
  displayName: string; // e.g., "Posts"
  fields: FieldConfig[];
  list?: ListConfig;
};
