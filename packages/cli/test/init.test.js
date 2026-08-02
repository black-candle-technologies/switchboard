import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { afterEach, test } from "node:test";
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
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
  id           String @id @default(cuid())
  name         String
  username     String @unique
  passwordHash String
  role         Role   @default(USER)
}

enum Role {
  ADMIN
  USER
}
`;

afterEach(async () => {
  await Promise.all(
    tempProjects
      .splice(0)
      .map((projectRoot) => rm(projectRoot, { recursive: true, force: true })),
  );
});

async function createProject({
  appDir = "src/app",
  schemaPath,
  alias,
  withAlias = true,
  configFile = "tsconfig.json",
} = {}) {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-init-"),
  );
  tempProjects.push(projectRoot);

  const usesSrc = appDir.startsWith("src/");
  const resolvedSchemaPath =
    schemaPath ??
    (usesSrc ? "src/prisma/schema.prisma" : "prisma/schema.prisma");
  await mkdir(path.join(projectRoot, appDir), { recursive: true });
  await mkdir(path.dirname(path.join(projectRoot, resolvedSchemaPath)), {
    recursive: true,
  });
  await writeFile(path.join(projectRoot, resolvedSchemaPath), schema, "utf8");
  await writeFile(
    path.join(projectRoot, configFile),
    JSON.stringify(
      {
        compilerOptions: withAlias
          ? {
              baseUrl: ".",
              paths: { "@/*": [alias ?? (usesSrc ? "./src/*" : "./*")] },
            }
          : {},
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
    "src/switchboard/auth.ts",
    "src/switchboard/auth-actions.ts",
    "src/components/form/SmartForm.tsx",
    "src/components/form/DeleteButton.tsx",
    "src/components/table/SimpleTable.tsx",
    "src/middleware.ts",
    "src/app/admin/switchboard.css",
    "src/app/admin/layout.tsx",
    "src/app/admin/page.tsx",
    "src/app/admin/login/page.tsx",
    "src/app/admin/logout/route.ts",
  ];
  await Promise.all(
    expectedFiles.map((file) => access(path.join(projectRoot, file))),
  );
  assert.match(stdout, /Created src\/lib\/prisma\.ts/);
  const layout = await readFile(
    path.join(projectRoot, "src", "app", "admin", "layout.tsx"),
    "utf8",
  );
  const stylesheet = await readFile(
    path.join(projectRoot, "src", "app", "admin", "switchboard.css"),
    "utf8",
  );
  assert.match(layout, /import "\.\/switchboard\.css"/);
  assert.match(layout, /className="sb-admin-shell"/);
  assert.match(layout, /<form action=\{logout\}>/);
  assert.match(stylesheet, /\.sb-admin-shell/);
  assert.match(stylesheet, /\.sb-table/);
  assert.match(stylesheet, /\.sb-form/);
  assert.match(stylesheet, /\.sb-form-field/);
  assert.match(stylesheet, /\.sb-form-control/);
  assert.match(stylesheet, /\.sb-textarea/);
  assert.match(stylesheet, /\.sb-select/);
  assert.match(stylesheet, /\.sb-login-shell/);
  const smartForm = await readFile(
    path.join(projectRoot, "src", "components", "form", "SmartForm.tsx"),
    "utf8",
  );
  assert.match(smartForm, /className="sb-form-field"/);
  assert.match(smartForm, /className="sb-form-label"/);
  assert.match(smartForm, /className="sb-form-control sb-textarea"/);
  assert.match(smartForm, /className="sb-form-control sb-select"/);
  assert.match(smartForm, /useActionState/);
  assert.match(smartForm, /submittedValues\.current = new FormData/);
  assert.match(smartForm, /if \(field\.widget\.type === "password"\) continue/);
  assert.match(smartForm, /relationOptions/);
  const deleteButton = await readFile(
    path.join(projectRoot, "src", "components", "form", "DeleteButton.tsx"),
    "utf8",
  );
  assert.match(deleteButton, /window\.confirm/);
  assert.match(deleteButton, /useActionState/);
  assert.match(stdout, /Next: run npx switchboard generate --pages/);
  assert.match(stdout, /SWITCHBOARD_SESSION_SECRET/);
  assert.match(stdout, /auth seed-admin/);
});

test("init creates support files in a root app project and generate still works", async () => {
  const projectRoot = await createProject({
    appDir: "app",
    configFile: "jsconfig.json",
  });

  await runCli(projectRoot, "init");
  await runCli(projectRoot, "generate", "--pages");

  await access(path.join(projectRoot, "lib", "prisma.ts"));
  await access(path.join(projectRoot, "switchboard", "types.ts"));
  await access(path.join(projectRoot, "app", "admin", "switchboard.css"));
  await access(path.join(projectRoot, "app", "admin", "users", "page.tsx"));
  const userPage = await readFile(
    path.join(projectRoot, "app", "admin", "users", "page.tsx"),
    "utf8",
  );
  assert.match(userPage, /from "@\/switchboard\/generated\/UserResource"/);
});

for (const { name, appDir, schemaPath, supportRoot } of [
  {
    name: "src/app + src/prisma without an alias",
    appDir: "src/app",
    schemaPath: "src/prisma/schema.prisma",
    supportRoot: "src",
  },
  {
    name: "root app + root prisma without an alias",
    appDir: "app",
    schemaPath: "prisma/schema.prisma",
    supportRoot: "",
  },
]) {
  test(`${name} uses relative generated imports`, async () => {
    const projectRoot = await createProject({
      appDir,
      schemaPath,
      withAlias: false,
    });

    await runCli(projectRoot, "init");
    await runCli(projectRoot, "generate", "--pages");

    const prefix = supportRoot ? [supportRoot] : [];
    const smartForm = await readFile(
      path.join(projectRoot, ...prefix, "components", "form", "SmartForm.tsx"),
      "utf8",
    );
    const layout = await readFile(
      path.join(projectRoot, appDir, "admin", "layout.tsx"),
      "utf8",
    );
    const listPage = await readFile(
      path.join(projectRoot, appDir, "admin", "users", "page.tsx"),
      "utf8",
    );
    const resource = await readFile(
      path.join(
        projectRoot,
        ...prefix,
        "switchboard",
        "generated",
        "UserResource.ts",
      ),
      "utf8",
    );
    const registry = await readFile(
      path.join(projectRoot, ...prefix, "switchboard", "registry.ts"),
      "utf8",
    );

    assert.match(smartForm, /from "\.\.\/\.\.\/switchboard\/types"/);
    assert.match(layout, /from "\.\.\/\.\.\/switchboard\/registry"/);
    assert.match(listPage, /from "\.\.\/\.\.\/\.\.\/lib\/prisma"/);
    assert.match(
      listPage,
      /from "\.\.\/\.\.\/\.\.\/switchboard\/generated\/UserResource"/,
    );
    assert.match(
      listPage,
      /from "\.\.\/\.\.\/\.\.\/components\/form\/DeleteButton"/,
    );
    assert.match(resource, /from "\.\.\/types"/);
    assert.match(registry, /from "\.\/overrides"/);
    assert.doesNotMatch(
      `${smartForm}\n${layout}\n${listPage}\n${resource}\n${registry}`,
      /from "@\//,
    );
  });
}

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

test("init preserves the admin stylesheet unless --force is used", async () => {
  const projectRoot = await createProject();
  const target = path.join(
    projectRoot,
    "src",
    "app",
    "admin",
    "switchboard.css",
  );
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, "/* user stylesheet */\n", "utf8");

  const dryRunSkipped = await runCli(projectRoot, "init", "--dry-run");
  assert.match(
    dryRunSkipped.stdout,
    /Would skip src\/app\/admin\/switchboard\.css because it already exists; use --force to overwrite/,
  );

  const dryRunForced = await runCli(
    projectRoot,
    "init",
    "--dry-run",
    "--force",
  );
  assert.match(
    dryRunForced.stdout,
    /Would overwrite src\/app\/admin\/switchboard\.css/,
  );

  const skipped = await runCli(projectRoot, "init");
  assert.equal(await readFile(target, "utf8"), "/* user stylesheet */\n");
  assert.match(
    skipped.stdout,
    /Skipped src\/app\/admin\/switchboard\.css because it already exists/,
  );

  const forced = await runCli(projectRoot, "init", "--force");
  assert.match(await readFile(target, "utf8"), /\.sb-admin-shell/);
  assert.match(forced.stdout, /Overwrote src\/app\/admin\/switchboard\.css/);
});

test("init --dry-run writes nothing", async () => {
  const projectRoot = await createProject();
  const { stdout } = await runCli(projectRoot, "init", "--dry-run");

  await assert.rejects(
    access(path.join(projectRoot, "src", "lib", "prisma.ts")),
  );
  await assert.rejects(
    access(path.join(projectRoot, "src", "app", "admin", "page.tsx")),
  );
  assert.match(stdout, /Would create src\/lib\/prisma\.ts/);
  assert.match(stdout, /Would create src\/app\/admin\/switchboard\.css/);
  assert.match(stdout, /Detected project structure:/);
  assert.match(stdout, /App directory: src\/app/);
  assert.match(stdout, /Prisma schema: src\/prisma\/schema\.prisma/);
  assert.match(stdout, /Source root: src/);
  assert.match(stdout, /Import alias: @\/\* -> \.\/src\/\*/);
  assert.match(stdout, /Admin auth: User\.username/);
  assert.match(stdout, /Would create src\/middleware\.ts/);
  assert.match(stdout, /Would create src\/app\/admin\/login\/page\.tsx/);
  assert.match(stdout, /auth seed-admin/);
});

test("init --dry-run reports when relative imports will be used", async () => {
  const projectRoot = await createProject({ withAlias: false });
  const { stdout } = await runCli(projectRoot, "init", "--dry-run");

  assert.match(stdout, /Import alias: none \(using relative imports\)/);
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
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-init-"),
  );
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
    assert.match(error.stderr, /No Next\.js App Router directory found/);
    assert.match(error.stderr, /pass --app-dir <path>/);
    return true;
  });
});

test("init gives a clear error when no Prisma schema is found", async () => {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-init-"),
  );
  tempProjects.push(projectRoot);
  await mkdir(path.join(projectRoot, "src", "app"), { recursive: true });

  await assert.rejects(runCli(projectRoot, "init"), (error) => {
    assert.match(error.stderr, /No Prisma schema found/);
    assert.match(error.stderr, /src\/prisma\/schema\.prisma/);
    assert.match(error.stderr, /pass --schema <path>/);
    return true;
  });
});

test("init validates manual app and schema overrides", async () => {
  const projectRoot = await createProject();

  await assert.rejects(
    runCli(projectRoot, "init", "--app-dir", "missing-app"),
    (error) => {
      assert.match(error.stderr, /Invalid --app-dir "missing-app"/);
      assert.match(error.stderr, /no directory exists/);
      return true;
    },
  );

  await assert.rejects(
    runCli(projectRoot, "init", "--schema", "missing.prisma"),
    (error) => {
      assert.match(error.stderr, /Invalid --schema "missing\.prisma"/);
      assert.match(error.stderr, /no Prisma schema file exists/);
      return true;
    },
  );
});

test("init rejects a Prisma schema without the required auth fields", async () => {
  const projectRoot = await createProject();
  await writeFile(
    path.join(projectRoot, "src", "prisma", "schema.prisma"),
    "model User { id String @id }\n",
    "utf8",
  );

  await assert.rejects(runCli(projectRoot, "init"), (error) => {
    assert.match(error.stderr, /requires an auth-ready User model/);
    assert.match(error.stderr, /passwordHash/);
    assert.match(error.stderr, /Switchboard will not modify it automatically/);
    return true;
  });
});

test("init protects an existing middleware unless --force is used", async () => {
  const projectRoot = await createProject();
  const middlewarePath = path.join(projectRoot, "src", "middleware.ts");
  await writeFile(middlewarePath, "// user middleware\n", "utf8");

  await assert.rejects(runCli(projectRoot, "init"), (error) => {
    assert.match(error.stderr, /Cannot safely protect \/admin/);
    assert.match(error.stderr, /re-run init with --force/);
    return true;
  });
  assert.equal(await readFile(middlewarePath, "utf8"), "// user middleware\n");
  await assert.rejects(
    access(path.join(projectRoot, "src", "lib", "prisma.ts")),
  );

  const forced = await runCli(projectRoot, "init", "--force");
  assert.match(forced.stdout, /Overwrote src\/middleware\.ts/);
  assert.match(await readFile(middlewarePath, "utf8"), /\/admin\/:path\*/);
});

test("init does not create environment or database files", async () => {
  const projectRoot = await createProject();
  await runCli(projectRoot, "init");

  const files = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await collect(entryPath);
      } else {
        files.push(path.relative(projectRoot, entryPath).replaceAll("\\", "/"));
      }
    }
  }
  await collect(projectRoot);

  assert.equal(
    files.some((file) => path.basename(file) === ".env"),
    false,
  );
  assert.equal(
    files.some((file) => /\.(?:db|sqlite|sqlite3)$/.test(file)),
    false,
  );
});
