import { ROOT_ADMIN_ID } from "../shared/access.ts";
import { hashPassword } from "./auth.mjs";
import {
  assertAdminPassword,
  generateSetupCode,
} from "./admin-credentials.mjs";

export function setupCodeMessage(username, code) {
  return (
    "\nİlk yönetici girişi — kullanıcı adı: " +
    username +
    "\nTek kullanımlık kurulum kodu: " +
    code +
    "\nBu kodla giriş yapıp kendi şifrenizi belirleyin. Şifre belirlenene kadar her açılışta yeni kod üretilir; eski kod geçersiz olur.\n"
  );
}

/** Creates the root admin on first start, or rotates its one-time code while
 * it is still unclaimed. Messages go to `log` (the server console). */
export async function ensureRootAdmin(store, env, log = console.log) {
  const envPassword = String(env.ADMIN_PASSWORD || "").trim();
  const root = await store.findUser({ id: ROOT_ADMIN_ID });
  if (!root) {
    const username = (env.ADMIN_USERNAME || "").trim().toLowerCase();
    if (!/^[a-z0-9._@+-]{3,100}$/.test(username))
      throw Error(
        "ADMIN_USERNAME boş veya geçersiz. Yerelde npm run setup çalıştırın; MSSQL kurulumunda .env içine ilk yönetici kullanıcı adını yazın.",
      );
    // ADMIN_PASSWORD stays supported for existing installs; without it the
    // first password is a one-time code that never touches the disk.
    if (envPassword) assertAdminPassword(env.ADMIN_PASSWORD, username);
    const code = envPassword ? "" : generateSetupCode();
    await store.bootstrapUser({
      _id: ROOT_ADMIN_ID,
      username,
      name: "Sistem Yöneticisi",
      role: "admin",
      leaders: [],
      active: true,
      password: await hashPassword(envPassword ? env.ADMIN_PASSWORD : code),
      // The .env password is known to whoever set up the server: the first
      // login must replace it inside the application.
      mustChangePassword: true,
      revision: 1,
      version: 1,
    });
    if (code) log(setupCodeMessage(username, code));
  } else if (envPassword)
    // Only the first start reads it; leaving it behind keeps a known root
    // password on disk and recreates it after a database reset.
    log(
      "Uyarı: Yönetici hesabı zaten var; .env içindeki ADMIN_PASSWORD satırı artık kullanılmıyor. Satırı silin.",
    );
  else if (root.mustChangePassword && root.authSource !== "ldap") {
    // Still unclaimed: every start replaces the code, so one copied from an
    // older console log stops working.
    const code = generateSetupCode();
    const password = await hashPassword(code);
    await store.transaction(async (c) => {
      const current = await store.findUser({ id: ROOT_ADMIN_ID }, c);
      await store.saveUser(
        {
          ...current,
          password,
          revision: current.revision + 1,
          version: current.version + 1,
        },
        c,
      );
      await store.revokeUser(current._id, c);
    });
    log(setupCodeMessage(root.username, code));
  }
}
