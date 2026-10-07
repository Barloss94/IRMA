export const dateParts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const formatMatchDate = (value) => new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

// Convert the club's Dutch wall clock time without depending on the device timezone.
export function dutchDateTime(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(dateParts.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    if (shown === target) return new Date(instant).toISOString();
    instant += target - shown;
  }
  throw new Error("Deze tijd bestaat niet door de overgang naar zomertijd. Kies een andere tijd.");
}

