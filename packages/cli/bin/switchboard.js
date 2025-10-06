#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

const program = new Command();

async function format(text) {
  try {
    return await prettier.format(text, { parser: "typescript" });
  } catch {
    return text;
  }
}

program
  .name("switchboard")
  .description("CLI for generating Switchboard admin resources and pages")
  .version("0.3.1");

program
  .command("generate")
  .description("Generate Switchboard resource configs and/or Next.js admin pages")
  .option("-m, --model <modelName>", "Generate a specific model only")
  .option("--pages", "Also generate Next.js pages for each resource")
  .action(async (options) => {
    const projectRoot = process.cwd();
    const schemaPath = path.join(projectRoot, "src/prisma/schema.prisma");
    const genDir = path.join(projectRoot, "src/switchboard/generated");
    await fs.ensureDir(genDir);

    if (!fs.existsSync(schemaPath)) {
      console.error(chalk.red(`❌ Could not find schema.prisma at ${schemaPath}`));
      process.exit(1);
    }

    const schema = await fs.readFile(schemaPath, "utf8");

    // Parse enums
    const enumMatches = [...schema.matchAll(/enum\s+(\w+)\s*{([^}]*)}/g)];
    /** @type {Record<string,string[]>} */
    const enums = {};
    for (const [, name, body] of enumMatches) {
      const values = body
        .split(/[\s,]+/g)
        .map((v) => v.trim())
        .filter(Boolean);
      enums[name] = values;
    }

    // Parse models (capture attributes to find @id/@default etc.)
    const modelMatches = [...schema.matchAll(/model\s+(\w+)\s*{([\s\S]*?)}/g)];
    const models = modelMatches.map(([, name, body]) => {
      const fieldMatches = [...body.matchAll(/^\s*(\w+)\s+([A-Za-z0-9\[\]]+\??)(.*)$/gm)];
      const fields = fieldMatches.map(([, fname, ftype, fattrs]) => ({
        name: fname,
        type: ftype.trim(),
        attrs: fattrs.trim(),
      }));
      const idField =
        fields.find((f) => f.attrs.includes("@id")) ??
        fields.find((f) => f.name === "id");
      const hasCreatedAt = fields.some((f) => f.name === "createdAt");
      return { name, fields, idField, hasCreatedAt };
    });

    // Helpers
    const baseType = (t) => t.replace(/\?$/, "").replace(/\[\]$/, "");
    const isOptional = (t) => t.endsWith("?");
    const isArray = (t) => t.replace(/\?$/, "").endsWith("[]");
    const tsTypeFor = (prismaTypeRaw) => {
      const base = baseType(prismaTypeRaw);
      let ts;
      switch (base) {
        case "String":
          ts = "string";
          break;
        case "Int":
        case "Float":
        case "Decimal":
          ts = "number";
          break;
        case "BigInt":
          ts = "string";
          break;
        case "Boolean":
          ts = "boolean";
          break;
        case "DateTime":
          ts = "string"; // form-friendly
          break;
        case "Json":
          ts = "unknown";
          break;
        default:
          ts = enums[base]
            ? enums[base].map((v) => JSON.stringify(v)).join(" | ")
            : "unknown";
      }
      if (isArray(prismaTypeRaw)) ts = `${ts}[]`;
      return ts;
    };
    const widgetFor = (fieldName, prismaTypeRaw, modelFields) => {
      const b = baseType(prismaTypeRaw);

      // Heuristic: relation if field ends with 'Id' and a sibling object field matches (e.g., authorId + author User)
      if (/Id$/.test(fieldName)) {
        const guessModel = fieldName.replace(/Id$/, "");
        const objectField = modelFields.find((mf) => baseType(mf.type) === guessModel[0].toUpperCase() + guessModel.slice(1));
        if (objectField) {
          return { type: "relation", model: (objectField.type.replace(/\?$/, "")) };
        }
      }

      if (enums[b]) {
        return { type: "select", options: enums[b].map((v) => ({ value: v, label: v })) };
      }
      if (b === "Boolean") return { type: "checkbox" };
      if (b === "DateTime") return { type: "datetime" };
      if (b === "String" && /content|description|body/i.test(fieldName)) {
        return { type: "textarea", rows: 8 };
      }
      if (b === "String" && /email/i.test(fieldName)) return { type: "email" };
      return { type: "text" };
    };

    // Generate configs and pages
    for (const model of models) {
      if (options.model && options.model !== model.name) continue;

      const fieldsForUI = model.fields.filter(
        (f) => !["id", "createdAt", "updatedAt"].includes(f.name)
      );

      // generated ResourceConfig
      const shapeProps = fieldsForUI
        .map(
          (f) =>
            `  ${f.name}${isOptional(f.type) ? "?" : ""}: ${tsTypeFor(f.type)};`
        )
        .join("\n");

      const resourceFields = fieldsForUI.map((f) => ({
        name: f.name,
        label: f.name[0].toUpperCase() + f.name.slice(1),
        required: !isOptional(f.type),
        widget: widgetFor(f.name, f.type, model.fields),
      }));

      const configObject = {
        resource: model.name,
        displayName: model.name + "s",
        fields: resourceFields,
        list: {
          perPage: 20,
          searchable: fieldsForUI
            .filter((f) => ["String"].includes(baseType(f.type)))
            .map((f) => f.name),
          columns: fieldsForUI.map((f) => ({
            key: f.name,
            header: f.name[0].toUpperCase() + f.name.slice(1),
            format: baseType(f.type) === "DateTime" ? "datetime" : baseType(f.type) === "Boolean" ? "boolean" : undefined
          })),
          defaultSort: model.hasCreatedAt ? { key: "createdAt", dir: "desc" } : undefined,
        },
      };

      const configFile = `
        // Auto-generated by Switchboard CLI
        import type { ResourceConfig } from "@/switchboard/types";

        export type ${model.name}Shape = {
${shapeProps}
        };

        export const ${model.name}Resource: ResourceConfig<${model.name}Shape> =
          ${JSON.stringify(configObject, null, 2)} as const;
      `;
      await fs.writeFile(
        path.join(genDir, `${model.name}Resource.ts`),
        await format(configFile),
        "utf8"
      );
      console.log(chalk.green(`✅ Generated ${model.name}Resource.ts`));

      if (!options.pages) continue;

// admin pages
const plural = model.name.toLowerCase() + "s";
const adminDir = path.join(projectRoot, "src/app/admin", plural);

// ensure all nested route dirs exist
const newDir = path.join(adminDir, "new");
const idDir = path.join(adminDir, "[id]");
const editDir = path.join(idDir, "edit");
await fs.ensureDir(adminDir);
await fs.ensureDir(newDir);
await fs.ensureDir(idDir);
await fs.ensureDir(editDir);

const idName = model.idField?.name ?? "id";
const idTypeBase = baseType(model.idField?.type ?? "String");
const idFromParams =
  idTypeBase === "Int" ||
  idTypeBase === "Float" ||
  idTypeBase === "Decimal"
    ? "Number(params.id)"
    : "params.id";


const listPage = `
  import { prisma } from "@/lib/prisma";
  import Link from "next/link";
  import { revalidatePath } from "next/cache";
  import { ${model.name}Resource } from "@/switchboard/generated/${model.name}Resource";
  import { SimpleTable, type Column } from "@/components/table/SimpleTable";
  import type { ${model.name} } from "@prisma/client";

  type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

  export default async function ${model.name}ListPage({ searchParams }: PageProps) {
    const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
    const page = Number(searchParams?.page ?? 1) || 1;
    const take = ${model.name}Resource.list?.perPage ?? 20;
    const skip = (page - 1) * take;

    // Sorting
    const defaultSort = ${JSON.stringify(
      model.hasCreatedAt ? { key: "createdAt", dir: "desc" } : null
    )};
    const sortKey = typeof searchParams?.sort === "string" ? searchParams.sort : (defaultSort?.key ?? "");
    const sortDir = (typeof searchParams?.dir === "string" ? searchParams.dir : (defaultSort?.dir ?? "asc")) as "asc" | "desc";
    const orderBy = sortKey ? { [sortKey]: sortDir } : ${model.hasCreatedAt ? `{ createdAt: "desc" as const }` : "{}"};

    // Search
    const searchable = ${model.name}Resource.list?.searchable ?? [];
    const where = q && searchable.length
      ? { OR: searchable.map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) }
      : {};

    const [items, total] = await Promise.all([
      prisma.${model.name.toLowerCase()}.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.${model.name.toLowerCase()}.count({ where }),
    ]);

    const baseColumns: Column<${model.name}>[] =
      (${model.name}Resource.list?.columns ?? ${JSON.stringify(
        (resourceFields || []).map((f) => ({ key: f.name, header: f.label })),
        null,
        2
      )}) as any;

    const columns: Column<${model.name}>[] = baseColumns.map((c) => {
      const fmt = (c as any).format as "datetime" | "date" | "boolean" | undefined;
      if (fmt === "datetime") {
        return { ...c, cell: (row) => new Date((row as unknown as Record<string, unknown>)[c.key] as string).toLocaleString() };
      }
      if (fmt === "date") {
        return { ...c, cell: (row) => new Date((row as unknown as Record<string, unknown>)[c.key] as string).toLocaleDateString() };
      }
      if (fmt === "boolean") {
        return { ...c, cell: (row) => (((row as unknown as Record<string, unknown>)[c.key]) ? "Yes" : "No") };
      }
      return c;
    });

    async function del(formData: FormData) {
      "use server";
      const id = String(formData.get("${idName}"));
      await prisma.${model.name.toLowerCase()}.delete({
        where: { ${idName}: ${idTypeBase === "Int" ? "Number(id)" : "id"} }
      });
      revalidatePath("/admin/${plural}");
    }

    const totalPages = Math.max(1, Math.ceil(total / take));

    const qs = (next: Record<string,string|number>) => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      p.set("page", String(next.page ?? page));
      p.set("sort", String(next.sort ?? sortKey));
      p.set("dir", String(next.dir ?? sortDir));
      return \`?\${p.toString()}\`;
    };

    const headerLink = (key: string, label?: string) => {
      const active = sortKey === key;
      const nextDir = active && sortDir === "asc" ? "desc" : "asc";
      const base = \`/admin/${plural}\${qs({ page: 1, sort: key, dir: active ? nextDir : "asc" })}\`;
      return (
        <a href={base} className="hover:underline">
          {label ?? key}
          {active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
        </a>
      );
    };

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">${model.name}s</h1>
          <Link
            href="/admin/${plural}/new"
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
            placeholder={"Search " + (${model.name}Resource.list?.searchable ?? []).join(", ")}
            className="w-72 rounded border px-3 py-2 text-sm"
          />
          <input type="hidden" name="sort" value={sortKey} />
          <input type="hidden" name="dir" value={sortDir} />
          <button className="rounded border px-3 py-2 text-sm" type="submit">Search</button>
        </form>

        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                {columns.map((c) => (
                  <th key={String(c.key)} className="px-3 py-2">
                    {headerLink(String(c.key), c.header)}
                  </th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={String((row as unknown as Record<string, unknown>).${idName})} className="border-t">
                  {columns.map((c) => (
                    <td key={String(c.key)} className="px-3 py-2">
                      {c.cell ? c.cell(row) : String((row as unknown as Record<string, unknown>)[c.key] ?? "")}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex gap-3">
                      <Link className="underline" href={"/admin/${plural}/" + String((row as unknown as Record<string, unknown>).${idName}) + "/edit"}>Edit</Link>
                      <form action={del}>
                        <input type="hidden" name="${idName}" value={String((row as unknown as Record<string, unknown>).${idName})} />
                        <button type="submit" className="text-red-600 underline">Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={columns.length + 1}>No records.</td></tr>
              )}
            </tbody>
          </table>
        </div>

                {/* Pagination */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <div className="ml-auto flex gap-2">
            <a
              className={\`rounded border px-3 py-1 text-sm \${page <= 1 ? "pointer-events-none opacity-50" : ""}\`}
              href={qs({ page: Math.max(1, page - 1) })}
            >
              Prev
            </a>
            <a
              className={\`rounded border px-3 py-1 text-sm \${page >= totalPages ? "pointer-events-none opacity-50" : ""}\`}
              href={qs({ page: Math.min(totalPages, page + 1) })}
            >
              Next
            </a>
          </div>
        </div>
      </section>
    );
  }
`;

      // new page — SmartForm + redirect
      const newPage = `
        import { prisma } from "@/lib/prisma";
        import { redirect } from "next/navigation";
        import { SmartForm } from "@/components/form/SmartForm";
        import { ${model.name}Resource } from "@/switchboard/generated/${model.name}Resource";

        export default function New${model.name}Page() {
          async function create(formData: FormData) {
            "use server";
            const data = Object.fromEntries(formData.entries());
            await prisma.${model.name.toLowerCase()}.create({ data });
            redirect("/admin/${plural}");
          }

          return (
            <SmartForm
              title="New ${model.name}"
              fields={${model.name}Resource.fields}
              submitLabel="Create"
              cancelHref="/admin/${plural}"
              action={create}
            />
          );
        }
      `;

      // edit page — ID type respected
      const editPage = `
        import { prisma } from "@/lib/prisma";
        import { redirect } from "next/navigation";
        import { SmartForm } from "@/components/form/SmartForm";
        import { ${model.name}Resource } from "@/switchboard/generated/${model.name}Resource";

        export default async function Edit${model.name}Page({ params }: { params: { id: string } }) {
          const existing = await prisma.${model.name.toLowerCase()}.findUnique({
            where: { ${idName}: ${idFromParams} }
          });
          if (!existing) return <p className="text-sm text-gray-500">Not found.</p>;

          async function update(formData: FormData) {
            "use server";
            const data = Object.fromEntries(formData.entries());
            await prisma.${model.name.toLowerCase()}.update({
              where: { ${idName}: ${idFromParams} },
              data
            });
            redirect("/admin/${plural}");
          }

          return (
            <SmartForm
              title="Edit ${model.name}"
              fields={${model.name}Resource.fields}
              initialValues={existing as any}
              submitLabel="Save"
              cancelHref="/admin/${plural}"
              action={update}
            />
          );
        }
      `;

      await fs.writeFile(
        path.join(adminDir, "page.tsx"),
        await format(listPage),
        "utf8"
      );
      await fs.writeFile(
        path.join(adminDir, "new", "page.tsx"),
        await format(newPage),
        "utf8"
      );
      await fs.writeFile(
        path.join(adminDir, "[id]", "edit", "page.tsx"),
        await format(editPage),
        "utf8"
      );

      console.log(chalk.green(`✅ Generated admin pages for ${model.name}`));
    }

    // registry.ts
    const resourceFiles = (await fs.readdir(genDir)).filter((f) =>
      f.endsWith("Resource.ts")
    );

    const registryImports = resourceFiles
      .map((f) => {
        const n = f.replace("Resource.ts", "");
        return `import { ${n}Resource } from "@/switchboard/generated/${n}Resource";`;
      })
      .join("\n");

    const registryArray = resourceFiles
      .map((f) => f.replace("Resource.ts", "Resource"))
      .join(",\n  ");

    const registryText = `
      // Auto-generated by Switchboard CLI (safe to keep under version control)
      import { overrides, mergeResource } from "@/switchboard/overrides";
      ${registryImports}

      const baseResources = [
        ${registryArray}
      ];

      export const resources = baseResources.map((res) => {
        const ov = (overrides as Record<string, unknown>)[res.resource] as Partial<typeof res> | undefined;
        return mergeResource(res, ov);
      });
    `;

    await fs.outputFile(
      path.join(projectRoot, "src/switchboard/registry.ts"),
      await format(registryText),
      "utf8"
    );

    console.log(chalk.green("✅ Updated src/switchboard/registry.ts"));

    // Generate /admin layout + index that use the registry
    if (options.pages) {
      const adminRoot = path.join(projectRoot, "src/app/admin");
      await fs.ensureDir(adminRoot);

      const layout = `
        import Link from "next/link";
        import { resources } from "@/switchboard/registry";

        export default function AdminLayout({ children }: { children: React.ReactNode }) {
          return (
            <div className="min-h-screen bg-gray-50 text-gray-900">
              <header className="border-b bg-white">
                <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                  <Link href="/" className="font-semibold">Switchboard</Link>
                  <div className="space-x-4">
                    <Link href="/admin" className="text-sm hover:underline">Admin</Link>
                  </div>
                </nav>
              </header>
              <main className="mx-auto max-w-6xl px-4 py-6">
                <div className="grid grid-cols-12 gap-6">
                  <aside className="col-span-3">
                    <nav className="rounded border bg-white p-3">
                      <h2 className="mb-2 text-sm font-semibold text-gray-700">Resources</h2>
                      <ul className="space-y-2">
                        {resources.map((r) => (
                          <li key={r.resource}>
                            <Link className="hover:underline" href={"/admin/" + r.resource.toLowerCase() + "s"}>
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
      `;


      const index = `
        import Link from "next/link";
        import { resources } from "@/switchboard/registry";

        export default function AdminIndex() {
          return (
            <section className="space-y-4">
              <h1 className="text-xl font-semibold">Admin</h1>
              <ul className="space-y-2">
                {resources.map((r) => (
                  <li key={r.resource}>
                    <Link className="underline" href={"/admin/" + r.resource.toLowerCase() + "s"}>
                      {r.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        }
      `;

      const layoutPath = path.join(adminRoot, "layout.tsx");
      if (!(await fs.pathExists(layoutPath))) {
        await fs.writeFile(layoutPath, await format(layout), "utf8");
        console.log(chalk.green(`✅ Created /admin/layout.tsx`));
      }
      await fs.writeFile(
        path.join(adminRoot, "page.tsx"),
        await format(index),
        "utf8"
      );
      console.log(chalk.green(`✅ Created /admin/page.tsx`));
    }
  });

program.parse(process.argv);
