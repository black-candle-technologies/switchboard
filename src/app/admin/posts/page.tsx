import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PostResource } from "@/switchboard/generated/PostResource";
import { SimpleTable, type Column } from "@/components/table/SimpleTable";
import type { Post } from "@prisma/client";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function PostListPage({ searchParams }: PageProps) {
  const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const page = Number(searchParams?.page ?? 1) || 1;
  const take = PostResource.list?.perPage ?? 20;
  const skip = (page - 1) * take;

  // Build 'where' for simple search across configured fields
  const searchable = PostResource.list?.searchable ?? [];
  const where =
    q && searchable.length
      ? {
          OR: searchable.map((f) => ({
            [f]: { contains: q, mode: "insensitive" as const },
          })),
        }
      : {};

  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.post.count({ where }),
  ]);

  const baseColumns: Column<Post>[] = (PostResource.list?.columns ?? [
    {
      key: "title",
      header: "Title",
    },
    {
      key: "content",
      header: "Content",
    },
    {
      key: "status",
      header: "Status",
    },
    {
      key: "authorId",
      header: "AuthorId",
    },
    {
      key: "author",
      header: "Author",
    },
  ]) as any;

  const columns: Column<Post>[] = baseColumns.map((c) => {
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
    await prisma.post.delete({
      where: { id: id },
    });
    revalidatePath("/admin/posts");
  }

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Posts</h1>
        <Link
          href="/admin/posts/new"
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
            "Search " + (PostResource.list?.searchable ?? []).join(", ")
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
        empty={"No posts found."}
        actions={(row) => (
          <div className="flex gap-3">
            <Link
              className="underline"
              href={"/admin/posts/" + row.id + "/edit"}
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
