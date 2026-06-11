import path from "path";

function withoutSourceExtension(filePath) {
  return filePath.replace(/\.(?:[cm]?[jt]sx?)$/, "");
}

function toImportSpecifier(filePath) {
  return filePath.split(path.sep).join("/");
}

export function importPath(layout, fromFile, targetFile) {
  if (layout.importAlias) {
    const aliasRelative = path.relative(
      layout.sourceRoot,
      withoutSourceExtension(targetFile),
    );
    if (
      aliasRelative !== ".." &&
      !aliasRelative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(aliasRelative)
    ) {
      return `${layout.importAlias.prefix}/${toImportSpecifier(aliasRelative)}`;
    }
  }

  const relative = toImportSpecifier(
    path.relative(
      path.dirname(fromFile),
      withoutSourceExtension(targetFile),
    ),
  );
  return relative.startsWith(".") ? relative : `./${relative}`;
}
