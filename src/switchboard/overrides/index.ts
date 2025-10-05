// src/switchboard/overrides/index.ts
import type { ResourceConfig } from "@/switchboard/types";

/** Shallow merge for predictable behavior:
 * - replaces `fields` and `list.columns` entirely if provided
 * - merges other top-level keys
 */
export function mergeResource<T>(
  base: ResourceConfig<T>,
  override?: Partial<ResourceConfig<T>>
): ResourceConfig<T> {
  if (!override) return base;

  return {
    ...base,
    displayName: override.displayName ?? base.displayName,
    // Replace fields array if provided
    fields: (override.fields as ResourceConfig<T>["fields"]) ?? base.fields,
    list: {
      ...base.list,
      ...override.list,
      // Replace columns array if provided
      columns:
        (override.list?.columns as NonNullable<ResourceConfig<T>["list"]>["columns"]) ??
        base.list?.columns,
    },
  };
}

/** Put per-resource tweaks here; keys must match the Prisma model name (e.g., "Post"). */
export const overrides = {
  // Example:
  // Post: {
  //   displayName: "Blog Posts",
  //   list: {
  //     perPage: 10,
  //     searchable: ["title", "content"],
  //     columns: [
  //       { key: "title" },
  //       { key: "status" },
  //       { key: "createdAt", format: "datetime" },
  //     ],
  //     defaultSort: { key: "createdAt", dir: "desc" },
  //   },
  // },
} as const;
