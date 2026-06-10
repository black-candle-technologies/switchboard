import type { ReactNode } from "react";

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
              <td className="sb-empty-state" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
