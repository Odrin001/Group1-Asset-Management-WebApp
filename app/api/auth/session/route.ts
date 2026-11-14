import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error reading the current session:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
