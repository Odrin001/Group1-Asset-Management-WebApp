import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ScanLog from "@/models/ScanLog";
import { authorizeRequest } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();

    const limitParam = request.nextUrl.searchParams.get("limit");
    const requestedLimit = limitParam === null ? 2000 : Number(limitParam);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return NextResponse.json(
        { message: "Limit must be a positive integer" },
        { status: 400 }
      );
    }

    const logs = await ScanLog.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(requestedLimit, 2000));

    console.log("Fetched logs", logs.length);

    return NextResponse.json(logs, {
      status: 200,
    });
  } catch (error) {
    console.log("Error fetching logs", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    await ScanLog.deleteMany({});

    return NextResponse.json({ message: "All scan logs cleared" }, { status: 200 });
  } catch (error) {
    console.log("Error clearing logs", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}