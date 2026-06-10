import { spawnSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const exampleDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(exampleDir, ".env");

if (!existsSync(envPath)) {
  copyFileSync(join(exampleDir, ".env.example"), envPath);
}

const databasePath = join(exampleDir, "src", "prisma", "dev.db");
if (!existsSync(databasePath)) {
  closeSync(openSync(databasePath, "w"));
}

const isWindows = process.platform === "win32";
const commands = [
  ["install"],
  ["run", "prisma:migrate"],
  ["run", "switchboard:init"],
  ["run", "switchboard:generate"],
  ["run", "switchboard:seed-admin"],
  ["run", "build"],
];

for (const args of commands) {
  const executable = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const commandArgs = isWindows
    ? ["/d", "/s", "/c", ["npm", ...args].join(" ")]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: exampleDir,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
