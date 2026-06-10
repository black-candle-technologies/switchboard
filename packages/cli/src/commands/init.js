import fs from "fs-extra";
import chalk from "chalk";

import { supportFiles } from "../../templates/supportFiles.js";
import { detectProjectLayout } from "../project/detectProject.js";
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
  const results = [];

  for (const file of supportFiles(layout)) {
    const exists = await fs.pathExists(file.path);
    const action = exists ? (force ? "overwrite" : "skip") : "create";
    const displayPath = relativePath(layout.projectRoot, file.path);
    results.push({ action, path: displayPath });

    if (!dryRun && action !== "skip") {
      await fs.outputFile(
        file.path,
        await formatTypeScript(file.content),
        "utf8",
      );
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
