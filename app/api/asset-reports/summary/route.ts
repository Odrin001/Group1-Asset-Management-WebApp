import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import {
  ASSET_REPORT_STATUSES,
  ASSET_REPORT_TYPES,
  isAssetReportStatus,
  isAssetReportType,
} from "@/lib/asset-reports";
import { connectDB } from "@/lib/mongodb";
import AssetReport from "@/models/AssetReport";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function manilaDateStart(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const dateOnly = new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .slice(0, 10);
  if (dateOnly !== value) return null;

  return new Date(Date.UTC(year, month - 1, day) - MANILA_OFFSET_MS);
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    const searchParams = request.nextUrl.searchParams;
    const fromValue = searchParams.get("from") || "";
    const toValue = searchParams.get("to") || "";
    const typeValue = searchParams.get("type") || "all";
    const statusValue = searchParams.get("status") || "all";
    const from = fromValue ? manilaDateStart(fromValue) : null;
    const toStart = toValue ? manilaDateStart(toValue) : null;

    if (
      (fromValue && !from) ||
      (toValue && !toStart) ||
      (typeValue !== "all" && !isAssetReportType(typeValue)) ||
      (statusValue !== "all" && !isAssetReportStatus(statusValue))
    ) {
      return NextResponse.json({ message: "Invalid summary filters." }, { status: 400 });
    }

    const to = toStart
      ? new Date(toStart.getTime() + 24 * 60 * 60 * 1000)
      : null;
    if (from && to && from >= to) {
      return NextResponse.json(
        { message: "The From date must not be after the To date." },
        { status: 400 }
      );
    }

    const createdAt: { $gte?: Date; $lt?: Date } = {};
    if (from) createdAt.$gte = from;
    if (to) createdAt.$lt = to;

    const match: Record<string, unknown> = {};
    if (Object.keys(createdAt).length > 0) match.createdAt = createdAt;
    if (typeValue !== "all") match.type = typeValue;
    if (statusValue !== "all") match.status = statusValue;

    await connectDB();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalReports, results] = await Promise.all([
      AssetReport.countDocuments(),
      AssetReport.aggregate([
        { $match: match },
        {
          $project: {
            assetId: 1,
            assetName: 1,
            tagId: 1,
            type: 1,
            status: 1,
            createdAt: 1,
            "reporter.name": 1,
          },
        },
        {
          $facet: {
            reportCounts: [
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            lastSevenDays: [
              { $match: { createdAt: { $gte: sevenDaysAgo } } },
              { $count: "count" },
            ],
            filteredTotal: [{ $count: "count" }],
            typeCounts: [
              { $group: { _id: "$type", count: { $sum: 1 } } },
            ],
            mostReportedAssets: [
              { $sort: { createdAt: -1 } },
              {
                $group: {
                  _id: "$assetId",
                  assetName: { $first: "$assetName" },
                  tagId: { $first: "$tagId" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1, assetName: 1 } },
              { $limit: 5 },
              {
                $project: {
                  _id: 0,
                  assetId: { $toString: "$_id" },
                  assetName: 1,
                  tagId: 1,
                  count: 1,
                },
              },
            ],
            latestReports: [
              { $sort: { createdAt: -1 } },
              { $limit: 10 },
              {
                $project: {
                  _id: { $toString: "$_id" },
                  assetName: 1,
                  tagId: 1,
                  type: 1,
                  "reporter.name": 1,
                  status: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
      ]),
    ]);

    const summary = results[0] || {};
    const statusCounts = new Map(
      (summary.reportCounts || []).map(
        (item: { _id: string; count: number }) => [item._id, item.count]
      )
    );
    const typeCounts = new Map(
      (summary.typeCounts || []).map(
        (item: { _id: string; count: number }) => [item._id, item.count]
      )
    );

    return NextResponse.json({
      totalReports,
      filteredTotal: summary.filteredTotal?.[0]?.count || 0,
      reportCounts: Object.fromEntries(
        ASSET_REPORT_STATUSES.map((status) => [
          status,
          statusCounts.get(status) || 0,
        ])
      ),
      lastSevenDaysCount: summary.lastSevenDays?.[0]?.count || 0,
      typeCounts: ASSET_REPORT_TYPES.map((type) => ({
        type,
        count: typeCounts.get(type) || 0,
      })),
      mostReportedAssets: summary.mostReportedAssets || [],
      latestReports: summary.latestReports || [],
    });
  } catch (error) {
    console.error("Error fetching asset report summary:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
