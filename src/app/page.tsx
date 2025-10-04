// src/app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <p className="text-sm text-gray-600">
        This is Switchboard v0 (MVP). Start with the{" "}
        <Link className="underline" href="/users">Users</Link> resource.
      </p>
    </section>
  );
}
