import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createCli } from "../src/cli.js";
import { supportFiles } from "../templates/supportFiles.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(testDir, "..");
const cliPath = path.join(packageRoot, "bin", "switchboard.js");
const execFileAsync = promisify(execFile);

test("CLI entrypoint remains executable and exposes existing commands", async () => {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "--help"]);

  assert.match(stdout, /Usage: switchboard/);
  assert.match(stdout, /\binit\b/);
  assert.match(stdout, /\bgenerate\b/);

  const commandNames = createCli().commands.map((command) => command.name());
  assert.deepEqual(commandNames, ["init", "generate", "auth"]);
});

test("support templates resolve from the package template directory", async () => {
  await access(path.join(packageRoot, "templates", "supportFiles.js"));

  const files = supportFiles({
    libDir: "lib",
    switchboardDir: "switchboard",
    componentsDir: "components",
    appDir: "app",
    sourceRoot: ".",
  }, {
    clientProperty: "user",
    credentialField: "username",
    passwordField: "passwordHash",
    roleField: "role",
    idField: "id",
  });

  assert.ok(files.some((file) => file.path.endsWith("prisma.ts")));
  assert.ok(files.some((file) => file.path.endsWith("switchboard.css")));
  assert.ok(files.some((file) => file.path.endsWith("SmartForm.tsx")));
  assert.ok(files.some((file) => file.path.endsWith("auth.ts")));
  assert.ok(files.some((file) => file.path.endsWith("middleware.ts")));
});

test("package metadata is ready for the public beta", async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  );

  assert.equal(packageJson.name, "@lanebucher/switchboard");
  assert.equal(packageJson.version, "0.6.0-beta.1");
  assert.equal(
    packageJson.description,
    "Generate Prisma-backed admin resources and Next.js App Router pages.",
  );
  assert.equal(packageJson.bin.switchboard, "bin/switchboard.js");
  assert.equal(
    packageJson.repository.url,
    "git+https://github.com/black-candle-technologies/switchboard.git",
  );
  assert.equal(packageJson.license, "MIT");
  assert.deepEqual(packageJson.files, [
    "bin/",
    "src/",
    "templates/",
    "README.md",
    "LICENSE",
  ]);
  assert.ok(packageJson.keywords.includes("nextjs"));
  assert.ok(packageJson.keywords.includes("prisma"));
});
