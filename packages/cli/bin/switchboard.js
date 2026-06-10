#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import prettier from "prettier";
import { fileURLToPath } from "url";
import { initProject } from "./init-project.js";

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
  .version("0.4.2");

export async function generateProject({
  projectRoot = process.cwd(),
  model,
  pages = false,
  schemaPath: schemaOption,
  out,
  appDir: appDirOption,
} = {}) {
    const options = { model, pages };
    const resolvedProjectRoot = path.resolve(projectRoot);
    const srcAppDir = path.join(resolvedProjectRoot, "src", "app");
    const rootAppDir = path.join(resolvedProjectRoot, "app");
    const appDir = appDirOption
      ? path.resolve(resolvedProjectRoot, appDirOption)
      : fs.pathExistsSync(srcAppDir)
        ? srcAppDir
        : fs.pathExistsSync(rootAppDir)
          ? rootAppDir
          : undefined;
    if (!appDir) {
      throw new Error(
        "Unsupported project structure: expected a Next.js App Router directory at src/app or app.",
      );
    }
    if (!fs.pathExistsSync(appDir) || !fs.statSync(appDir).isDirectory()) {
      throw new Error(
        `Next.js App Router directory not found at "${appDir}".`,
      );
    }
    const relativeAppDir = path.relative(resolvedProjectRoot, appDir);
    if (
      relativeAppDir === ".." ||
      relativeAppDir.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeAppDir)
    ) {
      throw new Error("--app-dir must point to a directory inside the project.");
    }
    const srcRoot = path.join(resolvedProjectRoot, "src");
    const relativeToSrc = path.relative(srcRoot, appDir);
    const sourceRoot =
      relativeToSrc !== ".." &&
      !relativeToSrc.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeToSrc)
        ? srcRoot
        : resolvedProjectRoot;
    const defaultSchemaPath = fs.pathExistsSync(
      path.join(resolvedProjectRoot, "src", "prisma", "schema.prisma"),
    )
      ? path.join("src", "prisma", "schema.prisma")
      : path.join("prisma", "schema.prisma");
    const schemaPath = path.resolve(
      resolvedProjectRoot,
      schemaOption ?? defaultSchemaPath,
    );
    const outOption =
      out ?? path.relative(resolvedProjectRoot, path.join(sourceRoot, "switchboard"));
    const outDir = path.resolve(resolvedProjectRoot, outOption);
    const relativeOutDir = path.relative(sourceRoot, outDir);
    const outImportPath = relativeOutDir.split(path.sep).join("/");
    const genDir = path.join(outDir, "generated");

    if (!fs.existsSync(schemaPath)) {
      throw new Error(
        `Prisma schema not found at "${schemaPath}". ` +
          "Pass --schema <path> relative to the project root if it is elsewhere.",
      );
    }
    if (
      relativeOutDir === "" ||
      relativeOutDir === ".." ||
      relativeOutDir.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeOutDir)
    ) {
      throw new Error(
        `Unsupported output path "${outOption}". --out must point inside ` +
          `"${path.relative(resolvedProjectRoot, sourceRoot) || "."}" ` +
          "so generated @/ imports remain valid.",
      );
    }

    const schema = await fs.readFile(schemaPath, "utf8");

    // Parse enums
    const enumMatches = [...schema.matchAll(/enum\s+(\w+)\s*{([^}]*)}/g)];
    /** @type {Record<string,string[]>} */
    const enums = {};
    for (const [, name, body] of enumMatches) {
      const values = body
        .split(/\r?\n/g)
        .map((line) => line.replace(/\/\/.*$/, "").trim())
        .map((line) => line.match(/^(\w+)\b/)?.[1])
        .filter(Boolean);
      enums[name] = values;
    }

    // Parse models (capture attributes to find @id/@default etc.)
    const modelMatches = [...schema.matchAll(/model\s+(\w+)\s*{([\s\S]*?)}/g)];
    if (modelMatches.length === 0) {
      throw new Error(
        `No Prisma models found in "${schemaPath}". ` +
          "Check that the schema is valid and contains at least one model block.",
      );
    }
    const models = modelMatches.map(([, name, body]) => {
      const fieldMatches = [...body.matchAll(/^\s*(\w+)\s+([A-Za-z0-9\[\]]+\??)(.*)$/gm)];
      const fields = fieldMatches.map(([, fname, ftype, fattrs]) => ({
        name: fname,
        type: ftype.trim(),
        attrs: fattrs.trim(),
      }));
      const idFields = fields.filter((field) =>
        /(?:^|\s)@id(?:\s|$|\()/.test(field.attrs),
      );
      const compoundIdMatch = body.match(/@@id\s*\(\s*\[([^\]]+)\]/);
      const compoundIdFields = compoundIdMatch
        ? compoundIdMatch[1]
            .split(",")
            .map((field) => field.trim())
            .filter(Boolean)
        : [];
      const hasCreatedAt = fields.some(
        (field) => field.name === "createdAt" && field.type === "DateTime",
      );
      return {
        name,
        fields,
        idField: idFields.length === 1 ? idFields[0] : undefined,
        idFields,
        compoundIdFields,
        hasCreatedAt,
      };
    });

    // Helpers
    const baseType = (t) => t.replace(/\?$/, "").replace(/\[\]$/, "");
    const isOptional = (t) => t.endsWith("?");
    const isArray = (t) => t.replace(/\?$/, "").endsWith("[]");
    const hasDefault = (field) =>
      /(?:^|\s)@default\s*\(/.test(field.attrs);
    const isUpdatedAt = (field) =>
      /(?:^|\s)@updatedAt(?:\s|$)/.test(field.attrs);
    const scalarTypes = new Set([
      "String",
      "Int",
      "Float",
      "Decimal",
      "BigInt",
      "Boolean",
      "DateTime",
      "Json",
      "Bytes",
    ]);
    const isScalarField = (field) => {
      const type = baseType(field.type);
      return !isArray(field.type) && (scalarTypes.has(type) || Boolean(enums[type]));
    };
    const formValueFor = (field, prismaInputType) => {
      const type = baseType(field.type);
      const value = `formData.get("${field.name}")`;
      const stringValue = `String(${value} ?? "")`;
      const emptyValue = hasDefault(field)
        ? "undefined"
        : isOptional(field.type)
          ? "null"
          : '""';

      if (enums[type]) {
        const enumValue = `${stringValue} as ${prismaInputType}["${field.name}"]`;
        return hasDefault(field) || isOptional(field.type)
          ? `${value} ? ${enumValue} : ${emptyValue}`
          : enumValue;
      }
      switch (type) {
        case "Int":
        case "Float":
        case "Decimal":
          return isOptional(field.type) || hasDefault(field)
            ? `${value} ? Number(${value}) : ${emptyValue}`
            : `Number(${value})`;
        case "BigInt":
          return isOptional(field.type) || hasDefault(field)
            ? `${value} ? BigInt(${stringValue}) : ${emptyValue}`
            : `BigInt(${stringValue})`;
        case "Boolean":
          return `formData.has("${field.name}")`;
        case "DateTime":
          return isOptional(field.type) || hasDefault(field)
            ? `${value} ? new Date(${stringValue}) : ${emptyValue}`
            : `new Date(${stringValue})`;
        case "Json":
          return `${value} ? JSON.parse(${stringValue}) : ${emptyValue}`;
        case "Bytes":
          return `Buffer.from(${stringValue})`;
        default:
          return isOptional(field.type) || hasDefault(field)
            ? `${value} ? ${stringValue} : ${emptyValue}`
            : stringValue;
      }
    };
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
    const pageModels = options.model
      ? models.filter((model) => model.name === options.model)
      : models;
    if (options.model && pageModels.length === 0) {
      throw new Error(
        `Model "${options.model}" was not found in Prisma schema "${schemaPath}".`,
      );
    }

    if (options.pages) {
      const supportedIdTypes = new Set(["String", "Int", "BigInt"]);
      for (const model of pageModels) {
        if (model.compoundIdFields.length > 0) {
          throw new Error(
            `Cannot generate admin pages for model "${model.name}": compound IDs ` +
              `(@@id([${model.compoundIdFields.join(", ")}])) are not supported. ` +
              "Use a single String, Int, or BigInt @id field, or run without --pages.",
          );
        }
        if (model.idFields.length !== 1 || !model.idField) {
          throw new Error(
            `Cannot generate admin pages for model "${model.name}": expected one explicit scalar @id field. ` +
              "Add a single String, Int, or BigInt @id field, or run without --pages.",
          );
        }
        const idType = baseType(model.idField.type);
        if (!isScalarField(model.idField) || !supportedIdTypes.has(idType)) {
          throw new Error(
            `Cannot generate admin pages for model "${model.name}": primary key ` +
              `"${model.idField.name}" has unsupported type "${model.idField.type}". ` +
              "Use a single String, Int, or BigInt @id field, or run without --pages.",
          );
        }
      }
    }

    await fs.ensureDir(genDir);

    // Generate configs and pages
    for (const model of models) {
      if (options.model && options.model !== model.name) continue;

      const fieldsForUI = model.fields.filter(
        (f) =>
          !(f === model.idField && hasDefault(f)) &&
          !isUpdatedAt(f) &&
          !(
            ["createdAt", "updatedAt"].includes(f.name) &&
            hasDefault(f)
          ) &&
          isScalarField(f)
      );

      // generated ResourceConfig
      const shapeProps = fieldsForUI
        .map(
          (f) =>
            `  ${f.name}${isOptional(f.type) || hasDefault(f) ? "?" : ""}: ${tsTypeFor(f.type)};`
        )
        .join("\n");

      const resourceFields = fieldsForUI.map((f) => ({
        name: f.name,
        label: f.name[0].toUpperCase() + f.name.slice(1),
        required: !isOptional(f.type) && !hasDefault(f),
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
        import type { ResourceConfig } from "@/${outImportPath}/types";

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
const adminDir = path.join(appDir, "admin", plural);

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

const listPage = `
  import { prisma } from "@/lib/prisma";
  import Link from "next/link";
  import { revalidatePath } from "next/cache";
  import { ${model.name}Resource } from "@/${outImportPath}/generated/${model.name}Resource";
  import type { Column } from "@/components/table/SimpleTable";
  import type { ${model.name}, Prisma } from "@prisma/client";

  type SearchParams = Record<string, string | string[] | undefined>;
  type PageProps = { searchParams: Promise<SearchParams> };

  export default async function ${model.name}ListPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const q = typeof params.q === "string" ? params.q.trim() : "";
    const page = Number(params.page ?? 1) || 1;
    const take = ${model.name}Resource.list?.perPage ?? 20;
    const skip = (page - 1) * take;

    // Sorting
    const defaultSortKey = ${JSON.stringify(model.hasCreatedAt ? "createdAt" : "")};
    const defaultSortDir: "asc" | "desc" = ${JSON.stringify(model.hasCreatedAt ? "desc" : "asc")};
    const sortKey = typeof params.sort === "string" ? params.sort : defaultSortKey;
    const sortDir =
      params.dir === "asc" || params.dir === "desc"
        ? params.dir
        : defaultSortDir;
    const orderBy = (sortKey ? { [sortKey]: sortDir } : ${model.hasCreatedAt ? `{ createdAt: "desc" }` : "undefined"}) as Prisma.${model.name}OrderByWithRelationInput | undefined;

    // Search
    const searchable = ${model.name}Resource.list?.searchable ?? [];
    const where = (q && searchable.length
      ? { OR: searchable.map((field) => ({ [field]: { contains: q } })) }
      : {}) as Prisma.${model.name}WhereInput;

    const [items, total] = await Promise.all([
      prisma.${model.name.toLowerCase()}.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.${model.name.toLowerCase()}.count({ where }),
    ]);

    type GeneratedColumn = {
      key: string;
      header?: string;
      format?: "datetime" | "date" | "boolean";
    };
    const generatedColumns = (${model.name}Resource.list?.columns ?? ${JSON.stringify(
        (resourceFields || []).map((f) => ({ key: f.name, header: f.label })),
        null,
        2
      )}) as readonly GeneratedColumn[];

    const columns: Column<${model.name}>[] = generatedColumns.map((column) => {
      const baseColumn: Column<${model.name}> = {
        key: column.key,
        header: column.header,
      };
      if (column.format === "datetime") {
        return { ...baseColumn, cell: (row) => new Date(String((row as unknown as Record<string, unknown>)[column.key])).toLocaleString() };
      }
      if (column.format === "date") {
        return { ...baseColumn, cell: (row) => new Date(String((row as unknown as Record<string, unknown>)[column.key])).toLocaleDateString() };
      }
      if (column.format === "boolean") {
        return { ...baseColumn, cell: (row) => ((row as unknown as Record<string, unknown>)[column.key] ? "Yes" : "No") };
      }
      return baseColumn;
    });

    async function del(formData: FormData) {
      "use server";
      const id = String(formData.get("${idName}"));
      await prisma.${model.name.toLowerCase()}.delete({
        where: { ${idName}: ${idTypeBase === "Int" ? "Number(id)" : idTypeBase === "BigInt" ? "BigInt(id)" : "id"} }
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
        import { revalidatePath } from "next/cache";
        import { redirect } from "next/navigation";
        import { SmartForm } from "@/components/form/SmartForm";
        import { ${model.name}Resource } from "@/${outImportPath}/generated/${model.name}Resource";
        import type { Prisma } from "@prisma/client";

        export default function New${model.name}Page() {
          async function create(formData: FormData) {
            "use server";
            const data: Prisma.${model.name}UncheckedCreateInput = {
${fieldsForUI
  .map(
    (field) =>
      `              ${field.name}: ${formValueFor(
        field,
        `Prisma.${model.name}UncheckedCreateInput`
      )},`
  )
  .join("\n")}
            };
            await prisma.${model.name.toLowerCase()}.create({ data });
            revalidatePath("/admin/${plural}");
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
        import { revalidatePath } from "next/cache";
        import { redirect } from "next/navigation";
        import { SmartForm } from "@/components/form/SmartForm";
        import { ${model.name}Resource } from "@/${outImportPath}/generated/${model.name}Resource";
        import type { Prisma } from "@prisma/client";

        type PageProps = { params: Promise<{ id: string }> };

        export default async function Edit${model.name}Page({ params }: PageProps) {
          const routeParams = await params;
          const id = ${idTypeBase === "Int" ? "Number(routeParams.id)" : idTypeBase === "BigInt" ? "BigInt(routeParams.id)" : "routeParams.id"};
          const existing = await prisma.${model.name.toLowerCase()}.findUnique({
            where: { ${idName}: id }
          });
          if (!existing) return <p className="text-sm text-gray-500">Not found.</p>;

          async function update(formData: FormData) {
            "use server";
            const data: Prisma.${model.name}UncheckedUpdateInput = {
${fieldsForUI
  .map(
    (field) =>
      `              ${field.name}: ${formValueFor(
        field,
        `Prisma.${model.name}UncheckedUpdateInput`
      )},`
  )
  .join("\n")}
            };
            await prisma.${model.name.toLowerCase()}.update({
              where: { ${idName}: id },
              data
            });
            revalidatePath("/admin/${plural}");
            redirect("/admin/${plural}");
          }

          const initialValues = Object.fromEntries(
            Object.entries(existing).map(([key, value]) => [
              key,
              value instanceof Date ? value.toISOString().slice(0, 16) : value,
            ])
          );

          return (
            <SmartForm
              title="Edit ${model.name}"
              fields={${model.name}Resource.fields}
              initialValues={initialValues}
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
        return `import { ${n}Resource } from "@/${outImportPath}/generated/${n}Resource";`;
      })
      .join("\n");

    const registryArray = resourceFiles
      .map((f) => f.replace("Resource.ts", "Resource"))
      .join(",\n  ");

    const registryText = `
      // Auto-generated by Switchboard CLI (safe to keep under version control)
      import { overrides, mergeResource } from "@/${outImportPath}/overrides";
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
      path.join(outDir, "registry.ts"),
      await format(registryText),
      "utf8"
    );

    console.log(
      chalk.green(
        `✅ Updated ${path.relative(resolvedProjectRoot, path.join(outDir, "registry.ts"))}`,
      ),
    );

    // Generate /admin layout + index that use the registry
    if (options.pages) {
      const adminRoot = path.join(appDir, "admin");
      await fs.ensureDir(adminRoot);

      const layout = `
        import Link from "next/link";
        import { resources } from "@/${outImportPath}/registry";

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
        import { resources } from "@/${outImportPath}/registry";

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
}

program
  .command("init")
  .description("Create the support files required by Switchboard")
  .option("--schema <path>", "Prisma schema path relative to the project root")
  .option("--app-dir <path>", "Next.js App Router directory")
  .option("--force", "Overwrite existing Switchboard support files")
  .option("--dry-run", "Show planned changes without writing files")
  .action(async (options) => {
    await initProject({
      projectRoot: process.cwd(),
      schemaPath: options.schema,
      appDir: options.appDir,
      force: options.force,
      dryRun: options.dryRun,
      log: (message) => console.log(chalk.green(message)),
    });
  });

program
  .command("generate")
  .description("Generate Switchboard resource configs and/or Next.js admin pages")
  .option("-m, --model <modelName>", "Generate a specific model only")
  .option(
    "--schema <path>",
    "Prisma schema path (defaults to src/prisma/schema.prisma, then prisma/schema.prisma)",
  )
  .option(
    "--out <path>",
    "Switchboard output directory (defaults to src/switchboard or switchboard)",
  )
  .option("--app-dir <path>", "Custom Next.js App Router directory")
  .option("--pages", "Also generate Next.js pages for each resource")
  .action(async (options) => {
    await generateProject({
      projectRoot: process.cwd(),
      model: options.model,
      pages: options.pages,
      schemaPath: options.schema,
      out: options.out,
      appDir: options.appDir,
    });
  });

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exitCode = 1;
  }
}
