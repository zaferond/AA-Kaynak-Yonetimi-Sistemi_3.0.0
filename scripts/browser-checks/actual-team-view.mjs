import { selectWorkspaceTab } from "./fixture.mjs";
import assert from "node:assert/strict";
import { applyChanges, applyLeaderChange } from "../../backend/operations.mjs";
import { directoryRevision } from "../../shared/directory-policy.ts";
import { hashPassword } from "../../backend/auth.mjs";

export async function checkActualTeamView(f) {
  const child = "QA Actual Child";
  await f.store.mutate(f.actor, (d, u, c, g) =>
    applyLeaderChange(
      d,
      u,
      {
        action: "create",
        name: child,
        parentName: f.teamA.lead,
        catalogRevision: directoryRevision(d),
      },
      c,
      g,
    ),
  );
  const childTeam = {
    ...f.teamA,
    id: "qa-actual-child-team",
    name: "QA Actual Child Team",
    lead: child,
  };
  const resource = (id, name, team, role = "member") => ({
    id,
    name,
    note: "PRIVATE_PEER_HR",
    code: "PRIVATE_PEER_CODE",
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
        assignmentRole: role,
      },
    ],
  });
  const peer = resource(
    "qa-actual-peer",
    "QA Actual Peer",
    f.teamA,
    "productOwner",
  );
  const childResource = resource(
    "qa-actual-child",
    "QA Actual Child Worker",
    childTeam,
  );
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      { kind: "team", id: childTeam.id, value: childTeam, revision: 0 },
      ...[peer, childResource].map((value) => ({
        kind: "resource",
        id: value.id,
        value,
        revision: 0,
      })),
      {
        kind: "actual",
        id: peer.id + "|p-a|2026-09",
        value: 0.25,
        revision: 0,
      },
      {
        kind: "personDay",
        id: peer.id + "|2026-09-01|leave",
        value: { type: "leave", hours: 9, label: "PRIVATE_PEER_LEAVE" },
        revision: 0,
      },
      {
        kind: "personDay",
        id: peer.id + "|2026-09-02|training",
        value: { type: "training", hours: 9, label: "PRIVATE_PEER_TRAINING" },
        revision: 0,
      },
    ]),
  );
  await f.store.bootstrapUser({
    _id: "actual-peer",
    username: "qa.actual-peer",
    name: "QA Peer",
    role: "normal",
    resourceId: peer.id,
    leaders: [f.teamB.lead],
    active: true,
    password: await hashPassword(f.password),
    version: 1,
    revision: 1,
  });
  const c = await f.client("employee");
  const { page } = c;
  const open = async (p) => {
    await selectWorkspaceTab(p, "Aktivite Giriş");
    await p.locator('input[type="month"]').fill("2026-09");
    await p.locator("#actual-entry-unit").selectOption("hours");
  };
  const field = (p, name, month = "2026-09") =>
    p.getByRole("textbox", {
      name: name + " / Browser Project A / " + month + " / saat",
      exact: true,
    });
  try {
    await open(page);
    await f.check(
      "actual team view: a Team Member sees only themselves; their PO sees, edits and opens leave for the team",
      async () => {
        const own = field(page, "Browser Employee");
        await own.waitFor();
        assert(!(await own.isDisabled()));
        for (const name of [
          peer.name,
          childResource.name,
          "Browser Other Employee",
        ])
          assert.equal(
            await page
              .getByRole("textbox", {
                name: new RegExp(name + " / Browser Project"),
              })
              .count(),
            0,
            name,
          );
        assert.equal(
          await page
            .getByRole("button", {
              name: peer.name + " izin ve eğitim takvimini aç",
              exact: true,
            })
            .count(),
          0,
        );
        await own.fill("9");
        await own.press("Enter");
        await f.wait(
          async () =>
            Math.abs(
              (await f.state()).actualAllocations["r-own|p-a|2026-09"] - 0.05,
            ) < 1e-9,
          "own actual saved",
        );
        const po = await f.client("actual-peer");
        try {
          await open(po.page);
          const member = field(po.page, "Browser Employee"),
            self = field(po.page, peer.name);
          await member.waitFor();
          const namePosition = (field) =>
            field
              .locator("xpath=ancestor::tr[1]")
              .locator(".actual-person-name")
              .evaluate((el) => el.getBoundingClientRect().x);
          assert(
            Math.abs(
              (await namePosition(member)) - (await namePosition(self)),
            ) < 0.5,
            "calendar buttons keep names aligned",
          );
          await f.capture(po.page, "actual-employee-name-alignment");
          assert(!(await member.isDisabled()));
          assert(!(await self.isDisabled()));
          assert.equal(await self.inputValue(), "45");
          assert(
            (await po.page
              .getByRole("button", {
                name: "Browser Employee izin ve eğitim takvimini aç",
                exact: true,
              })
              .count()) > 0,
          );
          assert.equal(
            await po.page
              .getByRole("textbox", {
                name: /QA Actual Child Worker \/ Browser Project/,
              })
              .count(),
            0,
          );
          await member.fill("18");
          await member.press("Enter");
          await f.wait(
            async () =>
              Math.abs(
                (await f.state()).actualAllocations["r-own|p-a|2026-09"] - 0.1,
              ) < 1e-9,
            "PO saved the team member's activity",
          );
        } finally {
          await po.context.close();
        }
      },
    );
    await f.check(
      "actual team view: an employee Lider sees and edits the leadership's teams, sub-leaderships included",
      async () => {
        const state = await f.state();
        const unitId = state.leadershipUnits[f.teamA.lead];
        assert(unitId);
        const own = state.resources.find((r) => r.id === "r-own");
        const value = {
          ...own,
          versions: own.versions.map((v) => ({
            ...v,
            team: unitId,
            assignmentRole: "leader",
          })),
        };
        await f.store.mutate(f.actor, (d, u) =>
          applyChanges(d, u, [
            {
              kind: "resource",
              id: own.id,
              value,
              revision: d.revisions["resource:" + own.id],
            },
          ]),
        );
        await page.reload();
        await open(page);
        await field(page, childResource.name).waitFor();
        assert(!(await field(page, childResource.name).isDisabled()));
        assert(!(await field(page, peer.name).isDisabled()));
        assert.equal(
          await page
            .getByRole("textbox", {
              name: /Browser Other Employee \/ Browser Project/,
            })
            .count(),
          0,
        );
      },
    );
    await f.check(
      "actual team view: delayed prior-period response cannot overwrite the selected period",
      async () => {
        await f.store.mutate(f.actor, (d, u) =>
          applyChanges(d, u, [
            {
              kind: "actual",
              id: "r-own|p-a|2026-10",
              value: 0.2,
              revision: d.revisions["actual:r-own|p-a|2026-10"] || 0,
            },
          ]),
        );
        await page.reload();
        await open(page);
        await field(page, peer.name).waitFor();
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        let held = false;
        const route = async (route) => {
          if (
            new URL(route.request().url()).searchParams.get("start") !==
            "2026-01"
          )
            return route.continue();
          const response = await route.fetch();
          held = true;
          await gate;
          await route.fulfill({ response });
        };
        await page.route("**/api/actual-view?*", route);
        try {
          await page.locator('input[type="month"]').fill("2026-01");
          await f.wait(() => held, "prior period held");
          await page.locator('input[type="month"]').fill("2026-10");
          const current = field(page, "Browser Employee", "2026-10");
          await f.wait(
            async () =>
              (await current.count()) === 1 &&
              (await current.inputValue()) === "36",
            "current period ready",
          );
          release();
          await page.waitForTimeout(200);
          assert.equal(await current.inputValue(), "36");
        } finally {
          release();
          await page.unroute("**/api/actual-view?*", route);
        }
      },
    );
  } catch (e) {
    await f.capture(page, "actual-team-failure").catch(() => {});
    throw e;
  } finally {
    await c.context.close();
  }
}
