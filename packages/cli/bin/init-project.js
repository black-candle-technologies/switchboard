import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

async function format(text) {
  try {
    return await prettier.format(text, { parser: "typescript" });
  } catch {
    return text;
  }
}

function relativePath(projectRoot, targetPath) {
  return path.relative(projectRoot, targetPath).split(path.sep).join("/");
}

function parseJsonConfig(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        output += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (!inString && char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (!inString && char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    output += char;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    }
  }

  return JSON.parse(output.replace(/,\s*([}\]])/g, "$1"));
}

function readJson(filePath) {
  try {
    return parseJsonConfig(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read "${filePath}" as JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function detectProjectLayout({
  projectRoot = process.cwd(),
  schemaPath,
  appDir,
} = {}) {
  const root = path.resolve(projectRoot);
  const detectedAppDir = appDir
    ? path.resolve(root, appDir)
    : fs.pathExistsSync(path.join(root, "src", "app"))
      ? path.join(root, "src", "app")
      : fs.pathExistsSync(path.join(root, "app"))
        ? path.join(root, "app")
        : undefined;

  if (!detectedAppDir || !fs.pathExistsSync(detectedAppDir)) {
    throw new Error(
      "No compatible Next.js App Router directory found. " +
        'Expected "src/app" or "app", or pass --app-dir <path>.',
    );
  }
  const relativeAppDir = path.relative(root, detectedAppDir);
  if (
    relativeAppDir === ".." ||
    relativeAppDir.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeAppDir)
  ) {
    throw new Error("--app-dir must point to a directory inside the project.");
  }

  const srcBased =
    detectedAppDir === path.join(root, "src", "app") ||
    detectedAppDir.startsWith(`${path.join(root, "src")}${path.sep}`);
  const sourceRoot = srcBased ? path.join(root, "src") : root;
  const detectedSchemaPath = schemaPath
    ? path.resolve(root, schemaPath)
    : fs.pathExistsSync(path.join(root, "src", "prisma", "schema.prisma"))
      ? path.join(root, "src", "prisma", "schema.prisma")
      : fs.pathExistsSync(path.join(root, "prisma", "schema.prisma"))
        ? path.join(root, "prisma", "schema.prisma")
        : undefined;

  if (!detectedSchemaPath || !fs.pathExistsSync(detectedSchemaPath)) {
    throw new Error(
      "No Prisma schema found. Expected src/prisma/schema.prisma or " +
        "prisma/schema.prisma, or pass --schema <path>.",
    );
  }

  const configPath = ["tsconfig.json", "jsconfig.json"]
    .map((name) => path.join(root, name))
    .find((candidate) => fs.pathExistsSync(candidate));

  if (!configPath) {
    throw new Error(
      'No tsconfig.json or jsconfig.json found. Switchboard requires an "@/*" path alias.',
    );
  }

  const config = readJson(configPath);
  const aliases = config.compilerOptions?.paths?.["@/*"];
  const baseUrl = path.resolve(
    path.dirname(configPath),
    config.compilerOptions?.baseUrl ?? ".",
  );
  const hasAlias =
    Array.isArray(aliases) &&
    aliases.some((value) => {
      const aliasRoot = value.replace(/[\\/]\*$/, "").replace(/\*$/, "");
      return path.resolve(baseUrl, aliasRoot) === sourceRoot;
    });

  if (!hasAlias) {
    const expectedAlias = srcBased ? "./src/*" : "./*";
    throw new Error(
      `Unsupported path alias in "${relativePath(root, configPath)}". ` +
        `Set compilerOptions.paths["@/*"] to ["${expectedAlias}"].`,
    );
  }

  return {
    projectRoot: root,
    appDir: detectedAppDir,
    schemaPath: detectedSchemaPath,
    sourceRoot,
    srcBased,
    configPath,
    libDir: path.join(sourceRoot, "lib"),
    switchboardDir: path.join(sourceRoot, "switchboard"),
    componentsDir: path.join(sourceRoot, "components"),
  };
}

function supportFiles(layout) {
  const switchboardImport = "@/switchboard";
  return [
    {
      path: path.join(layout.libDir, "prisma.ts"),
      content: `import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export { prisma };
`,
    },
    {
      path: path.join(layout.switchboardDir, "types.ts"),
      content: `export type TextWidget = { type: "text"; placeholder?: string };
export type EmailWidget = { type: "email"; placeholder?: string };
export type TextareaWidget = {
  type: "textarea";
  rows?: number;
  placeholder?: string;
};
export type CheckboxWidget = { type: "checkbox" };
export type DatetimeWidget = { type: "datetime" };
export type SelectWidget = {
  type: "select";
  options: { value: string; label: string }[];
};
export type RelationWidget = {
  type: "relation";
  model: string;
  valueKey?: string;
  labelKey?: string;
};

export type FieldWidget =
  | TextWidget
  | EmailWidget
  | TextareaWidget
  | CheckboxWidget
  | DatetimeWidget
  | SelectWidget
  | RelationWidget;

export type FieldConfig = {
  name: string;
  label: string;
  required?: boolean;
  width?: string;
  widget: FieldWidget;
};

export type ColumnConfig = {
  key: string;
  header?: string;
  format?: "datetime" | "date" | "boolean";
};
export type SortConfig = { key: string; dir: "asc" | "desc" };
export type ListConfig = {
  perPage?: number;
  searchable?: string[];
  columns?: ColumnConfig[];
  defaultSort?: SortConfig;
};

export type ResourceConfig<T = unknown> = {
  resource: string;
  displayName: string;
  fields: FieldConfig[];
  list?: ListConfig;
};
`,
    },
    {
      path: path.join(layout.switchboardDir, "overrides.ts"),
      content: `import type { ResourceConfig } from "${switchboardImport}/types";

export type ResourcePatch<T = unknown> = Partial<ResourceConfig<T>>;

export function mergeResource<T>(
  base: ResourceConfig<T>,
  patch?: ResourcePatch<T>,
): ResourceConfig<T> {
  const resolvedPatch = patch ?? {};
  return {
    ...base,
    ...resolvedPatch,
    fields: resolvedPatch.fields ?? base.fields,
    list: { ...(base.list ?? {}), ...(resolvedPatch.list ?? {}) },
  };
}

export const overrides: Readonly<
  Partial<Record<string, ResourcePatch<unknown>>>
> = {};
`,
    },
    {
      path: path.join(layout.switchboardDir, "registry.ts"),
      content: `import type { ResourceConfig } from "${switchboardImport}/types";

export const resources: ResourceConfig[] = [];
`,
    },
    {
      path: path.join(layout.componentsDir, "form", "SmartForm.tsx"),
      content: `"use client";

import type { FieldConfig } from "${switchboardImport}/types";

type Props = {
  title: string;
  fields: FieldConfig[];
  initialValues?: Record<string, unknown>;
  submitLabel?: string;
  cancelHref?: string;
  action: (formData: FormData) => Promise<void>;
};

export function SmartForm({
  title,
  fields,
  initialValues = {},
  submitLabel = "Save",
  cancelHref,
  action,
}: Props) {
  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <form action={action} className="space-y-4 rounded border bg-white p-4">
        {fields.map((field) => {
          const value = initialValues[field.name];
          if (field.widget.type === "select") {
            return (
              <label className="block" key={field.name}>
                <span className="text-sm font-medium">{field.label}</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  defaultValue={String(value ?? "")}
                  name={field.name}
                  required={field.required}
                >
                  <option value="" />
                  {field.widget.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          if (field.widget.type === "textarea") {
            return (
              <label className="block" key={field.name}>
                <span className="text-sm font-medium">{field.label}</span>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2"
                  defaultValue={String(value ?? "")}
                  name={field.name}
                  required={field.required}
                  rows={field.widget.rows ?? 4}
                />
              </label>
            );
          }
          if (field.widget.type === "checkbox") {
            return (
              <label className="flex items-center gap-2" key={field.name}>
                <input
                  defaultChecked={Boolean(value)}
                  name={field.name}
                  type="checkbox"
                />
                <span className="text-sm">{field.label}</span>
              </label>
            );
          }
          const inputType =
            field.widget.type === "email"
              ? "email"
              : field.widget.type === "datetime"
                ? "datetime-local"
                : "text";
          return (
            <label className="block" key={field.name}>
              <span className="text-sm font-medium">{field.label}</span>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                defaultValue={String(value ?? "")}
                name={field.name}
                required={field.required}
                type={inputType}
              />
            </label>
          );
        })}
        <div className="flex gap-2">
          <button
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
            type="submit"
          >
            {submitLabel}
          </button>
          {cancelHref ? (
            <a className="rounded border px-3 py-2 text-sm" href={cancelHref}>
              Cancel
            </a>
          ) : null}
        </div>
      </form>
    </section>
  );
}
`,
    },
    {
      path: path.join(layout.componentsDir, "table", "SimpleTable.tsx"),
      content: `import type { ReactNode } from "react";

export type Column<T> = {
  key: Extract<keyof T, string> | string;
  header?: string;
  width?: string;
  cell?: (row: T) => ReactNode;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
};

export function SimpleTable<T>({
  rows,
  columns,
  empty = "No records found.",
}: Props<T>) {
  return (
    <div className="overflow-x-auto rounded border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((column) => (
              <th className="px-3 py-2" key={String(column.key)}>
                {column.header ?? String(column.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t" key={index}>
              {columns.map((column) => (
                <td className="px-3 py-2" key={String(column.key)}>
                  {column.cell
                    ? column.cell(row)
                    : String(
                        (row as unknown as Record<string, unknown>)[
                          String(column.key)
                        ] ?? "",
                      )}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                className="px-3 py-6 text-center text-gray-500"
                colSpan={columns.length}
              >
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
`,
    },
    {
      path: path.join(layout.appDir, "admin", "layout.tsx"),
      content: `import Link from "next/link";
import { resources } from "${switchboardImport}/registry";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link className="font-semibold" href="/">
            Switchboard
          </Link>
          <Link className="text-sm hover:underline" href="/admin">
            Admin
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-3">
            <nav className="rounded border bg-white p-3">
              <h2 className="mb-2 text-sm font-semibold">Resources</h2>
              <ul className="space-y-2">
                {resources.map((resource) => (
                  <li key={resource.resource}>
                    <Link
                      className="hover:underline"
                      href={"/admin/" + resource.resource.toLowerCase() + "s"}
                    >
                      {resource.displayName}
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
`,
    },
    {
      path: path.join(layout.appDir, "admin", "page.tsx"),
      content: `import Link from "next/link";
import { resources } from "${switchboardImport}/registry";

export default function AdminIndex() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      {resources.length ? (
        <ul className="space-y-2">
          {resources.map((resource) => (
            <li key={resource.resource}>
              <Link
                className="underline"
                href={"/admin/" + resource.resource.toLowerCase() + "s"}
              >
                {resource.displayName}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600">
          Run npx switchboard generate --pages to add resources.
        </p>
      )}
    </section>
  );
}
`,
    },
  ];
}

export async function initProject({
  projectRoot = process.cwd(),
  schemaPath,
  appDir,
  force = false,
  dryRun = false,
  log = console.log,
} = {}) {
  const layout = detectProjectLayout({ projectRoot, schemaPath, appDir });
  const results = [];

  for (const file of supportFiles(layout)) {
    const exists = await fs.pathExists(file.path);
    const action = exists ? (force ? "overwrite" : "skip") : "create";
    const displayPath = relativePath(layout.projectRoot, file.path);
    results.push({ action, path: displayPath });

    if (!dryRun && action !== "skip") {
      await fs.outputFile(file.path, await format(file.content), "utf8");
    }

    if (action === "skip") {
      log(`Skipped ${displayPath} because it already exists`);
    } else if (dryRun) {
      log(`Would ${action === "create" ? "create" : "overwrite"} ${displayPath}`);
    } else {
      log(`${action === "create" ? "Created" : "Overwrote"} ${displayPath}`);
    }
  }

  log("Next: run npx switchboard generate --pages");
  return { layout, results };
}
