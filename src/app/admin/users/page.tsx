import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { UserResource } from "@/switchboard/generated/UserResource";
import { SimpleTable, type Column } from "@/components/table/SimpleTable";
import type { User } from "@prisma/client";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function UserListPage({ searchParams }: PageProps) {
  const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const page = Number(searchParams?.page ?? 1) || 1;
  const take = UserResource.list?.perPage ?? 20;
  const skip = (page - 1) * take;

  // Build 'where' for simple search across configured fields
  const searchable = UserResource.list?.searchable ?? [];
  const where =
    q && searchable.length
      ? {
          OR: searchable.map((f) => ({
            [f]: { contains: q, mode: "insensitive" as const },
          })),
        }
      : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  const baseColumns: Column<User>[] = (UserResource.list?.columns ?? [
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
    {
      key: "posts",
      header: "Posts",
    },
    {
      key: "projects",
      header: "Projects",
    },
    {
      key: "tasks",
      header: "Tasks",
    },
  ]) as any;

  const columns: Column<User>[] = baseColumns.map((c) => {
    if ((c as any).format === "datetime") {
      return {
        ...c,
        cell: (row) => new Date((row as any)[c.key] as any).toLocaleString(),
      };
    }
    if ((c as any).format === "date") {
      return {
        ...c,
        cell: (row) =>
          new Date((row as any)[c.key] as any).toLocaleDateString(),
      };
    }
    if ((c as any).format === "boolean") {
      return { ...c, cell: (row) => ((row as any)[c.key] ? "Yes" : "No") };
    }
    return c;
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
        <button className="rounded border px-3 py-2 text-sm" type="submit">
          Search
        </button>
      </form>

      <SimpleTable
        rows={items}
        columns={columns}
        empty={"No users found."}
        actions={(row) => (
          <div className="flex gap-3">
            <Link
              className="underline"
              href={"/admin/users/" + row.id + "/edit"}
            >
              Edit
            </Link>
            <form action={del}>
              <input type="hidden" name="id" value={String(row.id)} />
              <button type="submit" className="text-red-600 underline">
                Delete
              </button>
            </form>
          </div>
        )}
      />

      {/* Pagination */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </span>
        <div className="ml-auto flex gap-2">
          <a
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            href={`?q=${encodeURIComponent(q)}&page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
          >
            Prev
          </a>
          <a
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            href={`?q=${encodeURIComponent(q)}&page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page >= totalPages}
          >
            Next
          </a>
        </div>
      </div>
    </section>
  );
}
