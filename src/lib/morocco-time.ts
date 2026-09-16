const MOROCCO_TIME_ZONE = "Africa/Casablanca";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MOROCCO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(date: Date) {
  const values = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function toMoroccoDateTimeLocal(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Date invalide.");
  const p = parts(date);
  const two = (number: number) => String(number).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

export function moroccoDateTimeLocalToIso(value: string): string {
  // ISO values with an explicit offset already identify an exact instant.
  if (/([zZ]|[+-]\d{2}:\d{2})$/.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new RangeError("Date invalide.");
    return date.toISOString();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new RangeError("Date locale invalide.");
  const [, year, month, day, hour, minute, second = "0"] = match;
  const wall = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const normalized = `${year}-${month}-${day}T${hour}:${minute}:${second.padStart(2, "0")}`;
  if (new Date(wall).toISOString().slice(0, 19) !== normalized) throw new RangeError("Date locale invalide.");
  let instant = wall;

  // Resolve the Casablanca UTC offset for this date, including Ramadan changes.
  for (let attempt = 0; attempt < 4; attempt++) {
    const p = parts(new Date(instant));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const adjustment = wall - shown;
    if (adjustment === 0) return new Date(instant).toISOString();
    instant += adjustment;
  }
  throw new RangeError("Cette heure locale n'existe pas au Maroc.");
}
