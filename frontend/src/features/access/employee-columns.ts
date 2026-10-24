import { useEffect, useState } from "react";

/** Employee & account table columns. Relative widths are shared out again
 * among the visible columns, so hiding one widens the others. */
export const EMPLOYEE_COLUMNS = [
  // Status, role and date columns are sized so their badges and dates fit
  // on one line at the usual width; long text columns give way.
  { id: "select", label: "Seç", width: 3.5, fixed: true },
  { id: "name", label: "Ad Soyad", width: 10, fixed: true },
  { id: "leadership", label: "Liderlik", width: 9 },
  { id: "team", label: "Takım", width: 9 },
  { id: "status", label: "Statü", width: 9 },
  { id: "included", label: "Kaynak Planına Dahil", width: 5 },
  { id: "start", label: "İşbaşı Tarihi", width: 6.5 },
  { id: "end", label: "İşten Ayrılış Tarihi", width: 6.5 },
  { id: "account", label: "Hesap", width: 7.5 },
  { id: "email", label: "E-posta Adresi", width: 6 },
  { id: "role", label: "Rol / Yetki", width: 9.5 },
  { id: "scope", label: "Yetki Kapsamı", width: 7 },
  { id: "note", label: "Açıklama", width: 6 },
  { id: "actions", label: "İşlemler", width: 5, fixed: true },
] as const;
export type EmployeeColumn = (typeof EMPLOYEE_COLUMNS)[number];
export type EmployeeColumnId = EmployeeColumn["id"];

const optionalIds = new Set<string>(
  EMPLOYEE_COLUMNS.filter((c) => !("fixed" in c)).map((c) => c.id),
);

/** Stored hidden ids; unknown, fixed or malformed entries are dropped. */
export function parseHiddenColumns(raw: string | null): EmployeeColumnId[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value)
      ? [...new Set(value)].filter(
          (id): id is EmployeeColumnId =>
            typeof id === "string" && optionalIds.has(id),
        )
      : [];
  } catch {
    return [];
  }
}

/** Visible columns in table order with percentage widths summing to 100. */
export function visibleEmployeeColumns(hidden: readonly string[]) {
  const columns = EMPLOYEE_COLUMNS.filter((c) => !hidden.includes(c.id));
  const total = columns.reduce((sum, c) => sum + c.width, 0);
  return columns.map((c) => ({ ...c, percent: (c.width / total) * 100 }));
}

const storageKey = (userId: string) =>
  "aa-kaynak-calisan-sutunlari-v1:" + userId;

/** Hidden until the user chooses otherwise: the table opens on the
 * columns used day to day. */
export const DEFAULT_HIDDEN_COLUMNS: EmployeeColumnId[] = [
  "included",
  "end",
  "email",
  "note",
];

function read(userId: string | undefined): EmployeeColumnId[] {
  if (!userId) return DEFAULT_HIDDEN_COLUMNS;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw === null ? DEFAULT_HIDDEN_COLUMNS : parseHiddenColumns(raw);
  } catch {
    return DEFAULT_HIDDEN_COLUMNS;
  }
}

/** Hidden optional columns, remembered per user in this browser. */
export function useEmployeeColumns(userId: string | undefined) {
  const [hidden, setHidden] = useState<EmployeeColumnId[]>(() => read(userId));
  useEffect(() => setHidden(read(userId)), [userId]);
  const update = (next: EmployeeColumnId[]) => {
    setHidden(next);
    if (!userId) return;
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      // Private mode or blocked storage: keep the in-memory choice.
    }
  };
  return {
    hidden,
    toggle: (id: EmployeeColumnId) =>
      update(
        hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id],
      ),
    reset: () => update([]),
  };
}
