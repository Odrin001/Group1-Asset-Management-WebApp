import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import {
  createSessionToken,
  normalizeRole,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth";

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const { email, password } = await req.json();
    const normalizedEmail =
      typeof email === "string" ? email.trim() : "";
    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({
      email: new RegExp(`^${escapedEmail}$`, "i"),
    });

    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const match =
      typeof password === "string" &&
      (await bcrypt.compare(password, user.password));

    if (!match) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (user.status === "pending") {
      return NextResponse.json(
        { message: "Your account is waiting for approval by the System Administrator." },
        { status: 403 }
      );
    }

    if (user.status === "rejected") {
      return NextResponse.json(
        { message: "Your account has been rejected." },
        { status: 403 }
      );
    }

    const role = normalizeRole(user.role);
    const token = await createSessionToken({
      id: String(user._id),
      email: user.email,
      role,
    });

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          fullName: user.fullName,
          email: user.email,
          role,
        },
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Error logging in:", error);
    return NextResponse.json(
      { message: "Server error" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}