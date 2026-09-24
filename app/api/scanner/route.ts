import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import RFIDTag from "@/models/RFIDTag";
import ScanLog from "@/models/ScanLog";
import UnregisteredScan from "@/models/UnregisteredScan";
import { processScannerDetection } from "@/lib/scanner-state";

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();

    const { uid, room, scanner } = body;

    console.log("Scan request received", { uid, room, scanner });

    if (!uid || !room || (scanner !== "inside" && scanner !== "outside")) {
      return NextResponse.json(
        { message: "UID, room, and a valid scanner side are required" },
        { status: 400 }
      );
    }

    // Find RFID tag
    const tag = await RFIDTag.findOne({ uid });

    if (!tag) {
      await UnregisteredScan.findOneAndUpdate(
        { uid },
        { scanner, lastSeenAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return NextResponse.json(
        {
          message: "Unregistered RFID detected; movement not recorded",
          uid,
        },
        { status: 200 }
      );
    }

    const transition = processScannerDetection({
      uid,
      currentRoom: tag.currentRoom,
      scanner,
      room,
    });

    if (transition.status === "pending") {
      return NextResponse.json(
        {
          message: "Scanner detection pending confirmation",
          uid,
          scanner,
        },
        { status: 202 }
      );
    }

    if (transition.status !== "confirmed") {
      return NextResponse.json(
        { message: "Scanner detection ignored; transition not confirmed" },
        { status: 202 }
      );
    }

    const { action, fromRoom, toRoom, nextRoom } = transition;
    tag.currentRoom = nextRoom;

    await tag.save();

    const now = new Date();

    await ScanLog.create({
      uid,
      assetName: tag.assetName,
      action,
      fromRoom,
      toRoom,
      time: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      date: now.toLocaleDateString("en-GB"),
    });

    console.log("Scan log created", { uid, action, fromRoom, toRoom, assetName: tag.assetName });

    return NextResponse.json(
      {
        message: "Scan recorded",
        action,
        asset: tag.assetName,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}