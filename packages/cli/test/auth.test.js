import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { hashPassword, verifyPassword } from "../src/auth/password.js";
import { analyzeAuthSchema } from "../src/auth/schema.js";
import { seedAdmin } from "../src/commands/auth.js";
import { parsePrismaSchema } from "../src/parser/prismaSchemaParser.js";

const tempProjects = [];
const authSchema = `
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "sqlite"
    url = env("DATABASE_URL")
  }

  enum Role {
    ADMIN
    USER
  }

  model User {
    id           String @id @default(cuid())
    name         String
    username     String @unique
    email        String @unique
    passwordHash String
    role         Role @default(USER)
  }
`;

afterEach(async () => {
  await Promise.all(
    tempProjects.splice(0).map((projectRoot) =>
      rm(projectRoot, { recursive: true, force: true }),
    ),
  );
});

async function createProject(schema = authSchema) {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "switchboard-auth-"));
  tempProjects.push(projectRoot);
  await mkdir(path.join(projectRoot, "src", "app"), { recursive: true });
  await mkdir(path.join(projectRoot, "src", "prisma"), { recursive: true });
  await writeFile(
    path.join(projectRoot, "src", "prisma", "schema.prisma"),
    schema,
    "utf8",
  );
  return projectRoot;
}

test("password hashing uses a salted scrypt hash", async () => {
  const first = await hashPassword("password");
  const second = await hashPassword("password");

  assert.notEqual(first, second);
  assert.doesNotMatch(first, /password/);
  assert.match(first, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword("password", first), true);
  assert.equal(await verifyPassword("wrong", first), false);
});

test("auth schema validation rejects missing fields and non-admin roles", () => {
  const parsed = parsePrismaSchema(
    `
      enum Role { USER }
      model User {
        id String @id
        email String
        role Role
      }
    `,
    "schema.prisma",
  );

  assert.throws(
    () => analyzeAuthSchema(parsed, "schema.prisma"),
    /unique String username or email/,
  );
  assert.throws(
    () => analyzeAuthSchema(parsed, "schema.prisma"),
    /passwordHash String/,
  );
  assert.throws(
    () => analyzeAuthSchema(parsed, "schema.prisma"),
    /includes the value `ADMIN`/,
  );
});

test("seed-admin creates an ADMIN with a hash and supports dry-run", async () => {
  const projectRoot = await createProject();
  const calls = [];
  const prismaClient = {
    user: {
      findUnique: async () => null,
      create: async (args) => calls.push(["create", args]),
      update: async (args) => calls.push(["update", args]),
    },
  };
  const output = [];

  const dryRun = await seedAdmin({
    projectRoot,
    dryRun: true,
    prismaClient,
    log: (message) => output.push(message),
  });
  assert.equal(dryRun.action, "create");
  assert.equal(calls.length, 0);
  assert.match(output.join("\n"), /default admin password/i);

  const result = await seedAdmin({
    projectRoot,
    prismaClient,
    log: () => {},
  });
  assert.equal(result.action, "create");
  assert.equal(calls.length, 1);
  const data = calls[0][1].data;
  assert.equal(data.username, "admin");
  assert.equal(data.email, "admin@localhost.invalid");
  assert.equal(data.role, "ADMIN");
  assert.doesNotMatch(data.passwordHash, /password/);
  assert.equal(await verifyPassword("password", data.passwordHash), true);
});

test("seed-admin uses a valid local address for email-only schemas", async () => {
  const projectRoot = await createProject(`
    enum Role {
      ADMIN
      USER
    }

    model User {
      id           String @id @default(cuid())
      email        String @unique
      passwordHash String
      role         Role
    }
  `);
  const calls = [];
  const prismaClient = {
    user: {
      findUnique: async (args) => {
        calls.push(["findUnique", args]);
        return null;
      },
      create: async (args) => calls.push(["create", args]),
      update: async () => {},
    },
  };

  const result = await seedAdmin({
    projectRoot,
    prismaClient,
    log: () => {},
  });

  assert.equal(result.username, "admin@localhost.invalid");
  assert.equal(
    calls[0][1].where.email,
    "admin@localhost.invalid",
  );
  assert.equal(calls[1][1].data.email, "admin@localhost.invalid");
});

test("generated auth rejects non-admin roles and protects all admin routes", async () => {
  const projectRoot = await createProject();
  const logs = [];
  const { initProject } = await import("../src/commands/init.js");
  await initProject({ projectRoot, log: (message) => logs.push(message) });

  const actions = await readFile(
    path.join(projectRoot, "src", "switchboard", "auth-actions.ts"),
    "utf8",
  );
  const middleware = await readFile(
    path.join(projectRoot, "src", "middleware.ts"),
    "utf8",
  );

  assert.match(actions, /String\(user\.role\) !== "ADMIN"/);
  assert.match(actions, /verifyPassword/);
  assert.match(middleware, /matcher: \["\/admin\/:path\*"\]/);
  assert.match(middleware, /payload\.role === "ADMIN"/);
  assert.match(logs.join("\n"), /default admin\/password is insecure/i);
});

test("documentation warns about the insecure default credentials", async () => {
  const rootReadme = await readFile(
    path.join(process.cwd(), "README.md"),
    "utf8",
  );
  const cliReadme = await readFile(
    path.join(process.cwd(), "packages", "cli", "README.md"),
    "utf8",
  );
  const exampleReadme = await readFile(
    path.join(
      process.cwd(),
      "examples",
      "basic-next-prisma",
      "README.md",
    ),
    "utf8",
  );

  for (const contents of [rootReadme, cliReadme, exampleReadme]) {
    assert.match(contents, /admin/);
    assert.match(contents, /password/);
    assert.match(contents, /before\s+production/i);
  }
});
