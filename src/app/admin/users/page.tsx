import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { UserResource } from "@/switchboard/generated/UserResource";
import type { Column } from "@/components/table/SimpleTable";
import type { User, Prisma } from "@prisma/client";

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<SearchParams> };

export default async function UserListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Number(params.page ?? 1) || 1;
  const take = UserResource.list?.perPage ?? 20;
  const skip = (page - 1) * take;

  // Sorting
  const defaultSortKey = "createdAt";
  const defaultSortDir: "asc" | "desc" = "desc";
  const sortKey =
    typeof params.sort === "string" ? params.sort : defaultSortKey;
  const sortDir =
    params.dir === "asc" || params.dir === "desc" ? params.dir : defaultSortDir;
  const orderBy = (
    sortKey ? { [sortKey]: sortDir } : { createdAt: "desc" }
  ) as Prisma.UserOrderByWithRelationInput;

  // Search
  const searchable = UserResource.list?.searchable ?? [];
  const where = (
    q && searchable.length
      ? { OR: searchable.map((field) => ({ [field]: { contains: q } })) }
      : {}
  ) as Prisma.UserWhereInput;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  type GeneratedColumn = {
    key: string;
    header?: string;
    format?: "datetime" | "date" | "boolean";
  };
  const generatedColumns = (UserResource.list?.columns ?? [
    {
      key: "name",
      header: "Name",
    },
    {
      key: "email",
      header: "Email",
    },
    {
      key: "role",
      header: "Role",
    },
  ]) as readonly GeneratedColumn[];

  const columns: Column<User>[] = generatedColumns.map((column) => {
    const baseColumn: Column<User> = {
      key: column.key,
      header: column.header,
    };
    if (column.format === "datetime") {
      return {
        ...baseColumn,
        cell: (row) =>
          new Date(
            String((row as unknown as Record<string, unknown>)[column.key]),
          ).toLocaleString(),
      };
    }
    if (column.format === "date") {
      return {
        ...baseColumn,
        cell: (row) =>
          new Date(
            String((row as unknown as Record<string, unknown>)[column.key]),
          ).toLocaleDateString(),
      };
    }
    if (column.format === "boolean") {
      return {
        ...baseColumn,
        cell: (row) =>
          (row as unknown as Record<string, unknown>)[column.key]
            ? "Yes"
            : "No",
      };
    }
    return baseColumn;
  });

  async function del(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    await prisma.user.delete({
      where: { id: id },
    });
    revalidatePath("/admin/users");
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
    const nextDir = active && sortDir === "asc" ? "desc" : "asc";
    const base = `/admin/users${qs({ page: 1, sort: key, dir: active ? nextDir : "asc" })}`;
    return (
      <a href={base} className="hover:underline">
        {label ?? key}
        {active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
      </a>
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Link
          href="/admin/users/new"
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
          placeholder={
            "Search " + (UserResource.list?.searchable ?? []).join(", ")
          }
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
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={String((row as unknown as Record<string, unknown>).id)}
                className="border-t"
              >
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2">
                    {c.cell
                      ? c.cell(row)
                      : String(
                          (row as unknown as Record<string, unknown>)[c.key] ??
                            "",
                        )}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex gap-3">
                    <Link
                      className="underline"
                      href={
                        "/admin/users/" +
                        String((row as unknown as Record<string, unknown>).id) +
                        "/edit"
                      }
                    >
                      Edit
                    </Link>
                    <form action={del}>
                      <input
                        type="hidden"
                        name="id"
                        value={String(
                          (row as unknown as Record<string, unknown>).id,
                        )}
                      />
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
                <td
                  className="px-3 py-6 text-center text-gray-500"
                  colSpan={columns.length + 1}
                >
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
