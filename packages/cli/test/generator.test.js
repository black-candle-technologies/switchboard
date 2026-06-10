import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateProject } from "../bin/switchboard.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureSchema = path.join(
  testDir,
  "fixtures",
  "basic",
  "schema.prisma",
);
const tempProjects = [];

afterEach(async () => {
  await Promise.all(
    tempProjects.splice(0).map((projectRoot) =>
      rm(projectRoot, { recursive: true, force: true }),
    ),
  );
});

async function generateFixture() {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "switchboard-generator-"),
  );
  tempProjects.push(projectRoot);

  const prismaDir = path.join(projectRoot, "src", "prisma");
  await mkdir(prismaDir, { recursive: true });
  await copyFile(fixtureSchema, path.join(prismaDir, "schema.prisma"));
  await generateProject({ projectRoot, pages: true });

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
