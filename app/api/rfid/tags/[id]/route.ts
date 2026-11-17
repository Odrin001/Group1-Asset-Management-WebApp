import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import RFIDTag from "@/models/RFIDTag";
import { authorizeRequest } from "@/lib/authorization";
import Notification from "@/models/Notification";
import AssetLog from "@/models/AssetLog";
import { isRoomKey } from "@/models/Room";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function getImageValidationError(image: unknown): string | null {
  if (image === undefined || image === null || image === "") {
    return null;
  }
  if (typeof image !== "string") {
    return "The image is invalid.";
  }

  const match = image.match(
    /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]*={0,2})$/i
  );
  if (!match) {
    return "Choose a valid image file.";
  }

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.toString("base64") !== match[1]) {
    return "Choose a valid image file.";
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return "Asset image must be 3 MB or smaller.";
  }
  return null;
}

const CONDITION_LEVELS: Record<string, number> = {
  new: 0,
  good: 0,
  fair: 1,
  poor: 2,
};

function conditionLevel(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  return CONDITION_LEVELS[value.toLowerCase()] ?? null;
}

function notificationValue(field: string, value: unknown) {
  if (
    field === "image" &&
    typeof value === "string" &&
    value.length > 3 * 1024 * 1024
  ) {
    return {
      omitted: true,
      reason: "Large image value omitted from notification",
      sizeCharacters: value.length,
    };
  }

  return value ?? null;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeRequest(_request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();

    const { id } = await params;

    const deletedTag = await RFIDTag.findByIdAndDelete(id);

    if (!deletedTag) {
      return NextResponse.json(
        { message: "RFID tag not found" },
        { status: 404 }
      );
    }

    try {
      await AssetLog.create({
        assetId: String(deletedTag._id),
        tagId: deletedTag.uid,
        assetName: deletedTag.assetName,
        action: "DELETED",
        who: {
          name: authorization.user.fullName,
          email: authorization.user.email,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error writing asset deletion log:", error);
    }

    await Notification.create({
      type: "asset_deleted",
      visibility: "admins",
      assetId: String(deletedTag._id),
      assetTagId: deletedTag.uid,
      assetName: deletedTag.assetName,
      actorName: authorization.user.fullName,
      actorEmail: authorization.user.email,
      message: `Deleted ${deletedTag.assetName} by ${authorization.user.fullName}`,
      conditionAtEvent: deletedTag.condition,
    });

    return NextResponse.json(
      { message: "RFID tag deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting RFID tag:", error);

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeRequest(request, ["admin", "sysadmin"]);
    if (!authorization.authorized) {
      return authorization.response;
    }

    await connectDB();

    const { id } = await params;

    const body = await request.json();
    const imageError = getImageValidationError(body.image);
    if (imageError) {
      return NextResponse.json({ message: imageError }, { status: 400 });
    }

    const existingTag = await RFIDTag.findById(id);

    if (!existingTag) {
      return NextResponse.json(
        { message: "RFID tag not found" },
        { status: 404 }
      );
    }

    const locationChanged =
      body.location !== undefined &&
      body.location !== existingTag.currentRoom;
    if (
      locationChanged &&
      (typeof body.location !== "string" || !isRoomKey(body.location))
    ) {
      return NextResponse.json(
        { message: "Location must be an existing room key: Room1 or Outside." },
        { status: 400 }
      );
    }

    const update = {
      assetName: body.name,
      category: body.category,
      currentRoom: body.location,
      quantity: body.quantity,
      assetStatus: body.assetStatus,
      condition: body.condition,
      description: body.description,
      ...(typeof body.image === "string" ? { image: body.image } : {}),
    };

    const fieldUpdates: Array<[string, unknown, unknown]> = [
      ["assetName", existingTag.assetName, update.assetName],
      ["category", existingTag.category, update.category],
      ["currentRoom", existingTag.currentRoom, update.currentRoom],
      ["quantity", existingTag.quantity, update.quantity],
      ["assetStatus", existingTag.assetStatus, update.assetStatus],
      ["condition", existingTag.condition, update.condition],
      ["description", existingTag.description, update.description],
    ];
    if (typeof body.image === "string") {
      fieldUpdates.push(["image", existingTag.image, body.image]);
    }

    const changedFields = fieldUpdates
      .filter(
        ([, oldValue, newValue]) =>
          newValue !== undefined && String(oldValue ?? "") !== String(newValue ?? "")
      )
      .map(([field, oldValue, newValue]) => ({
        field,
        oldValue: notificationValue(field, oldValue),
        newValue: notificationValue(field, newValue),
      }));

    const updatedTag = await RFIDTag.findByIdAndUpdate(
      id,
      {
        ...update,
        ...(changedFields.length > 0
          ? {
              lastEditedAt: new Date(),
              lastEditedBy: {
                name: authorization.user.fullName,
                email: authorization.user.email,
              },
            }
          : {}),
      },
      { new: true }
    );

    if (!updatedTag) {
      return NextResponse.json(
        { message: "RFID tag not found" },
        { status: 404 }
      );
    }

    if (changedFields.length > 0) {
      const fieldNames: Record<string, string> = {
        assetName: "name",
        category: "category",
        currentRoom: "location",
        quantity: "quantity",
        assetStatus: "status",
        condition: "condition",
        description: "description",
      };
      const imageChanged = changedFields.some(
        (change) => change.field === "image"
      );
      const previousImage =
        imageChanged && typeof existingTag.image === "string"
          ? existingTag.image
          : "";
      const previousImageTooLarge =
        new TextEncoder().encode(previousImage).byteLength > 3 * 1024 * 1024;
      const newImageTooLarge =
        typeof body.image === "string" &&
        new TextEncoder().encode(body.image).byteLength > 3 * 1024 * 1024;
      const pictureTooLarge =
        imageChanged && (previousImageTooLarge || newImageTooLarge);

      try {
        await AssetLog.create({
          assetId: String(updatedTag._id),
          tagId: updatedTag.uid,
          assetName: updatedTag.assetName,
          action: "EDITED",
          who: {
            name: authorization.user.fullName,
            email: authorization.user.email,
          },
          timestamp: new Date(),
          changedFields: changedFields
            .filter((change) => change.field !== "image")
            .map((change) => ({
              field: fieldNames[change.field] || change.field,
              oldValue: change.oldValue,
              newValue: change.newValue,
            })),
          pictureChanged: imageChanged,
          ...(!previousImageTooLarge && previousImage
            ? { oldPicture: previousImage }
            : {}),
          pictureTooLarge,
        });
      } catch (error) {
        console.error("Error writing asset edit log:", error);
      }

      let severity: "normal" | "warning" | "critical" = "normal";
      let maintenanceMessage: string | undefined;
      const conditionChange = changedFields.find(
        (change) => change.field === "condition"
      );
      const oldConditionLevel = conditionChange
        ? conditionLevel(existingTag.condition)
        : null;
      const newConditionLevel = conditionChange
        ? conditionLevel(updatedTag.condition)
        : null;

      if (
        conditionChange &&
        oldConditionLevel !== null &&
        newConditionLevel !== null &&
        newConditionLevel > oldConditionLevel
      ) {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const recentConditionNotifications = await Notification.find({
          type: "asset_edited",
          assetId: String(existingTag._id),
          createdAt: { $gte: since },
          "changedFields.field": "condition",
        })
          .sort({ createdAt: 1 })
          .select("changedFields")
          .lean();

        const transitions: Array<{ oldLevel: number; newLevel: number }> = [];
        for (const notification of recentConditionNotifications) {
          const change = notification.changedFields.find(
            (field: { field: string; oldValue: unknown; newValue: unknown }) =>
              field.field === "condition"
          );
          const oldLevel = conditionLevel(change?.oldValue);
          const newLevel = conditionLevel(change?.newValue);
          if (oldLevel !== null && newLevel !== null) {
            transitions.push({ oldLevel, newLevel });
          }
        }
        transitions.push({
          oldLevel: oldConditionLevel,
          newLevel: newConditionLevel,
        });

        let deteriorationBaseline = transitions[0].oldLevel;
        let rapidDeterioration = false;
        for (const transition of transitions) {
          if (transition.newLevel < transition.oldLevel) {
            deteriorationBaseline = transition.newLevel;
          } else if (
            transition.newLevel > transition.oldLevel &&
            transition.newLevel - deteriorationBaseline >= 2
          ) {
            rapidDeterioration = true;
          }
        }

        if (rapidDeterioration) {
          severity = "critical";
          maintenanceMessage =
            newConditionLevel === 2
              ? "Rapid deterioration — Maintenance recommended"
              : "Rapid deterioration";
        } else if (newConditionLevel === 2) {
          severity = "critical";
          maintenanceMessage = "Maintenance recommended";
        } else {
          severity = "warning";
          maintenanceMessage = "Needs attention";
        }
      }

      await Notification.create({
        type: "asset_edited",
        visibility: "admins",
        assetId: String(updatedTag._id),
        assetTagId: updatedTag.uid,
        assetName: updatedTag.assetName,
        actorName: authorization.user.fullName,
        actorEmail: authorization.user.email,
        message: `Edited ${updatedTag.assetName} by ${authorization.user.fullName}${
          maintenanceMessage ? ` — ${maintenanceMessage}` : ""
        }`,
        severity,
        maintenanceMessage,
        conditionAtEvent: updatedTag.condition,
        changedFields,
      });
    }

    return NextResponse.json(
      {
        message: "RFID tag updated successfully",
        updatedTag,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating RFID tag:", error);

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}