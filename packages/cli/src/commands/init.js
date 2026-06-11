import chalk from "chalk";

import { supportFiles } from "../../templates/supportFiles.js";
import { loadAuthSchema } from "../auth/schema.js";
import { detectProjectLayout } from "../project/detectProject.js";
import {
  applyFileAction,
  describeFileAction,
  planFileAction,
} from "../utils/fileActions.js";
import { formatTypeScript, relativePath } from "../utils/fs.js";

export async function initProject({
  projectRoot = process.cwd(),
  schemaPath,
  appDir,
  force = false,
  dryRun = false,
  log = console.log,
} = {}) {
  const layout = detectProjectLayout({ projectRoot, schemaPath, appDir });
  const auth = await loadAuthSchema(layout.schemaPath);
  const results = [];

  if (dryRun) {
    log("Detected project structure:");
    log(`  App directory: ${relativePath(layout.projectRoot, layout.appDir)}`);
    log(`  Prisma schema: ${relativePath(layout.projectRoot, layout.schemaPath)}`);
    log(
      `  Source root: ${relativePath(layout.projectRoot, layout.sourceRoot) || "."}`,
    );
    log(
      layout.importAlias
        ? `  Import alias: ${layout.importAlias.pattern} -> ${layout.importAlias.target}`
        : "  Import alias: none (using relative imports)",
    );
    log(
      `  Admin auth: User.${auth.credentialField} + User.${auth.passwordField} + User.${auth.roleField}`,
    );
  }

  const plannedFiles = [];
  for (const file of supportFiles(layout, auth)) {
    const content = await formatTypeScript(file.content);
    const plan = await planFileAction({
      path: file.path,
      content,
      force,
    });
    const displayPath = relativePath(layout.projectRoot, file.path);
    results.push({ action: plan.action, path: displayPath });
    plannedFiles.push({ file, plan, displayPath });
  }

  const blockedProtection = plannedFiles.find(
    ({ file, plan }) => file.securityCritical && plan.action === "skip",
  );
  if (blockedProtection) {
    throw new Error(
      `Cannot safely protect /admin because "${blockedProtection.displayPath}" already exists. ` +
        "Integrate the generated Switchboard admin guard into that middleware, " +
        "or re-run init with --force to replace it.",
    );
  }

  for (const { plan, displayPath } of plannedFiles) {
    await applyFileAction(plan, { dryRun });
    log(describeFileAction(plan, displayPath, { dryRun }));
  }

  log(
    "Required: set SWITCHBOARD_SESSION_SECRET to a random value of at least 32 characters.",
  );
  log(
    "Bootstrap local admin: npx switchboard auth seed-admin " +
      "(default admin/password is insecure; change it before production).",
  );
  log("Next: run npx switchboard generate --pages");
  return { layout, auth, results };
}

export function registerInitCommand(program) {
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
}
