import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UnregisteredScan from "@/models/UnregisteredScan";

export async function GET() {
  try {
    await connectDB();
    const scans = await UnregisteredScan.find().sort({ lastSeenAt: -1 });
    return NextResponse.json(scans, { status: 200 });
  } catch (error) {
    console.error("Error fetching unregistered scans:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDB();
    const uid = new URL(request.url).searchParams.get("uid");

    if (uid) {
      await UnregisteredScan.deleteOne({ uid });
    } else {
      await UnregisteredScan.deleteMany({});
    }

    return NextResponse.json({ message: uid ? "UID cleared" : "Unregistered UIDs cleared" }, { status: 200 });
  } catch (error) {
    console.error("Error clearing unregistered scans:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}