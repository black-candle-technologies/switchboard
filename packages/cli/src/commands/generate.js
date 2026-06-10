import { generateProject } from "../generator/generateProject.js";

export function registerGenerateCommand(program) {
  program
    .command("generate")
    .description(
      "Generate Switchboard resource configs and/or Next.js admin pages",
    )
    .option("-m, --model <modelName>", "Generate a specific model only")
    .option(
      "--schema <path>",
      "Prisma schema path (defaults to src/prisma/schema.prisma, then prisma/schema.prisma)",
    )
    .option(
      "--out <path>",
      "Switchboard output directory (defaults to src/switchboard or switchboard)",
    )
    .option("--app-dir <path>", "Custom Next.js App Router directory")
    .option("--pages", "Also generate Next.js pages for each resource")
    .action(async (options) => {
      await generateProject({
        projectRoot: process.cwd(),
        model: options.model,
        pages: options.pages,
        schemaPath: options.schema,
        out: options.out,
        appDir: options.appDir,
      });
    });
}
