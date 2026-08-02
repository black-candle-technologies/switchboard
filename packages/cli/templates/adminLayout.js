import path from "node:path";

import { importPath } from "../src/project/importPath.js";
import { GENERATED_FILE_MARKER } from "../src/utils/fileActions.js";

export function adminLayoutTemplate(layout, layoutPath, registryPath) {
  const authActionsPath = path.join(layout.switchboardDir, "auth-actions.ts");
  return `
    // ${GENERATED_FILE_MARKER}
    import "./switchboard.css";
    import Link from "next/link";
    import { headers } from "next/headers";
    import { resources } from "${importPath(layout, layoutPath, registryPath)}";
    import { logout } from "${importPath(layout, layoutPath, authActionsPath)}";

    export default async function AdminLayout({
      children,
    }: {
      children: React.ReactNode;
    }) {
      const requestHeaders = await headers();
      const isLoginPage =
        requestHeaders.get("x-switchboard-login-page") === "1";

      if (isLoginPage) {
        return <div className="sb-login-shell">{children}</div>;
      }

      return (
        <div className="sb-admin-shell">
          <header className="sb-admin-header">
            <nav className="sb-admin-nav">
              <Link className="sb-admin-brand" href="/admin">
                Switchboard
              </Link>
              <div className="sb-admin-nav-actions">
                <Link className="sb-admin-home-link" href="/">
                  Back to site
                </Link>
                <form action={logout}>
                  <button className="sb-button sb-button-secondary" type="submit">
                    Logout
                  </button>
                </form>
              </div>
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
  `;
}
