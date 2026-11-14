import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

const allowedRoles = new Set(["sysadmin", "admin", "guest"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeRequest(request, ["sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    const updates: { role?: string; status?: string } = {};
    const input = body as Record<string, unknown>;

    if (input.role !== undefined) {
      if (typeof input.role !== "string" || !allowedRoles.has(input.role)) {
        return NextResponse.json({ message: "Invalid role" }, { status: 400 });
      }
      updates.role = input.role;
    }

    if (input.status !== undefined) {
      if (input.status !== "active" && input.status !== "rejected") {
        return NextResponse.json({ message: "Invalid status" }, { status: 400 });
      }
      updates.status = input.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No changes provided" }, { status: 400 });
    }

    await connectDB();
    const { id } = await params;
    const target = await User.findById(id).select("role status");

    if (!target) {
      return NextResponse.json({ message: "Account not found" }, { status: 404 });
    }

    const removesActiveSysadmin =
      target.role === "sysadmin" &&
      ((updates.role !== undefined && updates.role !== "sysadmin") ||
        updates.status === "rejected");

    if (removesActiveSysadmin) {
      const otherActiveSysadmins = await User.countDocuments({
        _id: { $ne: target._id },
        role: "sysadmin",
        status: { $nin: ["pending", "rejected"] },
      });

      if (otherActiveSysadmins === 0) {
        return NextResponse.json(
          { message: "At least one active System Administrator must remain." },
          { status: 409 }
        );
      }
    }

    await User.updateOne({ _id: target._id }, { $set: updates });
    return NextResponse.json({ message: "Account updated successfully" });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
