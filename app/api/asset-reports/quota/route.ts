import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import {
  GUEST_REPORT_DAILY_LIMIT,
  getManilaDayRange,
} from "@/lib/asset-reports";
import { connectDB } from "@/lib/mongodb";
import AssetReport from "@/models/AssetReport";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, [
      "guest",
      "admin",
      "sysadmin",
    ]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    if (authorization.user.role !== "guest") {
      return NextResponse.json({ limit: null, remaining: null });
    }

    await connectDB();
    const { start, end } = getManilaDayRange();
    const reportsToday = await AssetReport.countDocuments({
      "reporter.id": authorization.user.id,
      createdAt: { $gte: start, $lt: end },
    });

    return NextResponse.json({
      limit: GUEST_REPORT_DAILY_LIMIT,
      remaining: Math.max(0, GUEST_REPORT_DAILY_LIMIT - reportsToday),
    });
  } catch (error) {
    console.error("Error fetching asset report quota:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
