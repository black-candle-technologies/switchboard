import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { detectProjectLayout } from "../src/project/detectProject.js";
import { importPath } from "../src/project/importPath.js";

const tempProjects = [];

afterEach(async () => {
  await Promise.all(
    tempProjects.splice(0).map((projectRoot) =>
      rm(projectRoot, { recursive: true, force: true }),
    ),
  );
});

test("project detection prefers src/app and src/prisma", async () => {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-detection-"),
  );
  tempProjects.push(projectRoot);
  await mkdir(path.join(projectRoot, "src", "app"), { recursive: true });
  await mkdir(path.join(projectRoot, "app"), { recursive: true });
  await mkdir(path.join(projectRoot, "src", "prisma"), { recursive: true });
  await mkdir(path.join(projectRoot, "prisma"), { recursive: true });
  await writeFile(
    path.join(projectRoot, "src", "prisma", "schema.prisma"),
    "model Source { id String @id }\n",
    "utf8",
  );
  await writeFile(
    path.join(projectRoot, "prisma", "schema.prisma"),
    "model Root { id String @id }\n",
    "utf8",
  );

  const layout = detectProjectLayout({ projectRoot });

  assert.equal(layout.appDir, path.join(projectRoot, "src", "app"));
  assert.equal(
    layout.schemaPath,
    path.join(projectRoot, "src", "prisma", "schema.prisma"),
  );
  assert.equal(layout.sourceRoot, path.join(projectRoot, "src"));
  assert.equal(layout.libDir, path.join(projectRoot, "src", "lib"));
  assert.equal(
    layout.componentsDir,
    path.join(projectRoot, "src", "components"),
  );
  assert.equal(layout.hasImportAlias, false);
});

test("import paths use a detected alias or a relative fallback", () => {
  const projectRoot = path.resolve("example-project");
  const sourceRoot = path.join(projectRoot, "src");
  const fromFile = path.join(
    sourceRoot,
    "app",
    "admin",
    "users",
    "page.tsx",
  );
  const targetFile = path.join(sourceRoot, "lib", "prisma.ts");

  assert.equal(
    importPath(
      {
        sourceRoot,
        importAlias: { prefix: "@", pattern: "@/*", target: "./src/*" },
      },
      fromFile,
      targetFile,
    ),
    "@/lib/prisma",
  );
  assert.equal(
    importPath({ sourceRoot }, fromFile, targetFile),
    "../../../lib/prisma",
  );
});

test("project detection checks jsconfig when tsconfig has no usable alias", async () => {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-detection-"),
  );
  tempProjects.push(projectRoot);
  await mkdir(path.join(projectRoot, "app"), { recursive: true });
  await mkdir(path.join(projectRoot, "prisma"), { recursive: true });
  await writeFile(
    path.join(projectRoot, "prisma", "schema.prisma"),
    "model User { id String @id }\n",
    "utf8",
  );
  await writeFile(
    path.join(projectRoot, "tsconfig.json"),
    JSON.stringify({ compilerOptions: {} }),
    "utf8",
  );
  await writeFile(
    path.join(projectRoot, "jsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": ["./*"] },
      },
    }),
    "utf8",
  );

  const layout = detectProjectLayout({ projectRoot });

  assert.equal(layout.hasImportAlias, true);
  assert.equal(layout.configPath, path.join(projectRoot, "jsconfig.json"));
  assert.equal(layout.importAlias.target, "./*");
});

test("project detection accepts a UTF-8 BOM in config files", async () => {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-detection-"),
  );
  tempProjects.push(projectRoot);
  await mkdir(path.join(projectRoot, "src", "app"), { recursive: true });
  await mkdir(path.join(projectRoot, "src", "prisma"), { recursive: true });
  await writeFile(
    path.join(projectRoot, "src", "prisma", "schema.prisma"),
    "model User { id String @id }\n",
    "utf8",
  );
  await writeFile(
    path.join(projectRoot, "tsconfig.json"),
    `\uFEFF${JSON.stringify({
      compilerOptions: {
        paths: { "@/*": ["./src/*"] },
      },
    })}`,
    "utf8",
  );

  const layout = detectProjectLayout({ projectRoot });

  assert.equal(layout.hasImportAlias, true);
});
