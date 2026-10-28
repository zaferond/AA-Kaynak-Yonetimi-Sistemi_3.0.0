import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { Store } from "../../backend/store.mjs";
import { createApp } from "../../backend/app.mjs";
import { hashPassword } from "../../backend/auth.mjs";
import { syntheticDirectory } from "../../tests/directory-fixture.mjs";
import { applyChanges } from "../../backend/operations.mjs";

export async function fixture({ mutationLimits, directoryUsers = [] } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-browser-checks-"));
  // Deliberately never read .env, DB_* or an application database/URL argument.
  const store = new Store({
    env: {
      NODE_ENV: "test",
      DB_PROVIDER: "sqljs",
      SQLJS_FILE: path.join(dir, "synthetic.sqlite"),
    },
  });
  const server = http.createServer();
  let app, browser;
  const contexts = [],
    errors = [],
    checks = [];
  const password = "Browser-check-only-347!";
  async function close() {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await browser?.close();
    app?.locals.close();
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await store.close();
    await fs.rm(path.join(dir, "synthetic.sqlite"), { force: true });
  }
  try {
    await store.connect();
    const data = (await store.read()).data;
    const teamA = data.teams.find((team) => team.lead);
    const teamB = data.teams.find(
      (team) => team.lead && team.lead !== teamA.lead,
    );
    assert(teamA && teamB);
    const hashed = await hashPassword(password);
    const accounts = [
      ["root-admin", "admin", "", []],
      ["employee", "normal", "r-own", [teamA.lead]],
      ["other", "normal", "r-other", [teamB.lead]],
      ["unmapped", "normal", "", []],
      ["manager", "manager", "", [teamA.lead]],
      ["admin-edit", "admin", "", []],
    ];
    for (const [id, role, resourceId, leaders] of accounts.slice(0, 1))
      await store.bootstrapUser({
        _id: id,
        username: "qa." + id,
        name: "Browser " + id,
        role,
        resourceId,
        leaders,
        active: true,
        password: hashed,
        version: 1,
        revision: 1,
      });
    const actor = await store.findUser({ id: "root-admin" });
    const projects = ["a", "b"].map((id) => ({
      id: "p-" + id,
      name: "Browser Project " + id.toUpperCase(),
      responsibleName: "Synthetic owner",
      start: "2026-01",
      end: "2026-12",
      phases: { "2026-01": "Design" },
      phaseColors: { "2026-01": "blue" },
      milestones: [],
    }));
    const resources = [
      ["r-own", "Browser Employee", teamA],
      ["r-other", "Browser Other Employee", teamB],
    ].map(([id, name, team]) => ({
      id,
      name,
      note: "PRIVATE_HR_TEST_NOTE",
      versions: [
        {
          effective: "2026-01",
          start: "2026-01-01",
          end: "",
          team: team.id,
          lead: team.lead,
          status: "Aktif Çalışan",
          included: true,
          amount: 1,
        },
      ],
    }));
    await store.mutate(actor, (d, u) =>
      applyChanges(d, u, [
        ...projects.map((value) => ({
          kind: "project",
          id: value.id,
          value,
          revision: 0,
        })),
        ...resources.map((value) => ({
          kind: "resource",
          id: value.id,
          value,
          revision: 0,
        })),
      ]),
    );
    for (const [id, role, resourceId, leaders] of accounts.slice(1))
      await store.bootstrapUser({
        _id: id,
        username: "qa." + id,
        name: "Browser " + id,
        role,
        resourceId,
        leaders,
        active: true,
        password: hashed,
        version: 1,
        revision: 1,
      });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = "http://127.0.0.1:" + server.address().port;
    const directory = syntheticDirectory(password);
    directory.add({
      id: "f".repeat(32),
      username: "qa.new-manager",
      name: "Directory New Account",
      email: "new.manager@example.test",
    });
    for (const user of directoryUsers) directory.add(user);
    app = createApp(store, { origin, mutationLimits, directory });
    server.on("request", app);
    const options = { headless: true };
    if (process.env.UI_BROWSER_EXECUTABLE)
      options.executablePath = process.env.UI_BROWSER_EXECUTABLE;
    else if (process.platform === "darwin") options.channel = "chrome";
    browser = await chromium.launch(options);
    // Most actual-tab checks cover the "Proje → Kişi" layout, so clients start
    // there; pass actualLayout: null for the app's own default ("Kişi → Proje").
    // Only an unset choice is seeded, so switching in a check sticks.
    async function client(id, { login = true, actualLayout = "project" } = {}) {
      const context = await browser.newContext({
        viewport: { width: 1800, height: 1050 },
        acceptDownloads: true,
      });
      contexts.push(context);
      if (actualLayout)
        await context.addInitScript((layout) => {
          try {
            if (!localStorage.getItem("aa.actualLayout"))
              localStorage.setItem("aa.actualLayout", layout);
          } catch {
            // Storage-less pages keep the app default.
          }
        }, actualLayout);
      if (login) {
        const response = await context.request.post(
          origin + "/api/auth/login",
          {
            headers: { Origin: origin, "X-Requested-With": "KaynakPortal" },
            data: { username: "qa." + id, password },
          },
        );
        assert.equal(response.status(), 200);
      }
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.clock.setFixedTime(new Date("2026-10-02T09:00:00Z"));
      page.on("pageerror", (error) =>
        errors.push({ user: id, message: error.message }),
      );
      await page.goto(origin);
      if (login)
        await page
          .getByRole("button", {
            name: /^Sol menüyü (aç|kapat)$/,
          })
          .waitFor();
      return { context, page, id };
    }
    async function wait(fn, label) {
      const until = Date.now() + 10000;
      while (Date.now() < until) {
        if (await fn()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw Error("Timed out: " + label);
    }
    async function check(name, fn) {
      await fn();
      checks.push(name);
      console.log("PASS " + name);
    }
    async function capture(page, name) {
      await page.screenshot({
        path: path.join(dir, name + ".png"),
        animations: "disabled",
        caret: "hide",
      });
    }
    async function report(status, cause) {
      if (cause) {
        try {
          const page = contexts.flatMap((context) => context.pages()).at(-1);
          await page?.screenshot({ path: path.join(dir, "failure.png") });
        } catch {
          // The browser may already be closed; retain the original failure.
        }
      }
      await fs.writeFile(
        path.join(dir, "result.json"),
        JSON.stringify(
          {
            status,
            checks,
            errors,
            ...(cause ? { error: cause.message } : {}),
          },
          null,
          2,
        ),
      );
    }
    return {
      dir,
      store,
      actor,
      addDirectoryUser: (user) => directory.add(user),
      teamA,
      teamB,
      password,
      origin,
      client,
      wait,
      check,
      checks,
      errors,
      capture,
      report,
      close,
      state: async () => (await store.read()).data,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Select an isolated AD identity through the same UI as a new employee. */
export async function chooseTestDirectoryUser(f, page, name) {
  const id = createHash("sha256").update(name).digest("hex").slice(0, 32);
  f.addDirectoryUser({
    id,
    name,
    username: "qa." + id.slice(0, 12),
    email: "qa." + id.slice(0, 12) + "@example.test",
  });
  const fields = page.locator(
    ".employee-access-editor .resource-account-section",
  );
  await fields.getByLabel("Kullanıcı Ara", { exact: true }).fill(name);
  await fields
    .getByRole("button", { name: "Kullanıcı Ara", exact: true })
    .click();
  await fields
    .getByRole("button", { name: name + " kullanıcısını seç", exact: true })
    .click();
}

/** Ensure the docked menu is visible. It is already open in a fresh session. */
export async function hoverMainMenu(page) {
  if (
    (await page.locator("#workspace-main-menu").getAttribute("data-open")) !==
    "true"
  )
    await page
      .getByRole("button", { name: "Sol menüyü aç", exact: true })
      .click();
  await page.locator('#workspace-main-menu[data-open="true"]').waitFor();
}

/** Moving out of a docked menu does not close it or blur an editor. */
export async function leaveMainMenu(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(viewport.width - 20, viewport.height - 20);
}

/** Kaynak Planlama and Aktivite Giriş pick their layout in a "Görünüm" list
 * ("Proje Bazlı", "Takım Bazlı", "Kişi Bazlı") instead of view tabs. */
export async function selectWorkspaceView(page, label) {
  await page.getByLabel("Görünüm", { exact: true }).selectOption({ label });
}

/** Entry uses the month strip; the report retains its month select. */
export async function selectProgressMonth(page, month) {
  await page
    .locator(".progress-baseline:visible, .progress-report:visible")
    .first()
    .waitFor();
  // In entry mode, expose the month strip without leaving a task filter active.
  const entryMode = await page.locator(".progress-baseline").count();
  const opened =
    entryMode && !(await page.locator(".progress-month-strip").count());
  if (opened) await page.locator('[data-waiting="actualEntry"]').click();
  await page
    .locator(".progress-month-strip:visible, .progress-month select:visible")
    .first()
    .waitFor();
  const button = page.locator(
    `.progress-month-strip button[data-month="${month}"]`,
  );
  if (await button.count()) await button.click();
  else
    await page
      .getByRole("combobox", { name: "Ay", exact: true })
      .selectOption(month);
  if (opened) await page.locator('[data-waiting="actualEntry"]').click();
}

export async function selectWorkspaceTab(page, name) {
  const menu = page.locator("#workspace-main-menu");
  const mainTab = menu.getByText(name, { exact: true });
  // Right after a reload the menu is still empty; wait until it lists tabs.
  await menu
    .getByRole("tab", { includeHidden: true })
    .first()
    .waitFor({ state: "attached" });
  if (
    (await mainTab.count()) ||
    [
      "Çalışan & Yetki Tanımlama",
      "Liderlik ve Takımlar",
      "Organizasyon Yapısı",
    ].includes(name)
  ) {
    // The header button toggles. A pointer resting on the menu edge can open
    // the menu by hover at the same moment, so confirm it is open and retry.
    for (let attempt = 0; ; attempt++) {
      if ((await menu.getAttribute("data-open")) === "true") break;
      if (attempt === 3) throw Error("Ana menü açılamadı.");
      await page
        .getByRole("button", { name: "Sol menüyü aç", exact: true })
        .click();
      await page
        .locator('#workspace-main-menu[data-open="true"]')
        .waitFor({ timeout: 1500 })
        .catch(() => {});
    }
  }
  const employee = name === "Çalışan & Yetki Tanımlama";
  const directory =
    name === "Liderlik ve Takımlar" || name === "Organizasyon Yapısı";
  if (employee || directory) {
    await page
      .getByRole("tab", {
        name: "Organizasyon & Çalışan & Yetki",
        exact: true,
      })
      .click();
    await page
      .getByRole("tab", {
        name: employee ? "Çalışan & Yetki Tanımlama" : "Organizasyon Yapısı",
        exact: true,
      })
      .click();
  } else {
    await (
      (await mainTab.count())
        ? menu.getByRole("tab", { name, exact: true })
        : page.getByRole("tab", { name, exact: true })
    ).click();
  }
}

/** Reveal an offscreen record through the real scroll viewport, as a user would.
 * A locator cannot scrollIntoView until its virtual section has been mounted. */
export async function revealTableItem(container, item) {
  if (await item.count()) {
    await item.scrollIntoViewIfNeeded();
    return;
  }
  await container.evaluate((c) => {
    c.scrollTop = 0;
  });
  let edges = 0;
  for (let attempt = 0; attempt < 100; attempt++) {
    await container.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    if (await item.count()) {
      await item.scrollIntoViewIfNeeded();
      return;
    }
    const moved = await container.evaluate((c) => {
      const old = c.scrollTop;
      c.scrollTop += Math.max(100, c.clientHeight * 0.75);
      return Math.abs(c.scrollTop - old) > 1;
    });
    edges = moved ? 0 : edges + 1;
    if (edges >= 3) break;
  }
  throw Error("Record was not reachable through the table viewport");
}

/** The default-tab choice and backup actions live in the header user menu. */
export async function openUserMenu(page) {
  const trigger = page.getByRole("button", { name: /^Kullanıcı menüsü/ });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
  await page.locator('[data-slot="popover-content"].user-menu').waitFor();
}

/** Open the scenario draft only through its explicit create action. */
export async function openScenarioEntry(page) {
  const button = page.getByRole("button", {
    name: "Senaryo Oluştur",
    exact: true,
  });
  if (await button.isVisible()) await button.click();
}
