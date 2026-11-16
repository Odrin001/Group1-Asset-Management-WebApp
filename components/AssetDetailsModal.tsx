"use client";

import { useState } from "react";

type Person = {
  name?: string;
  email?: string;
} | null;

export type AssetDetails = {
  id: string;
  name: string;
  rfidUid: string;
  category: string;
  location: string;
  assetStatus: string;
  condition: string;
  description: string;
  image: string;
  quantity: number;
  dateCreated: string | Date | null;
  lastEditedAt: string | Date | null;
  lastEditedBy: Person;
  createdBy: Person;
};

function displayDate(value: string | Date | null) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function displayPerson(person: Person) {
  if (!person?.name && !person?.email) {
    return "Unknown";
  }
  return `${person.name || "Unknown"}${person.email ? ` (${person.email})` : ""}`;
}

export default function AssetDetailsModal({
  asset,
  onClose,
}: {
  asset: AssetDetails;
  onClose: () => void;
}) {
  const [fullImage, setFullImage] = useState<string | null>(null);

  const details = [
    ["Asset Name", asset.name],
    ["RFID UID", asset.rfidUid || "N/A"],
    ["Category", asset.category || "Unknown"],
    ["Location", asset.location || "Unknown"],
    ["Status", asset.assetStatus || "Unknown"],
    ["Condition", asset.condition || "Unknown"],
    ["Quantity", asset.quantity],
    ["Date Created", displayDate(asset.dateCreated)],
    ["Created By", displayPerson(asset.createdBy)],
    ["Last Edited", displayDate(asset.lastEditedAt)],
    ["Last Edited By", displayPerson(asset.lastEditedBy)],
    ["Description", asset.description || "No description provided"],
  ] as const;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Asset Details</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-2xl text-gray-500 hover:text-gray-700"
              aria-label="Close asset details"
            >
              ×
            </button>
          </div>

          <div className="space-y-4 text-sm">
            {asset.image ? (
              <button
                type="button"
                onClick={() => setFullImage(asset.image)}
                className="block w-full cursor-zoom-in rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label={`View full image of ${asset.name}`}
              >
                <img
                  src={asset.image}
                  alt={asset.name}
                  className="h-48 w-full rounded-lg bg-gray-100 object-contain"
                />
              </button>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                No image
              </div>
            )}

            {details.map(([label, value]) => (
              <div key={label}>
                <p className="font-semibold text-gray-700">{label}</p>
                <p className="text-gray-600">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {fullImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setFullImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Full asset image"
        >
          <button
            type="button"
            onClick={() => setFullImage(null)}
            className="absolute right-6 top-6 text-4xl leading-none text-white hover:text-gray-300"
            aria-label="Close full image"
          >
            ×
          </button>
          <img
            src={fullImage}
            alt={asset.name}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
