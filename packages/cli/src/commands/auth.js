import { createRequire } from "node:module";
import path from "node:path";

import chalk from "chalk";

import { hashPassword } from "../auth/password.js";
import { loadAuthSchema } from "../auth/schema.js";
import { detectProjectLayout } from "../project/detectProject.js";
import { relativePath } from "../utils/fs.js";

export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "password";

function loadProjectPrismaClient(projectRoot) {
  const require = createRequire(path.join(projectRoot, "package.json"));
  let PrismaClient;
  try {
    ({ PrismaClient } = require("@prisma/client"));
  } catch (error) {
    throw new Error(
      `Could not load @prisma/client from "${projectRoot}". ` +
        "Install dependencies and run prisma generate before seeding an admin. " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  return new PrismaClient();
}

export async function seedAdmin({
  projectRoot = process.cwd(),
  schemaPath,
  appDir,
  username = DEFAULT_ADMIN_USERNAME,
  password = DEFAULT_ADMIN_PASSWORD,
  dryRun = false,
  log = console.log,
  prismaClient,
} = {}) {
  if (!username.trim()) {
    throw new Error("--admin-username must not be empty.");
  }
  if (!password) {
    throw new Error("--admin-password must not be empty.");
  }

  const layout = detectProjectLayout({ projectRoot, schemaPath, appDir });
  const auth = await loadAuthSchema(layout.schemaPath);
  if (auth.unsupportedRequiredFields.length > 0) {
    throw new Error(
      "Cannot bootstrap a User because the model has additional required fields " +
        `without defaults: ${auth.unsupportedRequiredFields.join(", ")}. ` +
      "Give those fields Prisma defaults or create the admin with your own seed script.",
    );
  }
  const credential =
    auth.credentialField === "email" && !username.includes("@")
      ? `${username}@localhost.invalid`
      : username;

  const prisma = prismaClient ?? loadProjectPrismaClient(layout.projectRoot);
  const ownsClient = !prismaClient;
  try {
    const existing = await prisma[auth.clientProperty].findUnique({
      where: { [auth.credentialField]: credential },
      select: { [auth.idField]: true },
    });
    const action = existing ? "update" : "create";

    log(`Prisma schema: ${relativePath(layout.projectRoot, layout.schemaPath)}`);
    const actionLabel = `${dryRun ? "Would " : ""}${action} admin user "${credential}"`;
    log(`${actionLabel[0].toUpperCase()}${actionLabel.slice(1)}${dryRun ? "" : "."}`);
    log(
      "WARNING: The default admin password is for local development only. " +
        "Change it before production.",
    );

    if (dryRun) {
      return { action, username: credential, auth };
    }

    const passwordHash = await hashPassword(password);
    const authData = {
      [auth.credentialField]: credential,
      [auth.passwordField]: passwordHash,
      [auth.roleField]: "ADMIN",
      ...(auth.nameField ? { [auth.nameField]: username } : {}),
      ...(auth.usernameField && auth.usernameField !== auth.credentialField
        ? { [auth.usernameField]: username }
        : {}),
      ...(auth.emailField && auth.emailField !== auth.credentialField
        ? { [auth.emailField]: `${username}@localhost.invalid` }
        : {}),
    };

    if (existing) {
      await prisma[auth.clientProperty].update({
        where: { [auth.credentialField]: credential },
        data: {
          [auth.passwordField]: passwordHash,
          [auth.roleField]: "ADMIN",
        },
      });
    } else {
      await prisma[auth.clientProperty].create({ data: authData });
    }

    log(`Admin user "${credential}" is ready.`);
    return { action, username: credential, auth, passwordHash };
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}

export function registerAuthCommand(program) {
  const auth = program
    .command("auth")
    .description("Manage Switchboard admin authentication");

  auth
    .command("seed-admin")
    .description("Create or reset a local development admin user")
    .option("--schema <path>", "Prisma schema path relative to the project root")
    .option("--app-dir <path>", "Next.js App Router directory")
    .option(
      "--admin-username <username>",
      "Admin login username or email",
      DEFAULT_ADMIN_USERNAME,
    )
    .option(
      "--admin-password <password>",
      "Admin password",
      DEFAULT_ADMIN_PASSWORD,
    )
    .option("--dry-run", "Report the bootstrap action without writing")
    .action(async (options) => {
      await seedAdmin({
        projectRoot: process.cwd(),
        schemaPath: options.schema,
        appDir: options.appDir,
        username: options.adminUsername,
        password: options.adminPassword,
        dryRun: options.dryRun,
        log: (message) => console.log(chalk.green(message)),
      });
    });
}
