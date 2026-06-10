import "./switchboard.css";
import Link from "next/link";
import { resources } from "@/switchboard/registry";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sb-admin-shell">
      <header className="sb-admin-header">
        <nav className="sb-admin-nav">
          <Link className="sb-admin-brand" href="/admin">
            Switchboard
          </Link>
          <Link className="sb-admin-home-link" href="/">
            Back to site
          </Link>
        </nav>
      </header>
      <main className="sb-admin-main">
        <aside className="sb-admin-sidebar">
          <nav className="sb-resource-nav" aria-label="Admin resources">
            <h2 className="sb-resource-nav-title">Resources</h2>
            <ul className="sb-resource-list">
              {resources.map((resource) => (
                <li key={resource.resource}>
                  <Link
                    className="sb-resource-link"
                    href={"/admin/" + resource.resource.toLowerCase() + "s"}
                  >
                    {resource.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <section className="sb-admin-content">{children}</section>
      </main>
    </div>
  );
}
