// src/components/table/SimpleTable.tsx
import React from "react";

type Accessor<T> = (row: T) => React.ReactNode;

export type Column<T> = {
  key: Extract<keyof T, string> | string;
  header?: string;
  width?: string;
  cell?: Accessor<T>;
};

type SimpleTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
  actions?: (row: T) => React.ReactNode;
  className?: string;
};

/** Safely read a value from an object using a string key, no `any`. */
function getValue<T>(row: T, key: string): unknown {
  const obj = row as unknown as Record<string, unknown>;
  return obj[key];
}

export function SimpleTable<T extends { id?: string | number }>({
  rows,
  columns,
  empty = "No records found.",
  actions,
  className = "",
}: SimpleTableProps<T>) {
  return (
    <div className={`overflow-x-auto rounded border bg-white ${className}`}>
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className="px-3 py-2"
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header ?? String(c.key)}
              </th>
            ))}
            {actions && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                className="px-3 py-6 text-center text-gray-500"
                colSpan={columns.length + (actions ? 1 : 0)}
              >
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr className="border-t" key={r.id ?? i}>
              {columns.map((c) => {
                const key = String(c.key);
                return (
                  <td key={key} className="px-3 py-2">
                    {c.cell ? c.cell(r) : String(getValue(r, key) ?? "")}
                  </td>
                );
              })}
              {actions && <td className="px-3 py-2">{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
