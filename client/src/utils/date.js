/**
 * Parse an ISO date string as a local date, ignoring the UTC timezone.
 * Prevents date-only values (stored as midnight UTC) from shifting
 * back a day in timezones behind UTC.
 */
export function parseDateOnly(isoString) {
  const [year, month, day] = isoString.split('T')[0].split('-');
  return new Date(year, month - 1, day);
}
