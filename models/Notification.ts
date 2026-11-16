import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "asset_created",
        "asset_edited",
        "asset_deleted",
        "account_registered",
        "asset_report",
        "asset_info_reports_cleared",
      ],
      required: true,
    },
    visibility: {
      type: String,
      enum: ["admins", "sysadmins"],
      required: true,
    },
    assetId: String,
    assetTagId: String,
    assetName: String,
    reportId: String,
    actorName: {
      type: String,
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ["normal", "notice", "warning", "critical"],
      default: "normal",
    },
    maintenanceMessage: String,
    conditionAtEvent: String,
    changedFields: [
      {
        field: { type: String, required: true },
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

NotificationSchema.index({ visibility: 1, createdAt: -1 });
NotificationSchema.index({ assetId: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);

export default Notification;
