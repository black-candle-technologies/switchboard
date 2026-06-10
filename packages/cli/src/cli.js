import { Command } from "commander";

import { registerAuthCommand } from "./commands/auth.js";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerInitCommand } from "./commands/init.js";

export function createCli() {
  const program = new Command()
    .name("switchboard")
    .description("CLI for generating Switchboard admin resources and pages")
    .version("0.4.2");

  registerInitCommand(program);
  registerGenerateCommand(program);
  registerAuthCommand(program);

  return program;
}

export async function runCli(argv = process.argv) {
  await createCli().parseAsync(argv);
}
