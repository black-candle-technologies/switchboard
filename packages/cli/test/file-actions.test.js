import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  GENERATED_FILE_MARKER,
  planFileAction,
} from "../src/utils/fileActions.js";

const tempDirectories = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

test("file planning classifies create, unchanged, skip, overwrite, and update", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "switchboard-plan-"));
  tempDirectories.push(directory);
  const target = path.join(directory, "target.ts");

  assert.equal(
    (await planFileAction({ path: target, content: "next\n" })).action,
    "create",
  );

  await writeFile(target, "same\n", "utf8");
  assert.equal(
    (await planFileAction({ path: target, content: "same\n" })).action,
    "unchanged",
  );
  assert.equal(
    (await planFileAction({ path: target, content: "next\n" })).action,
    "skip",
  );
  assert.equal(
    (
      await planFileAction({
        path: target,
        content: "next\n",
        force: true,
      })
    ).action,
    "overwrite",
  );

  await writeFile(target, `// ${GENERATED_FILE_MARKER}\nold\n`, "utf8");
  assert.equal(
    (
      await planFileAction({
        path: target,
        content: `// ${GENERATED_FILE_MARKER}\nnext\n`,
        allowUpdate: true,
      })
    ).action,
    "update",
  );
});

test("file planning reports an error when the target is a directory", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "switchboard-plan-"));
  tempDirectories.push(directory);
  const target = path.join(directory, "target.ts");
  await mkdir(target);

  const plan = await planFileAction({ path: target, content: "next\n" });

  assert.equal(plan.action, "error");
  assert.match(plan.reason, /not a file/);
});
