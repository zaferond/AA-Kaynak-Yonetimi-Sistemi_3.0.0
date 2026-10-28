import { useEffect, useState } from "react";

/** "Sadece Veri Olanlar" view toggle. Every session and every user starts
 * with it off: the planned and actual grids are also entry screens. */
export function useOnlyDataRows(userId: string | undefined) {
  const [value, setValue] = useState(false);
  useEffect(() => setValue(false), [userId]);
  return [value, setValue] as const;
}
