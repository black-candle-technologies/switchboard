import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { TaskResource } from "@/switchboard/generated/TaskResource";
import type { Column } from "@/components/table/SimpleTable";
import type { Task } from "@prisma/client";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const getStr = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

export default async function TaskListPage({ searchParams }: PageProps) {
  // query
  const q = getStr(searchParams?.q).trim();
  const page = Number(getStr(searchParams?.page, "1")) || 1;
  const take = TaskResource.list?.perPage ?? 20;
  const skip = (page - 1) * take;

  // sort
  const defaultSort = { key: "createdAt", dir: "desc" as const };
  const sortKey = getStr(searchParams?.sort, defaultSort.key);
  const sortDir = (getStr(searchParams?.dir, defaultSort.dir) === "asc" ? "asc" : "desc") as "asc" | "desc";
  const orderBy: Record<string, "asc" | "desc"> = sortKey ? { [sortKey]: sortDir } : { createdAt: "desc" };

  // search (string fields only)
  const stringKeys: ReadonlyArray<keyof Task> = ["title", "projectId"];
  const req = (TaskResource.list?.searchable ?? []) as string[];
  const searchFields = (req.length ? req : ["title"]).filter(
    (k): k is keyof Task => (stringKeys as readonly string[]).includes(k)
  );

  const where =
    q && searchFields.length
      ? {
          OR: searchFields.map((k) => ({
            [k]: { contains: q, mode: "insensitive" as const },
          })),
        }
      : {};

  const [items, total] = await Promise.all([
    prisma.task.findMany({ where, orderBy, skip, take }),
    prisma.task.count({ where }),
  ]);

  // columns (typed + safe)
  type GenCol = { key: string; header?: string; format?: "datetime" | "date" | "boolean" };
  const genCols: GenCol[] =
    ((TaskResource.list?.columns as unknown) as GenCol[] | undefined) ?? [
      { key: "title", header: "Title" },
      { key: "projectId", header: "Project Id" },
      { key: "status", header: "Status" },
      { key: "createdAt", header: "Created", format: "datetime" },
    ];

  const baseColumns: Column<Task>[] = genCols.map((c) => ({
    key: c.key as keyof Task,
    header: c.header,
  }));


  // ✅ FIX: correct Map generic and construction
  const fmtByKey = new Map<string, GenCol["format"]>();
  for (const c of genCols) fmtByKey.set(c.key, c.format);

  const columns: Column<Task>[] = baseColumns.map((c) => {
    const fmt = fmtByKey.get(String(c.key));
    if (fmt === "datetime") {
      return {
        ...c,
        cell: (row) => new Date(String((row as unknown as Record<string, unknown>)[String(c.key)])).toLocaleString(),
      };
    }
    if (fmt === "date") {
      return {
        ...c,
        cell: (row) => new Date(String((row as unknown as Record<string, unknown>)[String(c.key)])).toLocaleDateString(),
      };
    }
    if (fmt === "boolean") {
      return {
        ...c,
        cell: (row) => ((row as unknown as Record<string, unknown>)[String(c.key)] ? "Yes" : "No"),
      };
    }
    return c;
  });

  async function del(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    await prisma.task.delete({ where: { id } });
    revalidatePath("/admin/tasks");
  }

  const totalPages = Math.max(1, Math.ceil(total / take));
  const qs = (next: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("page", String(next.page ?? page));
    p.set("sort", String(next.sort ?? sortKey));
    p.set("dir", String(next.dir ?? sortDir));
    return `?${p.toString()}`;
  };

  const headerLink = (key: string, label?: string) => {
    const active = sortKey === key;
    const nextDir: "asc" | "desc" = active && sortDir === "asc" ? "desc" : "asc";
    const href = `/admin/tasks${qs({ page: 1, sort: key, dir: active ? nextDir : "asc" })}`;
    return (
      <a href={href} className="hover:underline">
        {label ?? key}
        {active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
      </a>
    );
  };

  const getValue = (row: Task, key: string): unknown => (row as unknown as Record<string, unknown>)[key];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <Link
          href="/admin/tasks/new"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + New
        </Link>
      </div>

      {/* Search */}
      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={"Search " + (searchFields.length ? searchFields : ["title"]).join(", ")}
          className="w-72 rounded border px-3 py-2 text-sm"
        />
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={sortDir} />
        <button className="rounded border px-3 py-2 text-sm" type="submit">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100">
            <tr>
              {columns.map((c) => (
                <th key={String(c.key)} className="px-3 py-2">
                  {headerLink(String(c.key), c.header)}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t">
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2">
                    {c.cell ? c.cell(row) : String(getValue(row, String(c.key)) ?? "")}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex gap-3">
                    <Link className="underline" href={`/admin/tasks/${row.id}/edit`}>
                      Edit
                    </Link>
                    <form action={del}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="text-red-600 underline">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={columns.length + 1}>
                  No records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </span>
        <div className="ml-auto flex gap-2">
          <a
            className={`rounded border px-3 py-1 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            href={qs({ page: Math.max(1, page - 1) })}
          >
            Prev
          </a>
          <a
            className={`rounded border px-3 py-1 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            href={qs({ page: Math.min(totalPages, page + 1) })}
          >
            Next
          </a>
        </div>
      </div>
    </section>
  );
}
