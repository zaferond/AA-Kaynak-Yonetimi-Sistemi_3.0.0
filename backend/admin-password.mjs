import { ROOT_ADMIN_ID } from "../shared/access.ts";
import { Store } from "./store.mjs";
import { hashPassword } from "./auth.mjs";
import {
  assertAdminPassword,
  generateSetupCode,
} from "./admin-credentials.mjs";
// Without NEW_ADMIN_PASSWORD the account is reset to an unknown random code;
// the next server start prints a fresh one-time code to its console.
const chosen = String(process.env.NEW_ADMIN_PASSWORD || "").trim();
if (chosen)
  assertAdminPassword(
    process.env.NEW_ADMIN_PASSWORD,
    process.env.ADMIN_USERNAME,
    "NEW_ADMIN_PASSWORD",
  );
const code = chosen ? "" : generateSetupCode();
const password = await hashPassword(
    chosen ? process.env.NEW_ADMIN_PASSWORD : code,
  ),
  s = new Store();
try {
  await s.connect();
  await s.transaction(async (c) => {
    const u = await s.findUser({ id: ROOT_ADMIN_ID }, c);
    if (!u) throw Error("Önce sistemi başlatın.");
    await s.saveUser(
      {
        ...u,
        password,
        // Set through .env again: the next login must replace it.
        mustChangePassword: true,
        revision: u.revision + 1,
        version: u.version + 1,
      },
      c,
    );
    await s.revokeUser(u._id, c);
  });
  console.log(
    code
      ? "Yönetici şifresi sıfırlandı. Sunucuyu başlatın; konsolda görünen tek kullanımlık kurulum koduyla girip yeni şifrenizi belirleyin."
      : "Şifre değiştirildi. NEW_ADMIN_PASSWORD satırını .env dosyasından silin.",
  );
} finally {
  await s.close();
}
