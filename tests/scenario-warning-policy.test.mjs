import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WARNING_SETTINGS,
  SCENARIO_WARNING_RULES,
  matchWarningRule,
  warningProgressStates,
  warningResourceStates,
  warningSettingsSchema,
} from "../shared/scenario-warning-policy.ts";

test("senaryo tablosu dokuz benzersiz kural içerir ve her birleşim en fazla bir kuralla eşleşir", () => {
  assert.equal(SCENARIO_WARNING_RULES.length, 9);
  assert.equal(new Set(SCENARIO_WARNING_RULES.map((r) => r.kod)).size, 9);
  for (const progress of warningProgressStates)
    for (const resource of warningResourceStates) {
      const matches = SCENARIO_WARNING_RULES.filter(
        (r) =>
          r.aktif && r.ilerleme.includes(progress) && r.kaynak === resource,
      );
      assert.ok(matches.length <= 1, `${progress} / ${resource}`);
      assert.equal(matchWarningRule(progress, resource), matches[0]);
    }
});

test("matris eşleşmeleri istenen kodları ve aynen verilen aksiyonları korur", () => {
  const cases = [
    [
      "behind",
      "unplanned",
      "S-01",
      "Yakın dönem kaynak planı ve gecikmenin nedenleri birlikte değerlendirilmeli.",
    ],
    [
      "behind",
      "insufficient",
      "S-02",
      "Ek kaynak ihtiyacı ve takvim revizyonu seçenekleri proje sorumlusuyla değerlendirilmeli.",
    ],
    [
      "behind",
      "sufficient",
      "S-03",
      "Kaynak planı mevcut; iş engelleri, bağımlılıklar ve gerçekleşen verileri incelenmeli.",
    ],
    [
      "behind",
      "excess",
      "S-04",
      "Gecikmenin nedenleri ve kaynakların zaman içindeki dağılımı incelenmeli.",
    ],
    [
      "onTrack",
      "unplanned",
      "S-05",
      "Yakın dönem iş devamlılığı için kaynak planının tamamlanması değerlendirilmeli.",
    ],
    [
      "onTrack",
      "insufficient",
      "S-06",
      "Kalan iş ve kaynak varsayımları doğrulanmalı; kaynak veya takvim revizyonu ihtiyacı değerlendirilmeli.",
    ],
    [
      "onTrack",
      "excess",
      "S-07",
      "İş sürekliliği ve proje riskleri incelendikten sonra kaynak dengeleme seçenekleri değerlendirilmeli.",
    ],
    [
      "ahead",
      "excess",
      "S-08",
      "Kalan işler ve proje riskleri doğrulandıktan sonra kaynak dengeleme seçenekleri değerlendirilmeli.",
    ],
    [
      "ahead",
      "insufficient",
      "S-09",
      "İlerleme avantajının korunması için kalan iş ve gelecek kaynak ihtiyacı gözden geçirilmeli.",
    ],
  ];
  for (const [progress, resource, code, action] of cases) {
    const rule = matchWarningRule(progress, resource);
    assert.equal(rule?.kod, code);
    assert.equal(rule?.uyari2, action);
  }
  for (const [resource, code] of [
    ["unplanned", "S-01"],
    ["insufficient", "S-02"],
    ["sufficient", "S-03"],
  ])
    assert.equal(matchWarningRule("critical", resource)?.kod, code);
});

test("matriste yer almayan birleşimler aksiyon kuralı üretmez", () => {
  for (const [progress, resource] of [
    ["critical", "excess"],
    ["onTrack", "sufficient"],
    ["ahead", "unplanned"],
    ["ahead", "sufficient"],
  ])
    assert.equal(matchWarningRule(progress, resource), undefined);
});

test("pasif kural eşleşmez; kurallar yapılandırmadan okunur", () => {
  const custom = SCENARIO_WARNING_RULES.map((r) => ({ ...r, aktif: false }));
  assert.equal(matchWarningRule("behind", "unplanned", custom), undefined);
});

test("varsayılan eşikler geçerlidir; çelişkili, eksik veya sınırsız ayarlar reddedilir", () => {
  assert.deepEqual(
    warningSettingsSchema.parse(DEFAULT_WARNING_SETTINGS),
    DEFAULT_WARNING_SETTINGS,
  );
  for (const patch of [
    { criticalThreshold: -4 },
    { aheadThreshold: -5 },
    { coverageMinimum: 121, coverageMaximum: 120 },
    { resourceHorizonMonths: 0 },
    { resourceHorizonMonths: 1.5 },
    { trendMonths: 1 },
    { coverageMaximum: Infinity },
    { unknown: true },
  ])
    assert.equal(
      warningSettingsSchema.safeParse({ ...DEFAULT_WARNING_SETTINGS, ...patch })
        .success,
      false,
    );
  assert.equal(warningSettingsSchema.safeParse({}).success, false);
});
