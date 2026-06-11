import fs from "fs-extra";
import path from "path";

import { relativePath } from "../utils/fs.js";

function parseJsonConfig(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
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

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function detectAppDir(root, appDir) {
  if (appDir) {
    const resolved = path.resolve(root, appDir);
    if (!isInside(root, resolved)) {
      throw new Error(
        `Invalid --app-dir "${appDir}": the directory must be inside the project root.`,
      );
    }
    if (!fs.pathExistsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(
        `Invalid --app-dir "${appDir}": no directory exists at "${resolved}".`,
      );
    }
    return resolved;
  }

  const candidates = [path.join(root, "src", "app"), path.join(root, "app")];
  const detected = candidates.find(
    (candidate) =>
      fs.pathExistsSync(candidate) && fs.statSync(candidate).isDirectory(),
  );
  if (!detected) {
    throw new Error(
      "No Next.js App Router directory found. Expected src/app or app. " +
        "Create one or pass --app-dir <path>.",
    );
  }
  return detected;
}

function detectSchemaPath(root, schemaPath) {
  if (schemaPath) {
    const resolved = path.resolve(root, schemaPath);
    if (!fs.pathExistsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error(
        `Invalid --schema "${schemaPath}": no Prisma schema file exists at "${resolved}".`,
      );
    }
    return resolved;
  }

  const candidates = [
    path.join(root, "src", "prisma", "schema.prisma"),
    path.join(root, "prisma", "schema.prisma"),
  ];
  const detected = candidates.find(
    (candidate) =>
      fs.pathExistsSync(candidate) && fs.statSync(candidate).isFile(),
  );
  if (!detected) {
    throw new Error(
      "No Prisma schema found. Expected src/prisma/schema.prisma or " +
        "prisma/schema.prisma. Create one or pass --schema <path>.",
    );
  }
  return detected;
}

function detectImportAlias(root, sourceRoot) {
  const configPaths = ["tsconfig.json", "jsconfig.json"]
    .map((name) => path.join(root, name))
    .filter((candidate) => fs.pathExistsSync(candidate));
  if (configPaths.length === 0) {
    return { configPath: undefined, importAlias: undefined };
  }

  for (const configPath of configPaths) {
    const config = readJson(configPath);
    const aliases = config.compilerOptions?.paths?.["@/*"];
    const baseUrl = path.resolve(
      path.dirname(configPath),
      config.compilerOptions?.baseUrl ?? ".",
    );
    const aliasTarget = Array.isArray(aliases)
      ? aliases.find((value) => {
          const aliasRoot = value.replace(/[\\/]\*$/, "").replace(/\*$/, "");
          return path.resolve(baseUrl, aliasRoot) === sourceRoot;
        })
      : undefined;
    if (aliasTarget) {
      return {
        configPath,
        importAlias: {
          pattern: "@/*",
          target: aliasTarget,
          prefix: "@",
        },
      };
    }
  }

  return { configPath: configPaths[0], importAlias: undefined };
}

export function detectProjectLayout({
  projectRoot = process.cwd(),
  schemaPath,
  appDir,
} = {}) {
  const root = path.resolve(projectRoot);
  const detectedAppDir = detectAppDir(root, appDir);
  const detectedSchemaPath = detectSchemaPath(root, schemaPath);
  const srcRoot = path.join(root, "src");
  const srcBased = isInside(srcRoot, detectedAppDir);
  const sourceRoot = srcBased ? srcRoot : root;
  const { configPath, importAlias } = detectImportAlias(root, sourceRoot);

  return {
    projectRoot: root,
    appDir: detectedAppDir,
    schemaPath: detectedSchemaPath,
    sourceRoot,
    srcBased,
    configPath,
    importAlias,
    hasImportAlias: Boolean(importAlias),
    libDir: path.join(sourceRoot, "lib"),
    switchboardDir: path.join(sourceRoot, "switchboard"),
    componentsDir: path.join(sourceRoot, "components"),
  };
}

export function detectGenerationLayout(options = {}) {
  const layout = detectProjectLayout(options);
  const outOption =
    options.out ??
    path.relative(
      layout.projectRoot,
      path.join(layout.sourceRoot, "switchboard"),
    );
  const outDir = path.resolve(layout.projectRoot, outOption);

  if (!isInside(layout.sourceRoot, outDir) || outDir === layout.sourceRoot) {
    throw new Error(
      `Unsupported output path "${outOption}". --out must point inside ` +
        `"${relativePath(layout.projectRoot, layout.sourceRoot) || "."}".`,
    );
  }

  return {
    ...layout,
    outDir,
    generatedDir: path.join(outDir, "generated"),
  };
}
