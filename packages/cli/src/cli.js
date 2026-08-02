import { readFileSync } from "node:fs";

import { Command } from "commander";

import { registerAuthCommand } from "./commands/auth.js";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerInitCommand } from "./commands/init.js";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

export function createCli() {
  const program = new Command()
    .name("switchboard")
    .description("CLI for generating Switchboard admin resources and pages")
    .version(version);

  registerInitCommand(program);
  registerGenerateCommand(program);
  registerAuthCommand(program);

  return program;
}

export async function runCli(argv = process.argv) {
  await createCli().parseAsync(argv);
}
