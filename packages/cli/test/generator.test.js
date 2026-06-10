import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { afterEach, test } from "node:test";
import {
  access,
  copyFile,
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

import { generateProject } from "../src/generator/generateProject.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(testDir, "..", "bin", "switchboard.js");
const execFileAsync = promisify(execFile);
const tempProjects = [];
const stripAnsi = (value) => value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");

afterEach(async () => {
  await Promise.all(
    tempProjects
      .splice(0)
      .map((projectRoot) => rm(projectRoot, { recursive: true, force: true })),
  );
});

async function createFixtureProject(
  fixtureName = "basic",
  {
    createApp = true,
    schemaPath = path.join("src", "prisma", "schema.prisma"),
    aliasTarget = "./src/*",
  } = {},
) {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-generator-"),
  );
  tempProjects.push(projectRoot);

  const targetSchemaPath = path.join(projectRoot, schemaPath);
  await mkdir(path.dirname(targetSchemaPath), { recursive: true });
  await copyFile(
    path.join(testDir, "fixtures", fixtureName, "schema.prisma"),
    targetSchemaPath,
  );
  if (createApp) {
    await mkdir(path.join(projectRoot, "src", "app"), { recursive: true });
  }
  if (aliasTarget) {
    await writeFile(
      path.join(projectRoot, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": [aliasTarget] },
        },
      }),
      "utf8",
    );
  }

  return projectRoot;
}

async function generateFixture(fixtureName = "basic", options = {}) {
  const projectRoot = await createFixtureProject(fixtureName);
  await generateProject({ projectRoot, pages: true, ...options });
  return projectRoot;
}

async function readGenerated(projectRoot, ...segments) {
  return readFile(path.join(projectRoot, ...segments), "utf8");
}

test("generates separate User list, create, and edit routes", async () => {
  const projectRoot = await generateFixture();

  const listPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "users",
    "page.tsx",
  );
  const newPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "users",
    "new",
    "page.tsx",
  );
  const editPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "users",
    "[id]",
    "edit",
    "page.tsx",
  );

  assert.match(listPage, /export default async function UserListPage/);
  assert.match(listPage, /searchParams: Promise<SearchParams>/);
  assert.match(listPage, /const params = await searchParams/);
  assert.match(listPage, /href="\/admin\/users\/new"/);
  assert.match(listPage, /className="sb-page"/);
  assert.match(listPage, /className="sb-table"/);
  assert.match(listPage, /className="sb-empty-state"/);
  assert.match(listPage, /className="sb-pagination"/);

  assert.match(newPage, /export default async function NewUserPage/);
  assert.match(newPage, /async function create\([\s\S]*formData: FormData/);
  assert.match(newPage, /Prisma\.UserUncheckedCreateInput/);
  assert.match(newPage, /await prisma\.user\.create\(\{ data \}\)/);
  assert.match(newPage, /passwordHash: await hashPassword/);
  assert.match(newPage, /actionErrorMessage\(error, "save"\)/);
  assert.match(newPage, /<SmartForm/);
  assert.match(newPage, /submitLabel="Create"/);
  assert.doesNotMatch(newPage, /UserListPage/);
  assert.doesNotMatch(newPage, /searchParams/);
  assert.doesNotMatch(newPage, /findMany/);
  assert.doesNotMatch(newPage, /sortKey/);

  assert.match(editPage, /export default async function EditUserPage/);
  assert.match(editPage, /params: Promise<\{ id: string \}>/);
  assert.match(editPage, /const routeParams = await params/);
  assert.match(editPage, /Prisma\.UserUncheckedUpdateInput/);
  assert.match(editPage, /await hashPassword/);
  assert.match(editPage, /\["password", "passwordHash"\]\.includes\(key\)/);
  assert.match(editPage, /new Set<string>\(\[\]\)/);
  assert.match(editPage, /await prisma\.user\.update/);
  assert.doesNotMatch(editPage, /UserListPage|searchParams|findMany/);
});

