import fs from "fs-extra";
import path from "path";

import { relativePath } from "../utils/fs.js";

function parseJsonConfig(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        output += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (!inString && char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (!inString && char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    output += char;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    }
  }

  return JSON.parse(output.replace(/,\s*([}\]])/g, "$1"));
}

function readJson(filePath) {
  try {
    return parseJsonConfig(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read "${filePath}" as JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function detectProjectLayout({
  projectRoot = process.cwd(),
  schemaPath,
  appDir,
} = {}) {
  const root = path.resolve(projectRoot);
  const detectedAppDir = appDir
    ? path.resolve(root, appDir)
    : fs.pathExistsSync(path.join(root, "src", "app"))
      ? path.join(root, "src", "app")
      : fs.pathExistsSync(path.join(root, "app"))
        ? path.join(root, "app")
        : undefined;

  if (!detectedAppDir || !fs.pathExistsSync(detectedAppDir)) {
    throw new Error(
      "No compatible Next.js App Router directory found. " +
        'Expected "src/app" or "app", or pass --app-dir <path>.',
    );
  }
  const relativeAppDir = path.relative(root, detectedAppDir);
  if (
    relativeAppDir === ".." ||
    relativeAppDir.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeAppDir)
  ) {
    throw new Error("--app-dir must point to a directory inside the project.");
  }

  const srcBased =
    detectedAppDir === path.join(root, "src", "app") ||
    detectedAppDir.startsWith(`${path.join(root, "src")}${path.sep}`);
  const sourceRoot = srcBased ? path.join(root, "src") : root;
  const detectedSchemaPath = schemaPath
    ? path.resolve(root, schemaPath)
    : fs.pathExistsSync(path.join(root, "src", "prisma", "schema.prisma"))
      ? path.join(root, "src", "prisma", "schema.prisma")
      : fs.pathExistsSync(path.join(root, "prisma", "schema.prisma"))
        ? path.join(root, "prisma", "schema.prisma")
        : undefined;

  if (!detectedSchemaPath || !fs.pathExistsSync(detectedSchemaPath)) {
    throw new Error(
      "No Prisma schema found. Expected src/prisma/schema.prisma or " +
        "prisma/schema.prisma, or pass --schema <path>.",
    );
  }

  const configPath = ["tsconfig.json", "jsconfig.json"]
    .map((name) => path.join(root, name))
    .find((candidate) => fs.pathExistsSync(candidate));

  if (!configPath) {
    throw new Error(
      'No tsconfig.json or jsconfig.json found. Switchboard requires an "@/*" path alias.',
    );
  }

  const config = readJson(configPath);
  const aliases = config.compilerOptions?.paths?.["@/*"];
  const baseUrl = path.resolve(
    path.dirname(configPath),
    config.compilerOptions?.baseUrl ?? ".",
  );
  const hasAlias =
    Array.isArray(aliases) &&
    aliases.some((value) => {
      const aliasRoot = value.replace(/[\\/]\*$/, "").replace(/\*$/, "");
      return path.resolve(baseUrl, aliasRoot) === sourceRoot;
    });

  if (!hasAlias) {
    const expectedAlias = srcBased ? "./src/*" : "./*";
    throw new Error(
      `Unsupported path alias in "${relativePath(root, configPath)}". ` +
        `Set compilerOptions.paths["@/*"] to ["${expectedAlias}"].`,
    );
  }

  return {
    projectRoot: root,
    appDir: detectedAppDir,
    schemaPath: detectedSchemaPath,
    sourceRoot,
    srcBased,
    configPath,
    libDir: path.join(sourceRoot, "lib"),
    switchboardDir: path.join(sourceRoot, "switchboard"),
    componentsDir: path.join(sourceRoot, "components"),
  };
}

export function detectGenerationLayout({
  projectRoot = process.cwd(),
  schemaPath,
  appDir,
  out,
} = {}) {
  const root = path.resolve(projectRoot);
  const srcAppDir = path.join(root, "src", "app");
  const rootAppDir = path.join(root, "app");
  const detectedAppDir = appDir
    ? path.resolve(root, appDir)
    : fs.pathExistsSync(srcAppDir)
      ? srcAppDir
      : fs.pathExistsSync(rootAppDir)
        ? rootAppDir
        : undefined;

  if (!detectedAppDir) {
    throw new Error(
      "Unsupported project structure: expected a Next.js App Router directory at src/app or app.",
    );
  }
  if (
    !fs.pathExistsSync(detectedAppDir) ||
    !fs.statSync(detectedAppDir).isDirectory()
  ) {
    throw new Error(
      `Next.js App Router directory not found at "${detectedAppDir}".`,
    );
  }

  const relativeAppDir = path.relative(root, detectedAppDir);
  if (
    relativeAppDir === ".." ||
    relativeAppDir.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeAppDir)
  ) {
    throw new Error("--app-dir must point to a directory inside the project.");
  }

  const srcRoot = path.join(root, "src");
  const relativeToSrc = path.relative(srcRoot, detectedAppDir);
  const sourceRoot =
    relativeToSrc !== ".." &&
    !relativeToSrc.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeToSrc)
      ? srcRoot
      : root;
  const defaultSchemaPath = fs.pathExistsSync(
    path.join(root, "src", "prisma", "schema.prisma"),
  )
    ? path.join("src", "prisma", "schema.prisma")
    : path.join("prisma", "schema.prisma");
  const detectedSchemaPath = path.resolve(
    root,
    schemaPath ?? defaultSchemaPath,
  );
  const outOption =
    out ?? path.relative(root, path.join(sourceRoot, "switchboard"));
  const outDir = path.resolve(root, outOption);
  const relativeOutDir = path.relative(sourceRoot, outDir);

  if (!fs.existsSync(detectedSchemaPath)) {
    throw new Error(
      `Prisma schema not found at "${detectedSchemaPath}". ` +
        "Pass --schema <path> relative to the project root if it is elsewhere.",
    );
  }
  if (
    relativeOutDir === "" ||
    relativeOutDir === ".." ||
    relativeOutDir.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeOutDir)
  ) {
    throw new Error(
      `Unsupported output path "${outOption}". --out must point inside ` +
        `"${path.relative(root, sourceRoot) || "."}" ` +
        "so generated @/ imports remain valid.",
    );
  }

  return {
    projectRoot: root,
    appDir: detectedAppDir,
    schemaPath: detectedSchemaPath,
    sourceRoot,
    outDir,
    outImportPath: relativeOutDir.split(path.sep).join("/"),
    generatedDir: path.join(outDir, "generated"),
  };
}
