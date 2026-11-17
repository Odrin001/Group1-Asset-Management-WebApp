import mongoose from "mongoose";

const PendingScanSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
  },
  scanner: {
    type: String,
    required: true,
    enum: ["inside", "outside"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

export default mongoose.models.PendingScan ||
  mongoose.model("PendingScan", PendingScanSchema);
