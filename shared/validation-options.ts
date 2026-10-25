import type { core } from "zod";

// Zod 4.6.7 exposes container early-exit in its core context, but not in the
// classic parse parameter type. Keep that version-specific contract here;
// the dependency is pinned and validation-budget tests guard its behavior.
export const validationOptions: core.ParseContextInternal<core.$ZodIssue> = {
  abortEarly: true,
};
