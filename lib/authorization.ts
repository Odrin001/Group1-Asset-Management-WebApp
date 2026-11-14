import { NextRequest, NextResponse } from "next/server";
import User from "@/models/User";
import { connectDB } from "@/lib/mongodb";
import {
  normalizeRole,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type UserRole,
} from "@/lib/auth";

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export type AuthorizationResult =
  | { authorized: true; user: AuthenticatedUser }
  | { authorized: false; response: NextResponse };

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  if (!payload?.sub) {
    return null;
  }

  await connectDB();
  const user = await User.findById(payload.sub).select(
    "fullName email role status"
  );

  if (!user || user.status === "pending" || user.status === "rejected") {
    return null;
  }

  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: normalizeRole(user.role),
  };
}

export async function authorizeRequest(
  request: NextRequest,
  allowedRoles: readonly UserRole[]
): Promise<AuthorizationResult> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    };
  }

  return { authorized: true, user };
}
