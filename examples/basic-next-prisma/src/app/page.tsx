import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 960, padding: 32 }}>
      <h1>Switchboard Basic Example</h1>
      <p>
        This app uses Next.js, Prisma, SQLite, and the local Switchboard CLI
        package.
      </p>
      <Link href="/admin">Open the admin</Link>
    </main>
  );
}
