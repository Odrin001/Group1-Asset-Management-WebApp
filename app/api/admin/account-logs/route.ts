import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import { connectDB } from "@/lib/mongodb";
import AccountLog from "@/models/AccountLog";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();

    const params = request.nextUrl.searchParams;
    const accountId = params.get("accountId");
    const search = params.get("search")?.trim();
    const from = params.get("from");
    const to = params.get("to");
    const filter: Record<string, unknown> = {};

    if (accountId) {
      filter.accountId = accountId;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { accountName: regex },
        { accountEmail: regex },
        { "who.name": regex },
        { "who.email": regex },
      ];
    }

    if (from || to) {
      const timestamp: { $gte?: Date; $lte?: Date } = {};
      if (from) {
        const fromDate = new Date(`${from}T00:00:00.000Z`);
        if (Number.isNaN(fromDate.getTime())) {
          return NextResponse.json(
            { message: "Invalid start date" },
            { status: 400 }
          );
        }
        timestamp.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59.999Z`);
        if (Number.isNaN(toDate.getTime())) {
          return NextResponse.json(
            { message: "Invalid end date" },
            { status: 400 }
          );
        }
        timestamp.$lte = toDate;
      }
      filter.timestamp = timestamp;
    }

    const logs = await AccountLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        _id: String(log._id),
      })),
    });
  } catch (error) {
    console.error("Error fetching account logs:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
