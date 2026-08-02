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

  const { stdout: versionOutput } = await execFileAsync(process.execPath, [
    cliPath,
    "--version",
  ]);
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  );
  assert.equal(versionOutput.trim(), packageJson.version);
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
  assert.equal(packageJson.version, "0.6.0-beta.2");
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
  assert.deepEqual(packageJson.publishConfig, {
    access: "public",
    tag: "beta",
  });
  assert.equal(packageJson.engines.node, ">=20.9.0");
  assert.ok(packageJson.keywords.includes("nextjs"));
  assert.ok(packageJson.keywords.includes("prisma"));

  const npmCommand = process.env.npm_execpath ? process.execPath : "npm";
  const npmArguments = process.env.npm_execpath
    ? [
        process.env.npm_execpath,
        "pack",
        "--dry-run",
        "--ignore-scripts",
        "--json",
      ]
    : ["pack", "--dry-run", "--ignore-scripts", "--json"];
  const { stdout } = await execFileAsync(
    npmCommand,
    npmArguments,
    { cwd: packageRoot },
  );
  const [packResult] = JSON.parse(stdout);
  const packedPaths = packResult.files
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right));
  const expectedPaths = [
    "LICENSE",
    "README.md",
    "bin/switchboard.js",
    "package.json",
    "src/auth/password.js",
    "src/auth/schema.js",
    "src/cli.js",
    "src/commands/auth.js",
    "src/commands/generate.js",
    "src/commands/init.js",
    "src/generator/generateProject.js",
    "src/generator/runtimeTemplates.js",
    "src/parser/prismaSchemaParser.js",
    "src/project/detectProject.js",
    "src/project/importPath.js",
    "src/utils/fileActions.js",
    "src/utils/fs.js",
    "templates/adminLayout.js",
    "templates/authFiles.js",
    "templates/supportFiles.js",
  ].sort((left, right) => left.localeCompare(right));
  assert.deepEqual(packedPaths, expectedPaths);
});
