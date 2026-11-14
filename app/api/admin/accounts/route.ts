import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import { normalizeRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    const users = await User.find()
      .select("fullName email role status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        role: normalizeRole(user.role),
        status: user.status || "active",
      })),
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
