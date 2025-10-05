// src/switchboard/config.ts
import type { ResourceConfig } from "./types";

export type UserShape = {
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "USER";
};

export const UserResource: ResourceConfig<UserShape> = {
  resource: "User",
  displayName: "Users",
  fields: [
    { name: "name",  label: "Name",  required: true, widget: { type: "text" } },
    { name: "email", label: "Email", required: true, widget: { type: "email" } },
    {
      name: "role",
      label: "Role",
      required: true,
      widget: {
        type: "select",
        options: [
          { value: "ADMIN",   label: "ADMIN" },
          { value: "MANAGER", label: "MANAGER" },
          { value: "USER",    label: "USER" },
        ],
      },
    },
  ],
};
