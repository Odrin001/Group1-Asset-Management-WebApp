import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import { connectDB } from "@/lib/mongodb";
import RFIDTag from "@/models/RFIDTag";
import Room, {
  ensureRoomDocuments,
  isRoomKey,
  ROOM_CONFIGS,
  type RoomKey,
} from "@/models/Room";
import ScanLog from "@/models/ScanLog";

type RouteContext = { params: Promise<{ key: string }> };

type AssetRecord = {
  _id: { toString(): string };
  assetName: string;
  uid: string;
  category?: string;
  currentRoom?: string;
  assetStatus?: string;
  condition?: string;
  description?: string;
  image?: string;
  quantity?: number;
  dateRegistered?: string;
  createdAt?: Date;
  createdBy?: { name?: string; email?: string };
  lastEditedAt?: Date;
  lastEditedBy?: { name?: string; email?: string };
};

type ScanMovementRecord = {
  uid: string;
  action: string;
  createdAt: Date;
};

type ScanMovementGroup = {
  _id: string;
  log: ScanMovementRecord;
};

type ScanMovementAggregation = {
  enter: ScanMovementGroup[];
  exit: ScanMovementGroup[];
};

function toAssetDetails(
  asset: AssetRecord,
  roomNames: Map<string, string>
) {
  return {
    id: String(asset._id),
    name: asset.assetName,
    rfidUid: asset.uid,
    category: asset.category || "",
    location: roomNames.get(asset.currentRoom || "") || asset.currentRoom || "",
    assetStatus: asset.assetStatus || "active",
    condition: asset.condition || "good",
    description: asset.description || "",
    image: asset.image || "",
    quantity: asset.quantity || 1,
    dateCreated: asset.dateRegistered || asset.createdAt || null,
    lastEditedAt: asset.lastEditedAt || null,
    lastEditedBy: asset.lastEditedBy || null,
    createdBy: asset.createdBy || null,
  };
}

function assetMovement(
  log: ScanMovementRecord | undefined,
  roomKey: RoomKey,
  roomNames: Map<string, string>
) {
  if (!log) {
    return null;
  }

  const insideName = roomNames.get("Room1") || "Room1";
  const outsideName = roomNames.get("Outside") || "Outside";

  return {
    time: log.createdAt,
    movement:
      log.action === "ENTER"
        ? `Entered: ${outsideName} → ${insideName}`
        : `Exited: ${insideName} → ${outsideName}`,
    room: roomKey,
  };
}

async function getLastMovement(
  filter: { action: string; fromRoom?: string; toRoom?: string },
  roomKey: string,
  roomNames: Map<string, string>
) {
  const log = await ScanLog.findOne(filter).sort({ createdAt: -1 }).lean();
  if (!log) {
    return null;
  }

  const tag = log.uid
    ? await RFIDTag.findOne({ uid: log.uid })
        .select(
          "assetName uid category currentRoom assetStatus condition description image quantity dateRegistered createdAt createdBy lastEditedAt lastEditedBy"
        )
        .lean()
    : null;

  return {
    assetName: tag ? log.assetName || tag.assetName : "Deleted asset",
    asset: tag ? toAssetDetails(tag, roomNames) : null,
    time: log.createdAt,
    direction: log.action,
    room: roomNames.get(roomKey) || roomKey,
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    await ensureRoomDocuments();

    const { key } = await params;
    if (!isRoomKey(key)) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    const config = ROOM_CONFIGS.find((room) => room.key === key);
    const [rooms, assets] = await Promise.all([
      Room.find({ key: { $in: ROOM_CONFIGS.map((room) => room.key) } }).lean(),
      RFIDTag.find({ currentRoom: key })
        .select(
          "assetName uid category currentRoom assetStatus condition description image quantity dateRegistered createdAt createdBy lastEditedAt lastEditedBy"
        )
        .sort({ assetName: 1 })
        .lean(),
    ]);
    const roomNames = new Map(rooms.map((room) => [room.key, room.displayName]));
    const room = rooms.find((item) => item.key === key);

    if (!room || !config) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    const lastInFilter =
      key === "Room1"
        ? { action: "ENTER", toRoom: "Room1" }
        : { action: "EXIT", fromRoom: "Room1" };
    const lastOutFilter =
      key === "Room1"
        ? { action: "EXIT", fromRoom: "Room1" }
        : { action: "ENTER", toRoom: "Room1" };

    const [lastItemIn, lastItemOut, scanMovements] = await Promise.all([
      getLastMovement(lastInFilter, key, roomNames),
      getLastMovement(lastOutFilter, key, roomNames),
      ScanLog.aggregate<ScanMovementAggregation>([
        {
          $match: {
            uid: { $in: assets.map((asset) => asset.uid) },
            action: { $in: ["ENTER", "EXIT"] },
          },
        },
        {
          $facet: {
            enter: [
              { $match: { action: "ENTER" } },
              { $sort: { createdAt: -1, _id: -1 } },
              { $group: { _id: "$uid", log: { $first: "$$ROOT" } } },
            ],
            exit: [
              { $match: { action: "EXIT" } },
              { $sort: { createdAt: -1, _id: -1 } },
              { $group: { _id: "$uid", log: { $first: "$$ROOT" } } },
            ],
          },
        },
      ]),
    ]);

    const movements = scanMovements[0];
    const enterByUid = new Map(
      movements?.enter.map(({ _id, log }) => [_id, log] as const) || []
    );
    const exitByUid = new Map(
      movements?.exit.map(({ _id, log }) => [_id, log] as const) || []
    );

    return NextResponse.json({
      room: {
        key,
        displayName: room.displayName,
        scanner: config.scanner,
        location: config.location,
      },
      assets: assets.map((asset) => ({
        ...toAssetDetails(asset, roomNames),
        tagId: asset.uid,
        lastIn: assetMovement(
          key === "Room1"
            ? enterByUid.get(asset.uid)
            : exitByUid.get(asset.uid),
          key,
          roomNames
        ),
        lastOut: assetMovement(
          key === "Room1"
            ? exitByUid.get(asset.uid)
            : enterByUid.get(asset.uid),
          key,
          roomNames
        ),
      })),
      lastItemIn,
      lastItemOut,
    });
  } catch (error) {
    console.error("Error fetching room details:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const authorization = await authorizeRequest(request, ["sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    await ensureRoomDocuments();

    const { key } = await params;
    if (!isRoomKey(key)) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    const body = await request.json();
    if (typeof body.displayName !== "string") {
      return NextResponse.json(
        { message: "Room display name is required" },
        { status: 400 }
      );
    }

    const displayName = body.displayName.trim();
    if (!displayName || displayName.length > 40) {
      return NextResponse.json(
        { message: "Room display name must be 1 to 40 characters" },
        { status: 400 }
      );
    }

    const room = await Room.findOneAndUpdate(
      { key },
      { $set: { displayName } },
      { new: true, runValidators: true }
    ).lean();

    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({
      room: {
        key,
        displayName: room.displayName,
        scanner: ROOM_CONFIGS.find((config) => config.key === key)?.scanner,
      },
    });
  } catch (error) {
    console.error("Error updating room display name:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
