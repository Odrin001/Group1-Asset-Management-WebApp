import mongoose from "mongoose";

export const ROOM_CONFIGS = [
  { key: "Room1", scanner: "COM5", location: "Inside" },
  { key: "Outside", scanner: "COM6", location: "Outside" },
] as const;

export type RoomKey = (typeof ROOM_CONFIGS)[number]["key"];

const RoomSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: ROOM_CONFIGS.map((room) => room.key),
    required: true,
    unique: true,
    immutable: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40,
  },
});

const Room = mongoose.models.Room || mongoose.model("Room", RoomSchema);

export async function ensureRoomDocuments() {
  await Promise.all(
    ROOM_CONFIGS.map(({ key }) =>
      Room.updateOne(
        { key },
        { $setOnInsert: { displayName: key } },
        { upsert: true }
      )
    )
  );
}

export function isRoomKey(key: string): key is RoomKey {
  return ROOM_CONFIGS.some((room) => room.key === key);
}

export default Room;
