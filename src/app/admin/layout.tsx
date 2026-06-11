import "./switchboard.css";
import Link from "next/link";
import { headers } from "next/headers";
import { resources } from "@/switchboard/registry";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-switchboard-login-page") === "1") {
    return <div className="sb-login-shell">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold">
            Switchboard
          </Link>
          <div className="space-x-4">
            <Link href="/admin" className="text-sm hover:underline">
              Admin
            </Link>
            <Link href="/admin/logout" className="text-sm hover:underline">
              Logout
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-3">
            <nav className="rounded border bg-white p-3">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Resources
              </h2>
              <ul className="space-y-2">
                {resources.map((r) => (
                  <li key={r.resource}>
                    <Link
                      className="hover:underline"
                      href={"/admin/" + r.resource.toLowerCase() + "s"}
                    >
                      {r.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          <section className="col-span-9">{children}</section>
        </div>
      </main>
    </div>
  );
}
