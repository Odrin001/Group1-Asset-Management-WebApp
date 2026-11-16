import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import AccountLog from "@/models/AccountLog";

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
      if (
        input.status !== "active" &&
        input.status !== "rejected" &&
        input.status !== "pending"
      ) {
        return NextResponse.json({ message: "Invalid status" }, { status: 400 });
      }
      updates.status = input.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No changes provided" }, { status: 400 });
    }

    await connectDB();
    const { id } = await params;
    const target = await User.findById(id).select(
      "fullName email role status"
    );

    if (!target) {
      return NextResponse.json({ message: "Account not found" }, { status: 404 });
    }

    const oldStatus = target.status || "active";
    const roleChanged =
      updates.role !== undefined && updates.role !== target.role;
    const statusChanged =
      updates.status !== undefined && updates.status !== oldStatus;

    if (
      roleChanged &&
      String(target._id) === authorization.user.id
    ) {
      return NextResponse.json(
        { message: "You cannot change your own role." },
        { status: 403 }
      );
    }

    const removesActiveSysadmin =
      target.role === "sysadmin" &&
      oldStatus !== "pending" &&
      oldStatus !== "rejected" &&
      ((roleChanged && updates.role !== "sysadmin") ||
        (statusChanged &&
          (updates.status === "rejected" || updates.status === "pending")));

    if (removesActiveSysadmin) {
      const otherActiveSysadmins = await User.countDocuments({
        _id: { $ne: target._id },
        role: "sysadmin",
        status: { $nin: ["pending", "rejected"] },
      });

      if (otherActiveSysadmins === 0) {
        return NextResponse.json(
          {
            message:
              "This change would remove the last active System Administrator. Promote or activate another System Administrator first.",
          },
          { status: 409 }
        );
      }
    }

    await User.updateOne({ _id: target._id }, { $set: updates });

    const logEntries = [];
    if (roleChanged) {
      logEntries.push({
        accountId: String(target._id),
        accountName: target.fullName,
        accountEmail: target.email,
        action: "ROLE_CHANGED",
        who: {
          name: authorization.user.fullName,
          email: authorization.user.email,
        },
        timestamp: new Date(),
        field: "role",
        oldValue: target.role,
        newValue: updates.role,
      });
    }
    if (statusChanged) {
      logEntries.push({
        accountId: String(target._id),
        accountName: target.fullName,
        accountEmail: target.email,
        action:
          updates.status === "active"
            ? "APPROVED"
            : updates.status === "rejected"
              ? "REJECTED"
              : "STATUS_CHANGED",
        who: {
          name: authorization.user.fullName,
          email: authorization.user.email,
        },
        timestamp: new Date(),
        field: "status",
        oldValue: oldStatus,
        newValue: updates.status,
      });
    }
    if (logEntries.length > 0) {
      try {
        await AccountLog.create(logEntries);
      } catch (error) {
        console.error("Error writing account change log:", error);
      }
    }

    return NextResponse.json({ message: "Account updated successfully" });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
