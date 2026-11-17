import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import RFIDTag from "@/models/RFIDTag";
import ScanLog from "@/models/ScanLog";
import UnregisteredScan from "@/models/UnregisteredScan";
import { processScannerDetection } from "@/lib/scanner-state";
import PendingScan from "@/models/PendingScan";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

const pendingScanStore = {
  async markPending(uid: string, scanner: string) {
    const filter = { uid };
    const update = {
      $set: { scanner },
      $setOnInsert: { uid },
    };
    const options = { upsert: true, setDefaultsOnInsert: true };

    try {
      await PendingScan.findOneAndUpdate(filter, update, options).exec();
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      await PendingScan.findOneAndUpdate(filter, update, options).exec();
    }
  },
  async consumePending(uid: string, expectedScanner: string) {
    const deleted = await PendingScan.findOneAndDelete({
      uid,
      scanner: expectedScanner,
    })
      .select({ _id: 1 })
      .lean()
      .exec();
    return deleted !== null;
  },
};

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

    const transition = await processScannerDetection(
      {
        uid,
        currentRoom: tag.currentRoom,
        scanner,
        room,
      },
      pendingScanStore
    );

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