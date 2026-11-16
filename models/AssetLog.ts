import mongoose from "mongoose";

const AssetLogSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: true,
    },
    tagId: {
      type: String,
      required: true,
    },
    assetName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ["CREATED", "EDITED", "DELETED"],
      required: true,
    },
    who: {
      name: { type: String, required: true },
      email: { type: String, required: true },
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    changedFields: [
      {
        field: { type: String, required: true },
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
      },
    ],
    pictureChanged: {
      type: Boolean,
      default: false,
    },
    oldPicture: String,
    pictureTooLarge: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

AssetLogSchema.index({ assetId: 1, timestamp: -1 });

const AssetLog =
  mongoose.models.AssetLog || mongoose.model("AssetLog", AssetLogSchema);

export default AssetLog;
