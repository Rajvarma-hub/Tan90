// The backend stores naive UTC timestamps ("2026-11-14T12:38:00"), so add the zone before parsing.
export function parseUtc(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormat.format(parseUtc(value)) : "—";
}

export function formatTime(value: string | null | undefined): string {
  return value ? timeFormat.format(parseUtc(value)).toUpperCase() : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? `${formatDate(value)}, ${formatTime(value)}` : "—";
}

export function formatDay(value: string): string {
  return dayFormat.format(parseUtc(value));
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

// "3 days", "5 hours", "12 min" for how long something has been in its current state.
export function formatSpan(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${Math.floor(hours / 24)} days`;
}

export function formatDuration(since: string, now: number): string {
  return formatSpan(now - parseUtc(since).getTime());
}

export function formatSetpoint(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value} °C`;
}

// "INTERNAL_TRANSFER" -> "Internal transfer"
export function humanize(value: string): string {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
