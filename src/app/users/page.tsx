// src/app/users/page.tsx
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import Link from "next/link";
import { SimpleTable, type Column } from "@/components/table/SimpleTable";

export default async function UsersPage() {
  const users: User[] = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  const columns: Column<User>[] = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "role", header: "Role" },
    { key: "createdAt", header: "Created", cell: (u) => new Date(u.createdAt).toLocaleString() },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Link
          href="/users/new"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New User
        </Link>
      </div>

      <SimpleTable<User>
        rows={users}
        columns={columns}
        empty="No users yet."
        actions={(u) => (
          <div className="flex gap-3">
            <Link className="underline" href={`/users/${u.id}/edit`}>Edit</Link>
            <form action={`/users/${u.id}/delete`} method="post">
              <button className="text-red-600 underline" type="submit">Delete</button>
            </form>
          </div>
        )}
      />
    </section>
  );
}
