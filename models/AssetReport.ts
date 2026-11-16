import mongoose from "mongoose";
import {
  ASSET_REPORT_CONDITIONS,
  ASSET_REPORT_STATUSES,
  ASSET_REPORT_TYPES,
} from "@/lib/asset-reports";

const AssetReportSchema = new mongoose.Schema(
  {
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFIDTag",
      required: true,
    },
    assetName: { type: String, required: true },
    tagId: { type: String, required: true },
    type: { type: String, enum: ASSET_REPORT_TYPES, required: true },
    title: { type: String, maxlength: 80 },
    suggestedCondition: { type: String, enum: ASSET_REPORT_CONDITIONS },
    details: { type: String, required: true, maxlength: 1000 },
    picture: String,
    reporter: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: { type: String, required: true },
      email: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ASSET_REPORT_STATUSES,
      default: "open",
      required: true,
    },
    resolutionNote: { type: String, default: "" },
    handledBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      email: String,
    },
    handledAt: Date,
  },
  { timestamps: true }
);

AssetReportSchema.index({ createdAt: -1 });
AssetReportSchema.index({ "reporter.id": 1, createdAt: -1 });
AssetReportSchema.index({ assetId: 1, createdAt: -1 });

const AssetReport =
  mongoose.models.AssetReport ||
  mongoose.model("AssetReport", AssetReportSchema);

export default AssetReport;
