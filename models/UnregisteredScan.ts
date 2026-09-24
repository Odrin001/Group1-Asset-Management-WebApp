import mongoose from "mongoose";

const UnregisteredScanSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
    },
    scanner: {
      type: String,
      required: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.models.UnregisteredScan ||
  mongoose.model("UnregisteredScan", UnregisteredScanSchema);