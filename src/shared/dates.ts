export const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function utcPeriods(now: Date) {
  const today = now.toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const end = new Date(todayStart);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(todayStart);
  start.setUTCDate(start.getUTCDate() - 29);
  const period = (from: Date) => ({
    from: from.toISOString(),
    toExclusive: end.toISOString(),
    timeZone: "UTC" as const,
  });
  return {
    today,
    start,
    end,
    last30Days: period(start),
    todayPeriod: period(todayStart),
  };
}
