import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { JWTPayload } from "jose";

export const SESSION_COOKIE_NAME = "asset-session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export type UserRole = "sysadmin" | "admin" | "guest";

export function normalizeRole(role: unknown): UserRole {
  if (role === "sysadmin" || role === "admin") {
    return role;
  }

  return "guest";
}

function getSessionSecret(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "sdca-asset-management-development-session-secret-do-not-use-in-production"
      : undefined);

  if (!secret) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: {
  id: string;
  email: string;
  role: unknown;
}): Promise<string> {
  return new SignJWT({
    email: user.email,
    role: normalizeRole(user.role),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("sdca-asset-management")
    .setAudience("sdca-asset-management")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string
): Promise<JWTPayload | null> {
  const secret = getSessionSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: "sdca-asset-management",
      audience: "sdca-asset-management",
    });

    return payload;
  } catch {
    return null;
  }
}
