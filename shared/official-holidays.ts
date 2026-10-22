import type { CalendarDay, WorkCalendar } from "./actual-units.ts";

/** Türkiye's official holidays for 2026–2040, built in so the shared work
 * calendar needs no manual entry. Fixed national days follow their dates;
 * the religious holidays start on the dates below, computed from the Umm
 * al-Qura calendar (1 Şevval / 10 Zilhicce). The day before each is a half
 * day (arife). Diyanet occasionally announces a day's difference: correct
 * the start date here if the official calendar differs. */
export const OFFICIAL_HOLIDAY_YEARS = { from: 2026, to: 2040 } as const;

const RAMAZAN_BAYRAMI_STARTS = [
  "2026-03-20",
  "2027-03-09",
  "2028-02-26",
  "2029-02-14",
  "2030-02-04",
  "2031-01-24",
  "2032-01-14",
  "2033-01-03",
  "2033-12-23",
  "2034-12-12",
  "2035-12-01",
  "2036-11-19",
  "2037-11-09",
  "2038-10-29",
  "2039-10-19",
  "2040-10-07",
];
const KURBAN_BAYRAMI_STARTS = [
  "2026-05-27",
  "2027-05-16",
  "2028-05-05",
  "2029-04-24",
  "2030-04-13",
  "2031-04-02",
  "2032-03-22",
  "2033-03-12",
  "2034-03-01",
  "2035-02-19",
  "2036-02-08",
  "2037-01-27",
  "2038-01-16",
  "2039-01-05",
  "2039-12-26",
  "2040-12-15",
];
const FIXED_DAYS: [string, string, CalendarDay["fraction"]][] = [
  ["01-01", "Yılbaşı", 1],
  ["04-23", "Ulusal Egemenlik ve Çocuk Bayramı", 1],
  ["05-01", "Emek ve Dayanışma Günü", 1],
  ["05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı", 1],
  ["07-15", "Demokrasi ve Millî Birlik Günü", 1],
  ["08-30", "Zafer Bayramı", 1],
  ["10-28", "Cumhuriyet Bayramı Arifesi", 0.5],
  ["10-29", "Cumhuriyet Bayramı", 1],
];

const addDays = (date: string, days: number) =>
  new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);

function buildCalendar(): WorkCalendar {
  const calendar: WorkCalendar = {};
  // Two holidays can meet on one date; the longer absence wins.
  const mark = (date: string, day: CalendarDay) => {
    const year = Number(date.slice(0, 4));
    if (year < OFFICIAL_HOLIDAY_YEARS.from || year > OFFICIAL_HOLIDAY_YEARS.to)
      return;
    if ((calendar[date]?.fraction || 0) >= day.fraction) return;
    calendar[date] = day;
  };
  for (
    let year = OFFICIAL_HOLIDAY_YEARS.from;
    year <= OFFICIAL_HOLIDAY_YEARS.to;
    year++
  )
    for (const [day, label, fraction] of FIXED_DAYS)
      mark(`${year}-${day}`, { type: "official", label, fraction });
  const religious = (starts: string[], label: string, length: number) => {
    for (const start of starts) {
      const range = { from: start, to: addDays(start, length - 1) };
      mark(addDays(start, -1), {
        type: "religious",
        label: label + " Arifesi",
        fraction: 0.5,
      });
      for (let i = 0; i < length; i++)
        mark(addDays(start, i), {
          type: "religious",
          label,
          fraction: 1,
          range,
        });
    }
  };
  religious(RAMAZAN_BAYRAMI_STARTS, "Ramazan Bayramı", 3);
  religious(KURBAN_BAYRAMI_STARTS, "Kurban Bayramı", 4);
  return calendar;
}

export const OFFICIAL_HOLIDAYS: Readonly<WorkCalendar> =
  Object.freeze(buildCalendar());

/** Official holidays of one year, in date order, for display. */
export function officialHolidaysOfYear(year: number) {
  return Object.entries(OFFICIAL_HOLIDAYS)
    .filter(([date]) => date.startsWith(year + "-"))
    .sort(([a], [b]) => a.localeCompare(b));
}
