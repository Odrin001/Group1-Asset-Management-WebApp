import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import RFIDTag from "@/models/RFIDTag";
import { authorizeRequest } from "@/lib/authorization";
import Notification from "@/models/Notification";
import AssetLog from "@/models/AssetLog";
import { isRoomKey } from "@/models/Room";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function getImageValidationError(image: unknown): string | null {
  if (image === undefined || image === null || image === "") {
    return null;
  }
  if (typeof image !== "string") {
    return "The image is invalid.";
  }

  const match = image.match(
    /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]*={0,2})$/i
  );
  if (!match) {
    return "Choose a valid image file.";
  }

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.toString("base64") !== match[1]) {
    return "Choose a valid image file.";
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return "Asset image must be 3 MB or smaller.";
  }
  return null;
}

function getInitialConditionNotice(condition: string) {
  const normalized = condition.toLowerCase();
  if (normalized === "fair") {
    return { severity: "warning" as const, message: "Needs attention" };
  }
  if (normalized === "poor") {
    return {
      severity: "critical" as const,
      message: "Maintenance recommended",
    };
  }
  return { severity: "normal" as const, message: undefined };
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeRequest(req, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();

    const body = await req.json();

    const { uid, assetName, currentRoom, category, quantity, assetStatus, condition, description, image } = body;

    const newRoom = currentRoom === undefined ? "Outside" : currentRoom;
    if (typeof newRoom !== "string" || !isRoomKey(newRoom)) {
      return NextResponse.json(
        { message: "Location must be an existing room key: Room1 or Outside." },
        { status: 400 }
      );
    }

    const imageError = getImageValidationError(image);
    if (imageError) {
      return NextResponse.json({ message: imageError }, { status: 400 });
    }

    if (!uid || !assetName) {
      return NextResponse.json(
        { message: "UID and asset name are required" },
        { status: 400 }
      );
    }

    const existingTag = await RFIDTag.findOne({ uid });

    if (existingTag) {
      return NextResponse.json(
        { message: "RFID already registered" },
        { status: 409 }
      );
    }

    const newTag = await RFIDTag.create({
      uid,
      assetName,
      currentRoom: newRoom,
      category: category || "Furniture",
      quantity: quantity || 1,
      assetStatus: assetStatus || "active",
      condition: condition || "good",
      description: description || "",
      ...(image ? { image } : {}),
      dateRegistered: new Date().toISOString().split('T')[0],
      createdBy: {
        name: authorization.user.fullName,
        email: authorization.user.email,
      },
    });

    try {
      await AssetLog.create({
        assetId: String(newTag._id),
        tagId: newTag.uid,
        assetName: newTag.assetName,
        action: "CREATED",
        who: {
          name: authorization.user.fullName,
          email: authorization.user.email,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error writing asset creation log:", error);
    }

    const maintenanceNotice = getInitialConditionNotice(newTag.condition);
    await Notification.create({
      type: "asset_created",
      visibility: "admins",
      assetId: String(newTag._id),
      assetTagId: newTag.uid,
      assetName: newTag.assetName,
      actorName: authorization.user.fullName,
      actorEmail: authorization.user.email,
      message: `Registered ${newTag.assetName} by ${authorization.user.fullName}${
        maintenanceNotice.message ? ` — ${maintenanceNotice.message}` : ""
      }`,
      severity: maintenanceNotice.severity,
      maintenanceMessage: maintenanceNotice.message,
      conditionAtEvent: newTag.condition,
    });

    return NextResponse.json(
      {
        message: "RFID registered successfully",
        tag: newTag,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering RFID:", error);
    const errorMessage = error instanceof Error ? error.message : "Server error";
    return NextResponse.json(
      { message: `Failed to register RFID: ${errorMessage}` },
      { status: 500 }
    );
  }
}