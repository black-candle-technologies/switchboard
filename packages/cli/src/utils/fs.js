import path from "path";
import prettier from "prettier";

export async function formatTypeScript(text) {
  try {
    return await prettier.format(text, { parser: "typescript" });
  } catch {
    return text;
  }
}

export function relativePath(root, targetPath) {
  return path.relative(root, targetPath).split(path.sep).join("/");
}
