import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { authorizeRequest } from "@/lib/authorization";
import {
  GUEST_REPORT_DAILY_LIMIT,
  getManilaDayRange,
  isAssetReportCondition,
  isAssetReportType,
} from "@/lib/asset-reports";
import { connectDB } from "@/lib/mongodb";
import AssetReport from "@/models/AssetReport";
import Notification from "@/models/Notification";
import RFIDTag from "@/models/RFIDTag";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    const reports = await AssetReport.find()
      .select("-picture")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Error fetching asset reports:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, [
      "guest",
      "admin",
      "sysadmin",
    ]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ message: "Invalid report data." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ message: "Invalid report data." }, { status: 400 });
    }
    const assetId = typeof body.assetId === "string" ? body.assetId : "";
    const type = body.type;
    if (body.title !== undefined && typeof body.title !== "string") {
      return NextResponse.json({ message: "Title must be text." }, { status: 400 });
    }
    if (
      body.suggestedCondition !== undefined &&
      body.suggestedCondition !== "" &&
      !isAssetReportCondition(body.suggestedCondition)
    ) {
      return NextResponse.json({ message: "Suggested condition must be text." }, { status: 400 });
    }
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const suggestedCondition =
      isAssetReportCondition(body.suggestedCondition)
        ? body.suggestedCondition
        : undefined;
    const details = typeof body.details === "string" ? body.details.trim() : "";
    const picture = body.picture;

    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return NextResponse.json({ message: "Select a valid asset." }, { status: 400 });
    }
    if (!isAssetReportType(type)) {
      return NextResponse.json({ message: "Select a valid report type." }, { status: 400 });
    }
    if (title.length > 80) {
      return NextResponse.json({ message: "Title must be 80 characters or fewer." }, { status: 400 });
    }
    if (
      suggestedCondition !== undefined &&
      !isAssetReportCondition(suggestedCondition)
    ) {
      return NextResponse.json({ message: "Select a valid suggested condition." }, { status: 400 });
    }
    if (!details || details.length > 1000) {
      return NextResponse.json({ message: "Details are required and must be 1000 characters or fewer." }, { status: 400 });
    }
    if (picture !== undefined && typeof picture !== "string") {
      return NextResponse.json({ message: "The picture is invalid." }, { status: 400 });
    }
    if (typeof picture === "string") {
      const pictureMatch = picture.match(
        /^data:image\/(?:png|jpe?g|gif|webp);base64,([A-Za-z0-9+/]*={0,2})$/i
      );
      if (!pictureMatch) {
        return NextResponse.json({ message: "Choose a valid image file." }, { status: 400 });
      }
      const pictureBytes = Buffer.from(pictureMatch[1], "base64");
      if (pictureBytes.toString("base64") !== pictureMatch[1]) {
        return NextResponse.json({ message: "Choose a valid image file." }, { status: 400 });
      }
      if (pictureBytes.byteLength > 2 * 1024 * 1024) {
        return NextResponse.json({ message: "Picture must be 2 MB or smaller." }, { status: 400 });
      }
    }

    await connectDB();

    if (authorization.user.role === "guest") {
      const { start, end } = getManilaDayRange();
      const reportsToday = await AssetReport.countDocuments({
        "reporter.id": authorization.user.id,
        createdAt: { $gte: start, $lt: end },
      });
      if (reportsToday >= GUEST_REPORT_DAILY_LIMIT) {
        return NextResponse.json(
          {
            message:
              "You've reached the limit of 5 reports today. Try again tomorrow.",
          },
          { status: 429 }
        );
      }
    }

    const asset = await RFIDTag.findById(assetId).select("assetName uid");
    if (!asset) {
      return NextResponse.json({ message: "The selected asset no longer exists." }, { status: 404 });
    }

    const report = await AssetReport.create({
      assetId: asset._id,
      assetName: asset.assetName,
      tagId: asset.uid,
      type,
      ...(title ? { title } : {}),
      ...(suggestedCondition ? { suggestedCondition } : {}),
      details,
      ...(picture ? { picture } : {}),
      reporter: {
        id: authorization.user.id,
        name: authorization.user.fullName,
        email: authorization.user.email,
      },
    });

    try {
      await Notification.create({
        type: "asset_report",
        visibility: "admins",
        assetId: String(asset._id),
        assetTagId: asset.uid,
        assetName: asset.assetName,
        reportId: String(report._id),
        actorName: authorization.user.fullName,
        actorEmail: authorization.user.email,
        message: `Report: ${type} — ${asset.assetName}, by ${authorization.user.fullName}`,
        severity: "notice",
      });
    } catch (error) {
      console.error("Error creating asset report notification:", error);
    }

    return NextResponse.json(
      { message: "Asset report submitted.", reportId: String(report._id) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating asset report:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();
    const result = await AssetReport.deleteMany({});
    const clearedAt = new Date();
    await Notification.create({
      type: "asset_info_reports_cleared",
      visibility: "sysadmins",
      actorName: authorization.user.fullName,
      actorEmail: authorization.user.email,
      message: `All asset info reports were cleared by ${
        authorization.user.fullName
      } on ${clearedAt.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
      })}`,
      createdAt: clearedAt,
    });

    return NextResponse.json({
      message: "All asset info reports cleared.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing asset info reports:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
