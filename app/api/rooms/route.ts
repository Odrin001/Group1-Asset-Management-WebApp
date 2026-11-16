import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import { connectDB } from "@/lib/mongodb";
import RFIDTag from "@/models/RFIDTag";
import Room, { ensureRoomDocuments, ROOM_CONFIGS } from "@/models/Room";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    await ensureRoomDocuments();

    const rooms = await Promise.all(
      ROOM_CONFIGS.map(async (config) => {
        const [room, assetCount] = await Promise.all([
          Room.findOne({ key: config.key }).lean(),
          RFIDTag.countDocuments({ currentRoom: config.key }),
        ]);

        return {
          key: config.key,
          displayName: room?.displayName || config.key,
          scanner: config.scanner,
          location: config.location,
          assetCount,
        };
      })
    );

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
