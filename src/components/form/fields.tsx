// src/components/form/fields.tsx
import React from "react";
import type { SelectOption } from "@/switchboard/types";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"mt-1 w-full rounded border px-3 py-2 " + (props.className ?? "")} />;
}

export function SelectInput(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }
) {
  const { options, className, ...rest } = props;
  return (
    <select
      {...rest}
      className={"mt-1 w-full rounded border px-3 py-2 " + (className ?? "")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