test("generates typed form widgets and relation selects without a database", async () => {
  const projectRoot = await generateFixture();

  const userResource = await readGenerated(
    projectRoot,
    "src",
    "switchboard",
    "generated",
    "UserResource.ts",
  );
  const postNewPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "posts",
    "new",
    "page.tsx",
  );
  const postListPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "posts",
    "page.tsx",
  );
  const postResource = await readGenerated(
    projectRoot,
    "src",
    "switchboard",
    "generated",
    "PostResource.ts",
  );

  assert.match(userResource, /"ADMIN"/);
  assert.match(userResource, /"USER"/);
  assert.match(userResource, /type: "password"/);
  assert.doesNotMatch(userResource, /columns:\s*\[[\s\S]*key: "passwordHash"/);
  assert.doesNotMatch(userResource, /name: "posts"/);

  assert.match(postResource, /name: "content"[\s\S]*required: false/);
  assert.match(postResource, /name: "status"[\s\S]*type: "select"/);
  assert.match(postResource, /name: "featured"[\s\S]*type: "checkbox"/);
  assert.match(postResource, /name: "viewCount"[\s\S]*type: "number"/);
  assert.match(postResource, /name: "publishedAt"[\s\S]*type: "datetime"/);
  assert.match(postResource, /name: "metadata"[\s\S]*type: "json"/);
  assert.match(
    postResource,
    /name: "authorId"[\s\S]*type: "relation"[\s\S]*model: "User"/,
  );

  assert.match(postNewPage, /export default async function NewPostPage/);
  assert.match(postNewPage, /authorId: String\(formData\.get\("authorId"\)/);
  assert.match(postNewPage, /prisma\.user\.findMany/);
  assert.match(postNewPage, /relationOptions=\{relationOptions\}/);
  assert.match(
    postNewPage,
    /featured: String\(formData\.get\("featured"\)[\s\S]*=== "true"/,
  );
  assert.match(postNewPage, /viewCount: formData\.get\("viewCount"\)/);
  assert.match(postNewPage, /publishedAt: formData\.get\("publishedAt"\)/);
  assert.match(postNewPage, /JSON\.parse/);
  assert.match(postNewPage, /await prisma\.post\.create\(\{ data \}\)/);
  assert.doesNotMatch(postNewPage, /PostListPage|searchParams/);

  assert.match(postListPage, /include: relationInclude/);
  assert.match(postListPage, /relationLabelKey: "name"/);
  assert.match(
    postListPage,
    /No post records yet\. Create one to get started\./,
  );
  assert.match(postListPage, /<DeleteButton/);
  assert.match(postListPage, /actionErrorMessage\(error, "delete"\)/);
  assert.match(postListPage, /Math\.min\(safeRequestedPage, totalPages\)/);
  assert.match(postListPage, /supportedSortFields/);
});

test("supports mapped fields, defaults, optional scalars, lists, relations, and custom IDs", async () => {
  const projectRoot = await generateFixture("schema-edge-cases");

  const accountResource = await readGenerated(
    projectRoot,
    "src",
    "switchboard",
    "generated",
    "AccountResource.ts",
  );
  const accountListPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "accounts",
    "page.tsx",
  );
  const accountNewPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "accounts",
    "new",
    "page.tsx",
  );
  const accountEditPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "accounts",
    "[id]",
    "edit",
    "page.tsx",
  );
  const postResource = await readGenerated(
    projectRoot,
    "src",
    "switchboard",
    "generated",
    "PostResource.ts",
  );
  const postNewPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "posts",
    "new",
    "page.tsx",
  );

  assert.match(accountResource, /name: "slug"/);
  assert.match(accountResource, /name: "nickname"/);
  assert.match(accountResource, /required: false/);
  assert.match(accountResource, /"ACTIVE"/);
  assert.match(accountResource, /"DISABLED"/);
  assert.doesNotMatch(accountResource, /name: "tags"/);
  assert.doesNotMatch(accountResource, /name: "posts"/);
  assert.doesNotMatch(accountResource, /@map|@@map/);

  assert.match(accountListPage, /const defaultSortKey =/);
  assert.match(accountListPage, /: undefined\) as/);
  assert.doesNotMatch(accountListPage, /createdAt/);
  assert.match(accountListPage, /values\.slug/);
  assert.match(accountListPage, /supportedSearchFields/);

  assert.match(accountNewPage, /slug: String\(formData\.get\("slug"\)/);
  assert.match(
    accountNewPage,
    /externalId: formData\.get\("externalId"\)[\s\S]*: undefined/,
  );
  assert.doesNotMatch(accountNewPage, /formData\.get\("tags"\)/);
  assert.doesNotMatch(accountNewPage, /formData\.get\("posts"\)/);

  assert.match(accountEditPage, /where: \{ slug: id \}/);
  assert.match(accountEditPage, /const id = routeParams\.id/);

  assert.match(
    postResource,
    /name: "accountSlug"[\s\S]*type: "relation"[\s\S]*valueKey: "slug"/,
  );
  assert.match(postNewPage, /prisma\.account\.findMany/);
  assert.match(postNewPage, /accountSlug: accountRecords\.map/);
});

