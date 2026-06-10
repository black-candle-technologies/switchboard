export type TextWidget = { type: "text"; placeholder?: string };
export type EmailWidget = { type: "email"; placeholder?: string };
export type PasswordWidget = { type: "password"; placeholder?: string };
export type NumberWidget = {
  type: "number";
  step?: string;
  placeholder?: string;
};
export type TextareaWidget = {
  type: "textarea";
  rows?: number;
  placeholder?: string;
};
export type JsonWidget = {
  type: "json";
  rows?: number;
  placeholder?: string;
};
export type CheckboxWidget = { type: "checkbox"; nullable?: boolean };
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
  | PasswordWidget
  | NumberWidget
  | TextareaWidget
  | JsonWidget
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
  format?: "datetime" | "date" | "boolean" | "json" | "relation";
  relationField?: string;
  relationLabelKey?: string;
};
export type SortConfig = { key: string; dir: "asc" | "desc" };
export type ListConfig = {
  perPage?: number;
  searchable?: string[];
  sortable?: string[];
  columns?: ColumnConfig[];
  defaultSort?: SortConfig;
};

export type FormActionState = {
  error?: string;
};

export type RelationOption = {
  value: string;
  label: string;
};

export type ResourceConfig<T = unknown> = {
  resource: string;
  displayName: string;
  fields: FieldConfig[];
  list?: ListConfig;
} & Record<never, T>;
