import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Notification from "@/models/Notification";

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

    const { fullName, email, password } = await req.json();

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !fullName.trim() ||
      !email.trim() ||
      !password
    ) {
      return NextResponse.json(
        { message: "All fields are required" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@sdca.edu.ph")) {
      return NextResponse.json(
        { message: "Use SDCA email only" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingUser = await User.findOne({
      email: new RegExp(`^${escapedEmail}$`, "i"),
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Email already registered" },
        {
          status: 409,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "guest",
      status: "pending",
    });

    await Notification.create({
      type: "account_registered",
      visibility: "sysadmins",
      actorName: fullName.trim(),
      actorEmail: normalizedEmail,
      message: `New account registration: ${fullName.trim()} (${normalizedEmail})`,
    });

    return NextResponse.json(
      {
        message: "Account created successfully. Your account is waiting for approval by the System Administrator.",
      },
      {
        status: 201,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error registering account:", error);
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