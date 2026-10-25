import { z } from "zod";

/** Preserve ordinary record errors; large records stop at the first invalid entry. */
export function boundedRecord<K extends z.ZodType<string>, V extends z.ZodType>(
  key: K,
  value: V,
) {
  const reference = z.record(key, value);
  return z.unknown().transform((input, ctx): Record<string, z.output<V>> => {
    if (
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length <= 1000
    ) {
      const result = reference.safeParse(input);
      if (result.success) return result.data;
      for (const issue of result.error.issues) ctx.addIssue({ ...issue });
      return z.NEVER;
    }
    const result: Record<string, z.output<V>> = {};
    for (const name of Reflect.ownKeys(input)) {
      if (
        name === "__proto__" ||
        !Object.prototype.propertyIsEnumerable.call(input, name)
      )
        continue;
      const entry = reference.safeParse(
        Object.fromEntries([[name, Reflect.get(input, name)]]),
      );
      if (!entry.success) {
        for (const issue of entry.error.issues) ctx.addIssue({ ...issue });
        return z.NEVER;
      }
      for (const [entryKey, entryValue] of Object.entries(entry.data))
        Object.defineProperty(result, entryKey, {
          value: entryValue,
          enumerable: true,
          configurable: true,
          writable: true,
        });
    }
    return result;
  });
}
