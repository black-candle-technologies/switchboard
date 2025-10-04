// src/switchboard.config.ts
import type { Column } from "@/components/table/SimpleTable";
import type { FieldConfig, SelectOption } from "@/components/form/Form";
import type { Role, User } from "@prisma/client";

type ResourceConfig<T> = {
  label: string;
  list: {
    columns: Column<T>[];
  };
  form: {
    fields: FieldConfig[];
  };
};

const roleOptions: SelectOption[] = [
  { label: "ADMIN", value: "ADMIN" },
  { label: "MANAGER", value: "MANAGER" },
  { label: "USER", value: "USER" },
];

export const UsersResource: ResourceConfig<User> = {
  label: "Users",
  list: {
    columns: [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "role", header: "Role" },
      { key: "createdAt", header: "Created", cell: (u) => new Date(u.createdAt).toLocaleString() },
    ],
  },
  form: {
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "email", label: "Email", kind: "email", required: true },
      { name: "role", label: "Role", kind: "select", required: true, options: roleOptions },
    ],
  },
};
