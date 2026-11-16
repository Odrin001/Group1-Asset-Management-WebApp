import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/authorization";
import { connectDB } from "@/lib/mongodb";
import AssetLog from "@/models/AssetLog";
import RFIDTag from "@/models/RFIDTag";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();

    const assetId = request.nextUrl.searchParams.get("assetId");
    if (assetId) {
      const logs = await AssetLog.find({ assetId })
        .sort({ timestamp: -1 })
        .select(
          "assetId tagId assetName action who timestamp changedFields pictureChanged oldPicture pictureTooLarge"
        )
        .lean();

      return NextResponse.json({
        logs: logs.map((log) => ({
          ...log,
          _id: String(log._id),
        })),
      });
    }

    const [tags, logs] = await Promise.all([
      RFIDTag.find()
        .select(
          "assetName uid dateRegistered createdAt createdBy lastEditedAt lastEditedBy"
        )
        .lean(),
      AssetLog.find()
        .sort({ timestamp: -1 })
        .select("assetId tagId assetName action who timestamp")
        .lean(),
    ]);

    type LogSummary = (typeof logs)[number];
    const logsByAsset = new Map<string, LogSummary[]>();
    for (const log of logs) {
      const groupedLogs = logsByAsset.get(log.assetId) || [];
      groupedLogs.push(log);
      logsByAsset.set(log.assetId, groupedLogs);
    }

    type AssetSummary = {
      id: string;
      name: string;
      tagId: string;
      createdAt: string | Date | null;
      createdBy: { name?: string; email?: string } | null;
      lastEditedAt: string | Date | null;
      lastEditedBy: { name?: string; email?: string } | null;
      editors: Array<{ name: string; email: string }>;
      activityDates: Array<string | Date>;
      deleted: boolean;
    };

    const assetsById = new Map<string, AssetSummary>();
    for (const tag of tags) {
      const id = String(tag._id);
      const assetLogs = logsByAsset.get(id) || [];
      const creationLog = assetLogs.find((log) => log.action === "CREATED");
      const latestEdit = assetLogs.find((log) => log.action === "EDITED");

      assetsById.set(id, {
        id,
        name: tag.assetName,
        tagId: tag.uid,
        createdAt: tag.dateRegistered || tag.createdAt || null,
        createdBy: tag.createdBy || creationLog?.who || null,
        lastEditedAt: tag.lastEditedAt || latestEdit?.timestamp || null,
        lastEditedBy: tag.lastEditedBy || latestEdit?.who || null,
        editors: [
          ...assetLogs.map((log) => log.who),
          ...(tag.createdBy
            ? [
                {
                  name: tag.createdBy.name || "",
                  email: tag.createdBy.email || "",
                },
              ]
            : []),
          ...(tag.lastEditedBy
            ? [
                {
                  name: tag.lastEditedBy.name || "",
                  email: tag.lastEditedBy.email || "",
                },
              ]
            : []),
        ],
        activityDates: [
          ...(assetLogs.map((log) => log.timestamp) || []),
          ...(tag.createdAt ? [tag.createdAt] : []),
        ],
        deleted: false,
      });
    }

    for (const [id, assetLogs] of logsByAsset) {
      if (assetsById.has(id)) {
        continue;
      }

      const creationLog = assetLogs.find((log) => log.action === "CREATED");
      const latestEdit = assetLogs.find((log) => log.action === "EDITED");
      const latestLog = assetLogs[0];
      assetsById.set(id, {
        id,
        name: latestLog.assetName,
        tagId: latestLog.tagId,
        createdAt: creationLog?.timestamp || null,
        createdBy: creationLog?.who || null,
        lastEditedAt: latestEdit?.timestamp || null,
        lastEditedBy: latestEdit?.who || null,
        editors: assetLogs.map((log) => log.who),
        activityDates: assetLogs.map((log) => log.timestamp),
        deleted: assetLogs.some((log) => log.action === "DELETED"),
      });
    }

    return NextResponse.json({
      assets: Array.from(assetsById.values()),
    });
  } catch (error) {
    console.error("Error fetching asset edit logs:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
