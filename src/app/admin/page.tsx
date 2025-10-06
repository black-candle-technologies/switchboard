import Link from "next/link";
import { resources } from "@/switchboard/registry";

export default function AdminIndex() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      <ul className="space-y-2">
        {resources.map((r) => (
          <li key={r.resource}>
            <Link
              className="underline"
              href={"/admin/" + r.resource.toLowerCase() + "s"}
            >
              {r.displayName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
