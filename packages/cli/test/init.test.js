import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { afterEach, test } from "node:test";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(testDir, "..", "bin", "switchboard.js");
const execFileAsync = promisify(execFile);
const tempProjects = [];
const schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url = env("DATABASE_URL")
}

model User {
  id String @id @default(cuid())
  name String
}
`;

afterEach(async () => {
  await Promise.all(
    tempProjects.splice(0).map((projectRoot) =>
      rm(projectRoot, { recursive: true, force: true }),
    ),
  );
});

async function createProject({
  appDir = "src/app",
  schemaPath,
  alias,
} = {}) {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "switchboard-init-"));
  tempProjects.push(projectRoot);

  const usesSrc = appDir.startsWith("src/");
  const resolvedSchemaPath =
    schemaPath ?? (usesSrc ? "src/prisma/schema.prisma" : "prisma/schema.prisma");
  await mkdir(path.join(projectRoot, appDir), { recursive: true });
  await mkdir(path.dirname(path.join(projectRoot, resolvedSchemaPath)), {
    recursive: true,
  });
  await writeFile(path.join(projectRoot, resolvedSchemaPath), schema, "utf8");
  await writeFile(
    path.join(projectRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": [alias ?? (usesSrc ? "./src/*" : "./*")] },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  return projectRoot;
}

async function runCli(projectRoot, ...args) {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    cwd: projectRoot,
  });
}

test("init creates support files in a src/app project", async () => {
  const projectRoot = await createProject();
  const { stdout } = await runCli(projectRoot, "init");

  const expectedFiles = [
    "src/lib/prisma.ts",
    "src/switchboard/types.ts",
    "src/switchboard/registry.ts",
    "src/switchboard/overrides.ts",
    "src/components/form/SmartForm.tsx",
    "src/components/table/SimpleTable.tsx",
    "src/app/admin/layout.tsx",
    "src/app/admin/page.tsx",
  ];
  await Promise.all(
    expectedFiles.map((file) => access(path.join(projectRoot, file))),
  );
  assert.match(stdout, /Created src\/lib\/prisma\.ts/);
  assert.match(stdout, /Next: run npx switchboard generate --pages/);
});

test("init creates support files in a root app project and generate still works", async () => {
  const projectRoot = await createProject({ appDir: "app" });

  await runCli(projectRoot, "init");
  await runCli(projectRoot, "generate", "--pages");

  await access(path.join(projectRoot, "lib", "prisma.ts"));
  await access(path.join(projectRoot, "switchboard", "types.ts"));
  await access(path.join(projectRoot, "app", "admin", "users", "page.tsx"));
  const userPage = await readFile(
    path.join(projectRoot, "app", "admin", "users", "page.tsx"),
    "utf8",
  );
  assert.match(userPage, /from "@\/switchboard\/generated\/UserResource"/);
});

test("init skips existing files unless --force is used", async () => {
  const projectRoot = await createProject();
  const target = path.join(projectRoot, "src", "lib", "prisma.ts");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, "user-owned\n", "utf8");

  const skipped = await runCli(projectRoot, "init");
  assert.equal(await readFile(target, "utf8"), "user-owned\n");
  assert.match(skipped.stdout, /Skipped src\/lib\/prisma\.ts/);

  const forced = await runCli(projectRoot, "init", "--force");
  assert.notEqual(await readFile(target, "utf8"), "user-owned\n");
  assert.match(forced.stdout, /Overwrote src\/lib\/prisma\.ts/);
});

test("init --dry-run writes nothing", async () => {
  const projectRoot = await createProject();
  const { stdout } = await runCli(projectRoot, "init", "--dry-run");

  await assert.rejects(access(path.join(projectRoot, "src", "lib", "prisma.ts")));
  await assert.rejects(
    access(path.join(projectRoot, "src", "app", "admin", "page.tsx")),
  );
  assert.match(stdout, /Would create src\/lib\/prisma\.ts/);
});

test("init supports custom schema and app directories", async () => {
  const projectRoot = await createProject({
    appDir: "src/web-app",
    schemaPath: "config/database.prisma",
  });

  await runCli(
    projectRoot,
    "init",
    "--schema",
    "config/database.prisma",
    "--app-dir",
    "src/web-app",
  );
  await runCli(
    projectRoot,
    "generate",
    "--schema",
    "config/database.prisma",
    "--app-dir",
    "src/web-app",
    "--pages",
  );

  await access(path.join(projectRoot, "src", "web-app", "admin", "layout.tsx"));
  await access(
    path.join(projectRoot, "src", "web-app", "admin", "users", "page.tsx"),
  );
  await access(
    path.join(
      projectRoot,
      "src",
      "switchboard",
      "generated",
      "UserResource.ts",
    ),
  );
  await access(path.join(projectRoot, "src", "switchboard", "types.ts"));
});

test("init gives a clear error without a compatible App Router directory", async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "switchboard-init-"));
  tempProjects.push(projectRoot);
  await mkdir(path.join(projectRoot, "prisma"), { recursive: true });
  await writeFile(
    path.join(projectRoot, "prisma", "schema.prisma"),
    schema,
    "utf8",
  );
  await writeFile(
    path.join(projectRoot, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { paths: { "@/*": ["./*"] } },
    }),
    "utf8",
  );

  await assert.rejects(runCli(projectRoot, "init"), (error) => {
    assert.match(error.stderr, /No compatible Next\.js App Router directory/);
    assert.match(error.stderr, /pass --app-dir <path>/);
    return true;
  });
});
