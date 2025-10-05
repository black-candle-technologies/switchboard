// src/components/form/RelationSelect.tsx
import { prisma } from "@/lib/prisma";

type Props = {
  name: string;
  model: string;           // Prisma model name, e.g. "User"
  valueKey?: string;       // defaults to "id"
  labelKey?: string;       // defaults to "name" | "title" | "id"
  defaultValue?: string | null;
  className?: string;
};

type Row = Record<string, unknown>;

const guessLabelKey = (keys: string[]) => {
  if (keys.includes("name")) return "name";
  if (keys.includes("title")) return "title";
  return "id";
};

export default async function RelationSelect({
  name,
  model,
  valueKey = "id",
  labelKey,
  defaultValue,
  className = "mt-1 w-full rounded border px-3 py-2",
}: Props) {
  // dynamic model access → type it as unknown rows and narrow to a key/value record
  // @ts-expect-error dynamic access to prisma model by name
  const raw = (await prisma[model.toLowerCase()].findMany({ take: 1000 })) as unknown;

  const rows: Row[] = Array.isArray(raw) ? (raw as Row[]) : [];

  const keys = rows.length ? Object.keys(rows[0]) : [];
  const label = labelKey ?? guessLabelKey(keys);

  const get = (row: Row, key: string): string => {
    const v = row[key];
    return v == null ? "" : String(v);
  };

  return (
    <select name={name} defaultValue={defaultValue ?? ""} className={className}>
      <option value="">-- Select --</option>
      {rows.map((row) => {
        const val = get(row, valueKey);
        const lbl = get(row, label);
        return (
          <option key={val} value={val}>
            {lbl}
          </option>
        );
      })}
    </select>
  );
}
