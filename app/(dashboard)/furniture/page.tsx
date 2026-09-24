"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Asset } from "@/lib/types";
import { AssetListControls, useAssetListControls } from "@/components/AssetListControls";

export default function FurniturePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "maintenance":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

  const getConditionBadgeClass = (condition: string): string => {
    switch (condition) {
      case "new":
        return "bg-blue-100 text-blue-800";
      case "good":
        return "bg-green-100 text-green-800";
      case "fair":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

      useEffect(() => {
        const fetchAssets = async () => {
          setIsLoading(true);

          try {
            const response = await fetch("/api/rfid/tags");

            const data = await response.json();

            if (!response.ok) {
              throw new Error("Failed to fetch RFID tags");
            }

            const furnitureAssets: Asset[] = data.rfidTags
              .filter(
                (tag: any) =>
                  tag.category?.trim().toLowerCase() === "furniture"
              )
              .map((tag: any) => ({
                id: String(tag._id),

                name: tag.assetName,

                category: tag.category,

                location: tag.currentRoom,

                dateRegistered:
                  tag.dateRegistered ||
                  new Date(tag.createdAt)
                    .toISOString()
                    .split("T")[0],

                rfidUid: tag.uid,

                quantity: tag.quantity || 1,

                assetStatus: tag.assetStatus || "active",

                condition: tag.condition || "good",

                description: tag.description || "",

                image: tag.image || "",

                createdAt: tag.createdAt,
              }));

            setAssets(furnitureAssets);
          } catch (error) {
            console.error("Error fetching furniture:", error);
          } finally {
            setIsLoading(false);
          }
        };

        fetchAssets();
      }, []);

  const { filters, setFilters, visibleAssets, categories, statuses, conditions, sortOption, setSortOption, activeFilterCount, clearFilters } = useAssetListControls(assets);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Furniture</h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage all furniture assets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/register-asset"
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium transition flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-gray-500 text-sm">Total Assets</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{visibleAssets.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-gray-500 text-sm">Active Assets</p>
          <p className="text-3xl font-bold text-primary-500 mt-2">
            {visibleAssets.filter((a) => a.assetStatus === "active").length}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-gray-500 text-sm">Maintenance Due</p>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {visibleAssets.filter((a) => a.assetStatus === "maintenance").length}
          </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-visible shadow-sm">
        {/* Table Header with Action Buttons */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h3 className="font-semibold text-gray-900">Furniture Assets</h3>
          <AssetListControls
            filters={filters}
            setFilters={setFilters}
            categories={categories}
            statuses={statuses}
            conditions={conditions}
            sortOption={sortOption}
            setSortOption={setSortOption}
            activeFilterCount={activeFilterCount}
            clearFilters={clearFilters}
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="px-6 py-16 text-center">
            <svg
              className="w-8 h-8 text-primary-500 mx-auto mb-4 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 1v6m4.22-4.22l-4.24 4.24m0 0l-4.24-4.24M16.22 6.78l-4.24 4.24"
              />
            </svg>
            <p className="text-gray-500">Loading assets...</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && visibleAssets.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">
                    Asset Name
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">
                    Image
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">
                    Category
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">
                    Date Registered
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">
                    Location
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-8 py-5 text-sm text-gray-900 font-medium">
                      {asset.name}
                    </td>
                    <td className="px-8 py-5 text-sm text-gray-600">
                      {asset.image ? (
                        <img src={asset.image} alt={asset.name} className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <span>No image</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-sm text-gray-600">
                      {asset.category}
                    </td>
                    <td className="px-8 py-5 text-sm text-gray-600">
                      {asset.dateRegistered}
                    </td>
                    <td className="px-8 py-5 text-sm text-gray-600">
                      {asset.location}
                    </td>
                    <td className="px-8 py-5 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(asset.assetStatus)}`}
                      >
                        {asset.assetStatus.charAt(0).toUpperCase() +
                          asset.assetStatus.slice(1)}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getConditionBadgeClass(asset.condition)}`}
                      >
                        {asset.condition.charAt(0).toUpperCase() +
                          asset.condition.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <button
                        onClick={() => setSelectedAsset(asset)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                        aria-label={`View ${asset.name}`}
                        title="View asset"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                      <button className="p-2 text-primary-600 hover:bg-primary-50 rounded transition">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            confirm(
                              "Are you sure you want to delete this asset?"
                            )
                          ) {
                            try {
                              // Determine if this is an RFID tag or regular asset
                          const res = await fetch(`/api/rfid/tags/${asset.id}`, {
                                method: "DELETE",
                              });

                              if (res.ok) {
                                const refreshed = await fetch("/api/rfid/tags");

                                const refreshedData = await refreshed.json();

                                const updatedAssets: Asset[] = refreshedData.rfidTags
                                  .filter(
                                    (tag: any) =>
                                      tag.category?.trim().toLowerCase() === "furniture"
                                  )
                                  .map((tag: any) => ({
                                    id: String(tag._id),

                                    name: tag.assetName,

                                    category: tag.category,

                                    location: tag.currentRoom,

                                    dateRegistered:
                                      tag.dateRegistered ||
                                      new Date(tag.createdAt)
                                        .toISOString()
                                        .split("T")[0],

                                    rfidUid: tag.uid,

                                    quantity: tag.quantity || 1,

                                    assetStatus: tag.assetStatus || "active",

                                    condition: tag.condition || "good",
                                    description: tag.description || "",
                                    image: tag.image || "",

                                    createdAt: tag.createdAt,
                                  }));

                                setAssets(updatedAssets);
                              } else {
                                alert("Failed to delete furniture");
                              }
                            } catch (error) {
                              console.error("Error deleting asset:", error);
                              alert("Error deleting asset");
                            }
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && visibleAssets.length === 0 && (
          <div className="px-6 py-16 text-center">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-gray-500 mb-4">No furniture assets found</p>
            <Link
              href="/register-asset"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Register Your First Furniture
            </Link>
          </div>
        )}
      </div>

      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Asset Details</h2>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
                aria-label="Close asset details"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 text-sm">
              {selectedAsset.image ? (
                <button
                  type="button"
                  onClick={() => setFullImage(selectedAsset.image || null)}
                  className="block w-full cursor-zoom-in rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={`View full image of ${selectedAsset.name}`}
                >
                  <img src={selectedAsset.image} alt={selectedAsset.name} className="h-48 w-full rounded-lg object-contain bg-gray-100" />
                </button>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg bg-gray-100 text-gray-500">No image</div>
              )}
              <div><p className="font-semibold text-gray-700">Asset Name</p><p className="text-gray-600">{selectedAsset.name}</p></div>
              <div><p className="font-semibold text-gray-700">RFID UID</p><p className="text-gray-600">{selectedAsset.rfidUid || "N/A"}</p></div>
              <div><p className="font-semibold text-gray-700">Location</p><p className="text-gray-600">{selectedAsset.location}</p></div>
              <div><p className="font-semibold text-gray-700">Status</p><p className="text-gray-600">{selectedAsset.assetStatus}</p></div>
              <div><p className="font-semibold text-gray-700">Condition</p><p className="text-gray-600">{selectedAsset.condition}</p></div>
              <div><p className="font-semibold text-gray-700">Description</p><p className="text-gray-600">{selectedAsset.description || "No description provided"}</p></div>
            </div>
          </div>
        </div>
      )}

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
            alt="Full asset"
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}