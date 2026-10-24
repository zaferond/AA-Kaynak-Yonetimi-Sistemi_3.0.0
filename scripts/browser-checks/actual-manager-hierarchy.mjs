import { selectWorkspaceTab } from "./fixture.mjs";
import assert from "node:assert/strict";
import { applyChanges, applyLeaderChange } from "../../backend/operations.mjs";
import { directoryRevision } from "../../shared/directory-policy.ts";

export async function checkActualManagerHierarchy(f) {
  const child = "QA Actual Manager Child",
    grand = "QA Actual Manager Grand";
  for (const [name, parentName] of [
    [child, f.teamA.lead],
    [grand, child],
  ])
    await f.store.mutate(f.actor, (d, u, c, g) =>
      applyLeaderChange(
        d,
        u,
        {
          action: "create",
          name,
          parentName,
          catalogRevision: directoryRevision(d),
        },
        c,
        g,
      ),
    );
  const state = await f.state();
  const team = {
    id: "qa-manager-grand-team",
    name: "QA Grand Team",
    lead: grand,
    excelCapacity: 0,
  };
  const resource = (id, name, unit, role = "member") => ({
    id,
    name,
    note: "",
    versions: [
      {
        effective: "2026-01",
        start: "2026-01-01",
        end: "",
        status: "Aktif Çalışan",
        included: true,
        amount: 1,
        team: unit.id,
        lead: unit.lead,
        assignmentRole: role,
      },
    ],
  });
  const people = [
    resource(
      "qa-child-leader",
      "QA Child Leader",
      state.teams.find((t) => t.id === state.leadershipUnits[child]),
      "leader",
    ),
    resource("qa-grand-member", "QA Grand Member", team),
  ];
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      { kind: "team", id: team.id, value: team, revision: 0 },
      ...people.map((value) => ({
        kind: "resource",
        id: value.id,
        value,
        revision: 0,
      })),
      ...people.map((person) => ({
        kind: "actual",
        id: person.id + "|p-a|2026-01",
        value: { unit: "hours", value: 9 },
        revision: 0,
      })),
      {
        kind: "workedHours",
        id: "qa-grand-member|2026-01",
        value: 200,
        revision: 0,
      },
      ...[
        ["2026-01-07", "leave", 9],
        ["2026-01-08", "training", 4.5],
      ].map(([date, type, hours]) => ({
        kind: "personDay",
        id: `qa-grand-member|${date}|${type}`,
        revision: 0,
        value: { type, hours, label: "PRIVATE_MANAGER_PEER_CALENDAR" },
      })),
    ]),
  );
  // Aktivite Giriş follows the organisation: the account works as the Lider
  // of the child leadership (its grant alone would give nothing).
  const managerAccount = await f.store.findUser({ id: "manager" });
  await f.store.transaction((c) =>
    f.store.saveUser({ ...managerAccount, resourceId: "qa-child-leader" }, c),
  );
  const { page, context } = await f.client("manager");
  const amount = (name) =>
    page.getByRole("textbox", {
      name: name + " / Browser Project A / 2026-01 / saat",
      exact: true,
    });
  try {
    await selectWorkspaceTab(page, "Aktivite Giriş");
    await page.locator("#actual-entry-unit").selectOption("hours");
    for (const url of ["/api/data", "/api/actual-view?start=2026-01&count=1"]) {
      const response = await context.request.get(f.origin + url);
      assert.equal(response.status(), 200);
      const payload = await response.json();
      // The Lider manages their teams' leave days.
      assert.deepEqual(Object.keys(payload.data.personCalendar).sort(), [
        "qa-grand-member|2026-01-07|leave",
        "qa-grand-member|2026-01-08|training",
      ]);
      if (payload.monthSummaries) {
        const summary = payload.monthSummaries["qa-grand-member|2026-01"];
        // 200 recorded hours less 9 h leave and the 1 January holiday.
        assert.equal(summary.effectiveHours, 182);
        assert.equal(summary.trainingHours, 4.5);
      }
    }
    await f.check(
      "Lider actual hierarchy: edits own and sub-leadership team records and opens their leave calendars",
      async () => {
        for (const person of people) {
          await amount(person.name).waitFor();
          assert(await amount(person.name).isEnabled());
          assert.equal(await amount(person.name).inputValue(), "9");
          await amount(person.name).fill("18");
          await amount(person.name).press("Enter");
          await f.wait(
            async () =>
              Math.abs(
                (await f.state()).actualAllocations[
                  person.id + "|p-a|2026-01"
                ] - 0.1,
              ) < 1e-9,
            "descendant existing allocation updated",
          );
          assert(
            (await page
              .getByRole("button", {
                name: person.name + " izin ve eğitim takvimini aç",
                exact: true,
              })
              .count()) > 0,
          );
        }
        await amount("QA Grand Member").click();
        const hours = page.getByRole("textbox", {
          name: "QA Grand Member / 2026-01 çalışılan saat",
          exact: true,
        });
        assert(await hours.isEnabled());
        assert.equal(await hours.inputValue(), "182");
        await hours.fill("210");
        await hours.press("Enter");
        await f.wait(
          async () =>
            // Stored hours add back the leave and the holiday (18 h).
            (await f.state()).actualWorkedHours["qa-grand-member|2026-01"] ===
            228,
          "descendant existing hours updated",
        );
        await page.reload();
        await selectWorkspaceTab(page, "Aktivite Giriş");
        await page.locator("#actual-entry-unit").selectOption("hours");
        await f.wait(
          async () => (await amount("QA Grand Member").inputValue()) === "18",
          "hours unit and refreshed record settled",
        );
        assert.equal(await amount("Browser Other Employee").count(), 0);
        await f.capture(page, "actual-manager-descendants");
      },
    );
    await f.check(
      "Lider actual hierarchy: HTTP denies outside activity and leave writes and normal peers; stale revisions still conflict",
      async () => {
        const send = async (client, change) => {
          const auth = await (
            await client.context.request.get(f.origin + "/api/auth/me")
          ).json();
          return client.context.request.post(f.origin + "/api/changes", {
            headers: {
              Origin: f.origin,
              "X-Requested-With": "KaynakPortal",
              "X-CSRF-Token": auth.csrf,
            },
            data: { changes: [change] },
          });
        };
        const before = await f.state();
        const outside = {
          kind: "actual",
          id: "r-other|p-a|2026-01",
          value: { unit: "hours", value: 9 },
          revision: 0,
        };
        assert.equal((await send({ context }, outside)).status(), 403);
        assert.equal(
          (
            await send(
              { context },
              {
                kind: "personDay",
                id: "r-other|2026-01-05|leave",
                value: { type: "leave", hours: 9, label: "Synthetic leave" },
                revision: 0,
              },
            )
          ).status(),
          403,
        );
        const change = {
          kind: "actual",
          id: "qa-grand-member|p-a|2026-01",
          value: { unit: "hours", value: 27 },
          revision: 0,
        };
        assert.equal((await send({ context }, change)).status(), 409);
        const normal = await f.client("employee");
        try {
          assert.equal(
            (await send(normal, { ...change, revision: 2 })).status(),
            403,
          );
        } finally {
          await normal.context.close();
        }
        const after = await f.state();
        assert.deepEqual(after.actualAllocations, before.actualAllocations);
        assert.deepEqual(after.personCalendar, before.personCalendar);
        const admin = await f.client("root-admin");
        try {
          await selectWorkspaceTab(admin.page, "Aktivite Giriş");
          assert(
            (await admin.page
              .getByRole("button", {
                name: "QA Grand Member izin ve eğitim takvimini aç",
                exact: true,
              })
              .count()) > 0,
          );
        } finally {
          await admin.context.close();
        }
      },
    );
  } finally {
    await context.close();
    await f.store.transaction((c) => f.store.saveUser(managerAccount, c));
  }
}
