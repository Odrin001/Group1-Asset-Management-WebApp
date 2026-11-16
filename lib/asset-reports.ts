export const ASSET_REPORT_TYPES = [
  "Damaged/Poor condition",
  "Missing/Can't find",
  "Wrong location",
  "Needs repair/maintenance",
  "Wrong information",
  "Other",
] as const;

export const ASSET_REPORT_CONDITIONS = ["Good", "Fair", "Poor"] as const;
export const ASSET_REPORT_STATUSES = [
  "open",
  "in_review",
  "resolved",
  "dismissed",
] as const;
export const GUEST_REPORT_DAILY_LIMIT = 5;

export type AssetReportType = (typeof ASSET_REPORT_TYPES)[number];
export type AssetReportCondition = (typeof ASSET_REPORT_CONDITIONS)[number];
export type AssetReportStatus = (typeof ASSET_REPORT_STATUSES)[number];

export function isAssetReportType(value: unknown): value is AssetReportType {
  return typeof value === "string" && ASSET_REPORT_TYPES.some((type) => type === value);
}

export function isAssetReportCondition(
  value: unknown
): value is AssetReportCondition {
  return (
    typeof value === "string" &&
    ASSET_REPORT_CONDITIONS.some((condition) => condition === value)
  );
}

export function isAssetReportStatus(value: unknown): value is AssetReportStatus {
  return typeof value === "string" && ASSET_REPORT_STATUSES.some((status) => status === value);
}

export function getManilaDayRange(now = new Date()) {
  const dateParts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(dateParts.find((part) => part.type === "year")?.value);
  const month = Number(dateParts.find((part) => part.type === "month")?.value);
  const day = Number(dateParts.find((part) => part.type === "day")?.value);
  const start = new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000);

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}
