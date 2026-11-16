import mongoose from "mongoose";

const AccountLogSchema = new mongoose.Schema(
  {
    accountId: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    accountEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: [
        "REGISTERED",
        "APPROVED",
        "REJECTED",
        "ROLE_CHANGED",
        "STATUS_CHANGED",
      ],
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
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

AccountLogSchema.index({ accountId: 1, timestamp: -1 });
AccountLogSchema.index({ timestamp: -1 });

const AccountLog =
  mongoose.models.AccountLog ||
  mongoose.model("AccountLog", AccountLogSchema);

export default AccountLog;
