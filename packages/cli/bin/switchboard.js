#!/usr/bin/env node
import chalk from "chalk";

import { runCli } from "../src/cli.js";

try {
  await runCli();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`Error: ${message}`));
  process.exitCode = 1;
}
