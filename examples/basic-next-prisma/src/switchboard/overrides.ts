import type { ResourceConfig } from "@/switchboard/types";

export type ResourcePatch<T = unknown> = Partial<ResourceConfig<T>>;

export function mergeResource<T>(
  base: ResourceConfig<T>,
  patch?: ResourcePatch<T>,
): ResourceConfig<T> {
  const resolvedPatch = patch ?? {};
  return {
    ...base,
    ...resolvedPatch,
    fields: resolvedPatch.fields ?? base.fields,
    list: { ...(base.list ?? {}), ...(resolvedPatch.list ?? {}) },
  };
}

export const overrides: Readonly<
  Partial<Record<string, ResourcePatch<unknown>>>
> = {};
