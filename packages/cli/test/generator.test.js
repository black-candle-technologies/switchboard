import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { afterEach, test } from "node:test";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { generateProject } from "../bin/switchboard.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(testDir, "..", "bin", "switchboard.js");
const execFileAsync = promisify(execFile);
const tempProjects = [];
const stripAnsi = (value) => value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");

afterEach(async () => {
  await Promise.all(
    tempProjects.splice(0).map((projectRoot) =>
      rm(projectRoot, { recursive: true, force: true }),
    ),
  );
});

async function createFixtureProject(fixtureName = "basic") {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-generator-"),
  );
  tempProjects.push(projectRoot);

  const prismaDir = path.join(projectRoot, "src", "prisma");
  await mkdir(prismaDir, { recursive: true });
  await copyFile(
    path.join(testDir, "fixtures", fixtureName, "schema.prisma"),
    path.join(prismaDir, "schema.prisma"),
  );

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

  assert.match(newPage, /export default function NewUserPage/);
  assert.match(newPage, /async function create\(formData: FormData\)/);
  assert.match(newPage, /Prisma\.UserUncheckedCreateInput/);
  assert.match(newPage, /await prisma\.user\.create\(\{ data \}\)/);
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
  assert.match(editPage, /await prisma\.user\.update/);
  assert.doesNotMatch(editPage, /UserListPage|searchParams|findMany/);
});

test("generates enum fields and related-model routes without a database", async () => {
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

  assert.match(userResource, /"ADMIN"/);
  assert.match(userResource, /"USER"/);
  assert.doesNotMatch(userResource, /name: "posts"/);

  assert.match(postNewPage, /export default function NewPostPage/);
  assert.match(postNewPage, /authorId: String\(formData\.get\("authorId"\)/);
  assert.match(postNewPage, /await prisma\.post\.create\(\{ data \}\)/);
  assert.doesNotMatch(postNewPage, /PostListPage|searchParams|findMany/);
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

  assert.match(accountResource, /name: "slug"/);
  assert.match(accountResource, /name: "nickname"/);
  assert.match(accountResource, /required: false/);
  assert.match(accountResource, /"ACTIVE"/);
  assert.match(accountResource, /"DISABLED"/);
  assert.doesNotMatch(accountResource, /name: "tags"/);
  assert.doesNotMatch(accountResource, /name: "posts"/);
  assert.doesNotMatch(accountResource, /@map|@@map/);

  assert.match(accountListPage, /defaultSortKey = ""/);
  assert.match(accountListPage, /: undefined\)/);
  assert.doesNotMatch(accountListPage, /createdAt/);
  assert.match(accountListPage, /\.slug\)/);
  assert.match(accountListPage, /name="slug"/);

  assert.match(accountNewPage, /slug: String\(formData\.get\("slug"\)/);
  assert.match(
    accountNewPage,
    /externalId: formData\.get\("externalId"\)[\s\S]*: undefined/,
  );
  assert.doesNotMatch(accountNewPage, /formData\.get\("tags"\)/);
  assert.doesNotMatch(accountNewPage, /formData\.get\("posts"\)/);

  assert.match(accountEditPage, /where: \{ slug: id \}/);
  assert.match(accountEditPage, /const id = routeParams\.id/);
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
