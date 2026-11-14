import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import RFIDTag from "@/models/RFIDTag";
import { authorizeRequest } from "@/lib/authorization";

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

    await connectDB();

    const rfidTags = await RFIDTag.find().sort({
      createdAt: -1,
    });

    return NextResponse.json({
      rfidTags,
    });
  } catch (error) {
    console.error("Error fetching RFID tags:", error);

    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}