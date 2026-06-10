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
  const orderBy = (sortKey ? { [sortKey]: sortDir } : { createdAt: "desc" }) as
    | Prisma.UserOrderByWithRelationInput
    | undefined;

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
      <a href={base} className="sb-action-link">
        {label ?? key}
        {active ? (sortDir === "asc" ? " (asc)" : " (desc)") : ""}
      </a>
    );
  };

  return (
    <section className="sb-page">
      <div className="sb-page-header">
        <div>
          <p className="sb-eyebrow">Resource</p>
          <h1 className="sb-page-title">Users</h1>
          <p className="sb-page-description">
            View, search, and manage user records.
          </p>
        </div>
        <Link href="/admin/users/new" className="sb-button">
          + New
        </Link>
      </div>

      {/* Search */}
      <form method="get" className="sb-search-form">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={
            "Search " + (UserResource.list?.searchable ?? []).join(", ")
          }
          className="sb-input"
        />
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={sortDir} />
        <button className="sb-button sb-button-secondary" type="submit">
          Search
        </button>
      </form>

      <div className="sb-table-wrap">
        <table className="sb-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={String(c.key)}>
                  {headerLink(String(c.key), c.header)}
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={String((row as unknown as Record<string, unknown>).id)}>
                {columns.map((c) => (
                  <td key={String(c.key)}>
                    {c.cell
                      ? c.cell(row)
                      : String(
                          (row as unknown as Record<string, unknown>)[c.key] ??
                            "",
                        )}
                  </td>
                ))}
                <td>
                  <div className="sb-actions">
                    <Link
                      className="sb-action-link"
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
                      <button type="submit" className="sb-button-danger">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="sb-empty-state" colSpan={columns.length + 1}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="sb-pagination">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="sb-pagination-actions">
          <a
            className={`sb-pagination-link ${page <= 1 ? "sb-is-disabled" : ""}`}
            href={qs({ page: Math.max(1, page - 1) })}
          >
            Prev
          </a>
          <a
            className={`sb-pagination-link ${page >= totalPages ? "sb-is-disabled" : ""}`}
            href={qs({ page: Math.min(totalPages, page + 1) })}
          >
            Next
          </a>
        </div>
      </div>
    </section>
  );
}
