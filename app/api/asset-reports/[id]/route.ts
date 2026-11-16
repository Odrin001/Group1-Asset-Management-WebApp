import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { authorizeRequest } from "@/lib/authorization";
import {
  ASSET_REPORT_STATUSES,
  isAssetReportStatus,
} from "@/lib/asset-reports";
import { connectDB } from "@/lib/mongodb";
import AssetReport from "@/models/AssetReport";
import RFIDTag from "@/models/RFIDTag";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Asset report not found." }, { status: 404 });
    }

    await connectDB();
    const report = await AssetReport.findById(id).lean();
    if (!report) {
      return NextResponse.json({ message: "Asset report not found." }, { status: 404 });
    }
    const asset = await RFIDTag.findById(report.assetId)
      .select("assetName uid category currentRoom quantity assetStatus condition description dateRegistered createdAt lastEditedAt lastEditedBy")
      .lean();

    return NextResponse.json({ report, asset });
  } catch (error) {
    console.error("Error fetching asset report:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Asset report not found." }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ message: "Invalid report update." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ message: "Invalid report update." }, { status: 400 });
    }
    const update: {
      status?: (typeof ASSET_REPORT_STATUSES)[number];
      resolutionNote?: string;
      handledBy: { id: string; name: string; email: string };
      handledAt: Date;
    } = {
      handledBy: {
        id: authorization.user.id,
        name: authorization.user.fullName,
        email: authorization.user.email,
      },
      handledAt: new Date(),
    };

    if (body.status !== undefined) {
      if (!isAssetReportStatus(body.status)) {
        return NextResponse.json({ message: "Select a valid status." }, { status: 400 });
      }
      update.status = body.status;
    }
    if (body.resolutionNote !== undefined) {
      if (typeof body.resolutionNote !== "string" || body.resolutionNote.length > 1000) {
        return NextResponse.json({ message: "Resolution note must be 1000 characters or fewer." }, { status: 400 });
      }
      update.resolutionNote = body.resolutionNote.trim();
    }
    if (update.status === undefined && update.resolutionNote === undefined) {
      return NextResponse.json({ message: "No report changes were provided." }, { status: 400 });
    }

    await connectDB();
    const report = await AssetReport.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!report) {
      return NextResponse.json({ message: "Asset report not found." }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error updating asset report:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
