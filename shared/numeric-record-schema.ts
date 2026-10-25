import { z } from "zod";

/** Copy valid numeric maps; bound issue allocation when a large map is invalid. */
export function numericRecordSchema({
  max,
  integer = false,
}: {
  max?: number;
  integer?: boolean;
}) {
  let valueSchema = z.number();
  if (integer) valueSchema = valueSchema.int();
  valueSchema = valueSchema.min(0);
  if (max !== undefined) valueSchema = valueSchema.max(max);
  const reference = z.record(z.string(), valueSchema);
  return z
    .any()
    .transform((input: unknown, context): Record<string, number> => {
      if (
        input !== null &&
        typeof input === "object" &&
        !Array.isArray(input) &&
        !Object.getOwnPropertySymbols(input).some((key) =>
          Object.prototype.propertyIsEnumerable.call(input, key),
        ) &&
        (Object.getPrototypeOf(input) === Object.prototype ||
          Object.getPrototypeOf(input) === null)
      ) {
        const copy: Record<string, number> = {};
        let eligible = true;
        for (const key in input) {
          // Unusual keys and descriptors use the current Zod record semantics.
          if (!Object.hasOwn(input, key) || key === "__proto__") {
            eligible = false;
            break;
          }
          const descriptor = Object.getOwnPropertyDescriptor(input, key);
          if (!descriptor || !("value" in descriptor)) {
            eligible = false;
            break;
          }
          const number = descriptor.value;
          if (
            typeof number !== "number" ||
            !Number.isFinite(number) ||
            !(number >= 0) ||
            (max !== undefined && !(number <= max)) ||
            (integer && !Number.isSafeInteger(number))
          ) {
            eligible = false;
            break;
          }
          copy[key] = number;
        }
        if (eligible) return copy;
      }
      // Zod's record parser collects all issues, even with the container
      // early-exit context. Bound that fallback for large untrusted maps.
      if (
        input !== null &&
        typeof input === "object" &&
        !Array.isArray(input) &&
        Object.keys(input).length > 1000
      ) {
        const output: Record<string, number> = {};
        for (const key of Reflect.ownKeys(input)) {
          if (
            key === "__proto__" ||
            !Object.prototype.propertyIsEnumerable.call(input, key)
          )
            continue;
          const entry = reference.safeParse(
            Object.fromEntries([[key, Reflect.get(input, key)]]),
          );
          if (!entry.success) {
            for (const issue of entry.error.issues)
              context.addIssue({ ...issue });
            return z.NEVER;
          }
          Object.assign(output, entry.data);
        }
        return output;
      }
      const parsed = reference.safeParse(input);
      if (parsed.success) return parsed.data;
      for (const issue of parsed.error.issues) context.addIssue({ ...issue });
      return z.NEVER;
    });
}