test("rejects compound IDs before generating admin pages", async () => {
  const projectRoot = await createFixtureProject("compound-id");

  await assert.rejects(
    generateProject({ projectRoot, pages: true }),
    /model "Membership": compound IDs \(@@id\(\[tenantId, userId\]\)\) are not supported/,
  );
  await assert.rejects(
    readGenerated(
      projectRoot,
      "src",
      "app",
      "admin",
      "memberships",
      "page.tsx",
    ),
    /ENOENT/,
  );
});

test("rejects models without one explicit scalar primary key", async () => {
  const projectRoot = await createFixtureProject("no-primary-key");

  await assert.rejects(
    generateProject({ projectRoot, pages: true }),
    /model "ExternalRecord": expected one explicit scalar @id field/,
  );
});

test("CLI reports unsupported compound IDs without an async stack trace", async () => {
  const projectRoot = await createFixtureProject("compound-id");

  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "generate", "--pages"], {
      cwd: projectRoot,
    }),
    (error) => {
      const stderr = stripAnsi(error.stderr);
      assert.equal(error.code, 1);
      assert.match(stderr, /^Error: Cannot generate admin pages/);
      assert.match(stderr, /compound IDs/);
      assert.doesNotMatch(stderr, /\n\s+at /);
      return true;
    },
  );
});

test("CLI supports custom schema and Switchboard output paths", async () => {
  const schemaPath = path.join("config", "prisma", "app.prisma");
  const projectRoot = await createFixtureProject("basic", { schemaPath });

  await execFileAsync(
    process.execPath,
    [
      cliPath,
      "generate",
      "--schema",
      schemaPath,
      "--out",
      "src/admin-kit",
      "--pages",
    ],
    { cwd: projectRoot },
  );

  const userResource = await readGenerated(
    projectRoot,
    "src",
    "admin-kit",
    "generated",
    "UserResource.ts",
  );
  const registry = await readGenerated(
    projectRoot,
    "src",
    "admin-kit",
    "registry.ts",
  );
  const userPage = await readGenerated(
    projectRoot,
    "src",
    "app",
    "admin",
    "users",
    "page.tsx",
  );

  assert.match(userResource, /from "@\/admin-kit\/types"/);
  assert.match(registry, /from "@\/admin-kit\/overrides"/);
  assert.match(userPage, /from "@\/admin-kit\/generated\/UserResource"/);
});

test("CLI gives actionable errors for missing and invalid schemas", async () => {
  const projectRoot = await createFixtureProject();

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [cliPath, "generate", "--schema", "missing/schema.prisma"],
      { cwd: projectRoot },
    ),
    (error) => {
      const stderr = stripAnsi(error.stderr);
      assert.match(stderr, /Invalid --schema "missing\/schema\.prisma"/);
      assert.match(stderr, /no Prisma schema file exists/);
      return true;
    },
  );

  const invalidSchemaPath = path.join(projectRoot, "invalid.prisma");
  await writeFile(
    invalidSchemaPath,
    'datasource db {\n  provider = "sqlite"\n  url = env("DATABASE_URL")\n}\n',
    "utf8",
  );

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [cliPath, "generate", "--schema", "invalid.prisma"],
      { cwd: projectRoot },
    ),
    (error) => {
      const stderr = stripAnsi(error.stderr);
      assert.match(stderr, /No Prisma models found/);
      assert.match(stderr, /contains at least one model block/);
      return true;
    },
  );
});

