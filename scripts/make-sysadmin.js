const mongoose = require("mongoose");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    throw new Error("Usage: node scripts/make-sysadmin.js <email>");
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI must be set in the environment or .env.local");
  }

  await mongoose.connect(mongoUri);
  const userSchema = new mongoose.Schema(
    { email: String, role: String, status: String },
    { collection: "users", strict: false }
  );
  const User = mongoose.models.User || mongoose.model("User", userSchema);
  const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const user = await User.findOneAndUpdate(
    { email: new RegExp(`^${escapedEmail}$`, "i") },
    { $set: { role: "sysadmin", status: "active" } },
    { new: true }
  ).select("email role status");

  if (!user) {
    throw new Error(`No account found for ${email}`);
  }

  console.log(`Updated ${user.email} to ${user.role} (${user.status})`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
