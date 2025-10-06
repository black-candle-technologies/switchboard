// src/switchboard/overrides.ts
// Optional per-project overrides for generated resources.
// Safe to keep under version control. Can be empty.

import type { ResourceConfig } from "@/switchboard/types";

/** A partial per-resource patch (shape T is the model’s form shape). */
export type ResourcePatch<T = unknown> = Partial<ResourceConfig<T>>;

/** Safely merge a generated resource with a (possibly undefined) patch. */
export function mergeResource<T>(
  base: ResourceConfig<T>,
  patch?: ResourcePatch<T>
): ResourceConfig<T> {
  const p: ResourcePatch<T> = patch ?? {};
  return {
    ...base,
    ...p,
    fields: p.fields ?? base.fields,
    list: { ...(base.list ?? {}), ...(p.list ?? {}) },
  };
}

/**
 * Put per-model overrides here, e.g.:
 *
 *   import { UserResource } from "@/switchboard/generated/UserResource";
 *   export const overrides = {
 *     User: { displayName: "Team Members", list: { searchable: ["name","email"] } }
 *   } satisfies Partial<Record<string, ResourcePatch>>;
 */
export const overrides: Readonly<Partial<Record<string, ResourcePatch<unknown>>>> = {};
