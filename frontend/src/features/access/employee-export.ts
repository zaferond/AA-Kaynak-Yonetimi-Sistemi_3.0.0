import type { Data } from "../../model.ts";
import { versionAt } from "../../model.ts";
import { ROOT_ADMIN_ID } from "../../access.ts";
import { fullDateLabel } from "../../format.ts";
import {
  resourceRole,
  resourceRoleLabels,
} from "../../../../shared/resource-roles.ts";
import { planningGrantSummary } from "./planning-permission-tree.ts";
import {
  accountRoleLabel,
  type EmployeeAccountRow,
} from "./employee-account-rows.ts";
import { tableWorkbook } from "../../xlsx-table.ts";
import { downloadWorkbook } from "../../xlsx-workbook.ts";

const HEADER = [
  "Ad Soyad",
  "Kaynak Rolü",
  "Liderlik",
  "Takım",
  "Statü",
  "Kaynak Planına Dahil",
  "İşbaşı Tarihi",
  "İşten Ayrılış Tarihi",
  "Hesap",
  "Hesap Türü",
  "E-posta Adresi",
  "Rol / Yetki",
  "Hesap Durumu",
  "Yetki Kapsamı",
  "Açıklama",
];
const WIDTHS = [26, 16, 34, 34, 18, 12, 14, 14, 20, 16, 28, 18, 16, 36, 30];

/** Every filtered row of Çalışan & Yetki Tanımlama (all pages, all columns),
 * as the table shows it for the selected start month. */
export function employeeExportRows(
  data: Data,
  rows: EmployeeAccountRow[],
  start: string,
) {
  const teams = new Map(data.teams.map((team) => [team.id, team]));
  return rows.map(({ resource: r, account }) => {
    const v = r && (versionAt(r, start) || r.versions[0]);
    const team = v ? teams.get(v.team) : undefined;
    const root = account?.id === ROOT_ADMIN_ID;
    return [
      r?.name || account?.name || "",
      root
        ? "Ana yönetici"
        : v
          ? resourceRoleLabels[resourceRole(data, v)]
          : "Çalışan kaydı eşleştirilmedi",
      v ? v.lead || team?.lead || "Eşleştirilmemiş" : "",
      v ? team?.name || "Takım ataması bekliyor" : "",
      v?.status || "",
      v ? (v.included ? "Evet" : "Hayır") : "",
      v?.start ? fullDateLabel(v.start) : "",
      v?.end ? fullDateLabel(v.end) : "",
      account?.username || "Hesap yok",
      account
        ? account.authSource === "ldap"
          ? "Active Directory"
          : "Yerel Hesap"
        : "",
      account?.email || "",
      account ? accountRoleLabel(account) : "",
      account ? (account.active ? "Aktif" : "Yetki Kaldırıldı") : "",
      account ? planningGrantSummary(data, account) : "",
      r?.note || "",
    ];
  });
}

export function employeeWorkbook(
  data: Data,
  rows: EmployeeAccountRow[],
  start: string,
) {
  return tableWorkbook({
    sheet: "Çalışan ve Yetki",
    title: "Çalışan & Yetki Tanımlama",
    header: HEADER,
    rows: employeeExportRows(data, rows, start),
    widths: WIDTHS,
  });
}

export function downloadEmployees(
  data: Data,
  rows: EmployeeAccountRow[],
  start: string,
) {
  downloadWorkbook(
    employeeWorkbook(data, rows, start),
    "Calisan-ve-Yetki.xlsx",
  );
}