test("CLI rejects missing App Router and output paths outside src", async () => {
  const projectRoot = await createFixtureProject("basic", {
    createApp: false,
  });

  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, "generate", "--pages"], {
      cwd: projectRoot,
    }),
    (error) => {
      const stderr = stripAnsi(error.stderr);
      assert.match(stderr, /No Next\.js App Router directory found/);
      assert.match(stderr, /Expected src\/app or app/);
      return true;
    },
  );

  const srcProjectRoot = await createFixtureProject();
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [cliPath, "generate", "--out", "generated-switchboard"],
      { cwd: srcProjectRoot },
    ),
    (error) => {
      const stderr = stripAnsi(error.stderr);
      assert.match(stderr, /Unsupported output path/);
      assert.match(stderr, /inside "src"/);
      return true;
    },
  );
});

test("CLI supports root app projects without a src directory", async () => {
  const projectRoot = await createFixtureProject("basic", {
    createApp: false,
    schemaPath: "schema.prisma",
    aliasTarget: "./*",
  });
  await mkdir(path.join(projectRoot, "app"), { recursive: true });

  await execFileAsync(
    process.execPath,
    [cliPath, "generate", "--schema", "schema.prisma", "--pages"],
    { cwd: projectRoot },
  );

  await access(path.join(projectRoot, "app", "admin", "users", "page.tsx"));
  await access(
    path.join(projectRoot, "switchboard", "generated", "UserResource.ts"),
  );
});

test("generate --dry-run reports planned actions and writes nothing", async () => {
  const projectRoot = await createFixtureProject();

  const { stdout } = await execFileAsync(
    process.execPath,
    [cliPath, "generate", "--pages", "--dry-run"],
    { cwd: projectRoot },
  );

  assert.match(stdout, /Detected project structure:/);
  assert.match(stdout, /Output directory: src\/switchboard/);
  assert.match(
    stdout,
    /Would create src\/switchboard\/generated\/UserResource\.ts/,
  );
  assert.match(stdout, /Would create src\/app\/admin\/users\/page\.tsx/);
  await assert.rejects(
    access(
      path.join(
        projectRoot,
        "src",
        "switchboard",
        "generated",
        "UserResource.ts",
      ),
    ),
  );
  await assert.rejects(
    access(path.join(projectRoot, "src", "app", "admin", "users", "page.tsx")),
  );
});

test("generate protects existing resource and page files unless forced", async () => {
  const projectRoot = await createFixtureProject();
  await generateProject({ projectRoot, pages: true });

  const resourcePath = path.join(
    projectRoot,
    "src",
    "switchboard",
    "generated",
    "UserResource.ts",
  );
  const pagePath = path.join(
    projectRoot,
    "src",
    "app",
    "admin",
    "users",
    "page.tsx",
  );

  const unchangedRun = await execFileAsync(
    process.execPath,
    [cliPath, "generate", "--pages"],
    { cwd: projectRoot },
  );
  assert.match(
    unchangedRun.stdout,
    /Unchanged src\/switchboard\/generated\/UserResource\.ts/,
  );
  assert.match(
    unchangedRun.stdout,
    /Unchanged src\/app\/admin\/users\/page\.tsx/,
  );

  await writeFile(resourcePath, "// user resource edit\n", "utf8");
  await writeFile(pagePath, "// user page edit\n", "utf8");

  const protectedRun = await execFileAsync(
    process.execPath,
    [cliPath, "generate", "--pages"],
    { cwd: projectRoot },
  );
  assert.equal(await readFile(resourcePath, "utf8"), "// user resource edit\n");
  assert.equal(await readFile(pagePath, "utf8"), "// user page edit\n");
  assert.match(
    protectedRun.stdout,
    /Skipped src\/switchboard\/generated\/UserResource\.ts because it already exists; use --force to overwrite/,
  );
  assert.match(
    protectedRun.stdout,
    /Skipped src\/app\/admin\/users\/page\.tsx because it already exists; use --force to overwrite/,
  );

  const forcedDryRun = await execFileAsync(
    process.execPath,
    [cliPath, "generate", "--pages", "--force", "--dry-run"],
    { cwd: projectRoot },
  );
  assert.equal(await readFile(resourcePath, "utf8"), "// user resource edit\n");
  assert.equal(await readFile(pagePath, "utf8"), "// user page edit\n");
  assert.match(
    forcedDryRun.stdout,
    /Would overwrite src\/switchboard\/generated\/UserResource\.ts/,
  );
  assert.match(
    forcedDryRun.stdout,
    /Would overwrite src\/app\/admin\/users\/page\.tsx/,
  );

  const forcedRun = await execFileAsync(
    process.execPath,
    [cliPath, "generate", "--pages", "--force"],
    { cwd: projectRoot },
  );
  assert.match(
    await readFile(resourcePath, "utf8"),
    /Generated by Switchboard\. You may edit this file\./,
  );
  assert.match(
    await readFile(pagePath, "utf8"),
    /Generated by Switchboard\. You may edit this file\./,
  );
  assert.match(
    forcedRun.stdout,
    /Overwrote src\/switchboard\/generated\/UserResource\.ts/,
  );
  assert.match(forcedRun.stdout, /Overwrote src\/app\/admin\/users\/page\.tsx/);
});

