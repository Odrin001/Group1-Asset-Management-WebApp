import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import type { UserRole } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Notification from "@/models/Notification";

function visibleNotificationsFor(role: UserRole) {
  return role === "sysadmin"
    ? { visibility: { $in: ["admins", "sysadmins"] } }
    : { visibility: "admins" };
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    const visibilityFilter = visibleNotificationsFor(authorization.user.role);
    const filter = { ...visibilityFilter };
    const unreadFilter = {
      ...visibilityFilter,
      readBy: { $ne: authorization.user.id },
    };

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(20)
        .select("-changedFields")
        .lean(),
      Notification.countDocuments(unreadFilter),
    ]);

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        ...notification,
        _id: String(notification._id),
        isRead: notification.readBy.some(
          (userId: unknown) => String(userId) === authorization.user.id
        ),
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    await Notification.updateMany(
      {
        ...visibleNotificationsFor(authorization.user.role),
        readBy: { $ne: authorization.user.id },
      },
      { $addToSet: { readBy: authorization.user.id } }
    );

    return NextResponse.json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
