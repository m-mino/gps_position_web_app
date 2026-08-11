/** Asia/Tokyo の日付文字列 (YYYY-MM-DD) をその日の開始/終了 (UTC ISO) に変換 */
export function tokyoDayBounds(date: string, boundary: "start" | "end"): string {
  const suffix = boundary === "start" ? "T00:00:00+09:00" : "T23:59:59.999+09:00";
  return new Date(`${date}${suffix}`).toISOString();
}

export function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function fromUnixSeconds(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

export function isValidIsoDate(value: string): boolean {
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