test("generate updates a recognized registry but protects an ambiguous one", async () => {
  const projectRoot = await createFixtureProject();
  const registryPath = path.join(
    projectRoot,
    "src",
    "switchboard",
    "registry.ts",
  );
  await mkdir(path.dirname(registryPath), { recursive: true });
  await writeFile(
    registryPath,
    'import type { ResourceConfig } from "@/switchboard/types";\n\nexport const resources: ResourceConfig[] = [];\n',
    "utf8",
  );

  const generatedRun = await execFileAsync(
    process.execPath,
    [cliPath, "generate"],
    { cwd: projectRoot },
  );
  assert.match(generatedRun.stdout, /Updated src\/switchboard\/registry\.ts/);
  assert.match(
    await readFile(registryPath, "utf8"),
    /Generated by Switchboard\. This registry is updated by switchboard generate\./,
  );

  await writeFile(registryPath, "// custom registry\n", "utf8");
  const protectedRun = await execFileAsync(
    process.execPath,
    [cliPath, "generate"],
    { cwd: projectRoot },
  );
  assert.equal(await readFile(registryPath, "utf8"), "// custom registry\n");
  assert.match(
    protectedRun.stdout,
    /Skipped src\/switchboard\/registry\.ts because it already exists; use --force to overwrite/,
  );
});

test("generate protects custom admin shell files unless forced", async () => {
  const projectRoot = await createFixtureProject();
  const adminRoot = path.join(projectRoot, "src", "app", "admin");
  const layoutPath = path.join(adminRoot, "layout.tsx");
  const indexPath = path.join(adminRoot, "page.tsx");
  await mkdir(adminRoot, { recursive: true });
  await writeFile(layoutPath, "// custom admin layout\n", "utf8");
  await writeFile(indexPath, "// custom admin index\n", "utf8");

  const protectedRun = await execFileAsync(
    process.execPath,
    [cliPath, "generate", "--pages"],
    { cwd: projectRoot },
  );
  assert.equal(await readFile(layoutPath, "utf8"), "// custom admin layout\n");
  assert.equal(await readFile(indexPath, "utf8"), "// custom admin index\n");
  assert.match(
    protectedRun.stdout,
    /Skipped src\/app\/admin\/layout\.tsx because it already exists; use --force to overwrite/,
  );
  assert.match(
    protectedRun.stdout,
    /Skipped src\/app\/admin\/page\.tsx because it already exists; use --force to overwrite/,
  );

  const forcedRun = await execFileAsync(
    process.execPath,
    [cliPath, "generate", "--pages", "--force"],
    { cwd: projectRoot },
  );
  assert.match(
    await readFile(layoutPath, "utf8"),
    /Generated by Switchboard\. You may edit this file\./,
  );
  assert.match(
    await readFile(indexPath, "utf8"),
    /Generated by Switchboard\. You may edit this file\./,
  );
  assert.match(forcedRun.stdout, /Overwrote src\/app\/admin\/layout\.tsx/);
  assert.match(forcedRun.stdout, /Overwrote src\/app\/admin\/page\.tsx/);
});

test("generate does not create environment or database files", async () => {
  const projectRoot = await createFixtureProject();
  await generateProject({ projectRoot, pages: true });

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
