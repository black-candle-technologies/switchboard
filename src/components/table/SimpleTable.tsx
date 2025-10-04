// src/components/table/SimpleTable.tsx
import React from "react";

export type Column<T> = {
  key: keyof T;
  header: string;
  width?: string;
  cell?: (row: T) => React.ReactNode;
};

type SimpleTableProps<T extends { id?: string | number }> = {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
  actions?: (row: T) => React.ReactNode;
  className?: string;
};

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
                {c.header}
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

          {rows.map((row, i) => (
            <tr className="border-t" key={row.id ?? i}>
              {columns.map((c) => (
                <td key={String(c.key)} className="px-3 py-2">
                  {c.cell ? c.cell(row) : String(row[c.key])}
                </td>
              ))}
              {actions && <td className="px-3 py-2">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
