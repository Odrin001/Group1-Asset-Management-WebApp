"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import AssetDetailsModal, {
  type AssetDetails,
} from "@/components/AssetDetailsModal";

type RoomSummary = {
  key: string;
  displayName: string;
  scanner: string;
  location: string;
  assetCount: number;
};

type RoomAsset = AssetDetails & {
  tagId: string;
  lastIn: AssetScanMovement;
  lastOut: AssetScanMovement;
};

type AssetScanMovement = {
  time: string;
  movement: string;
  room: string;
} | null;

type RoomMovement = {
  assetName: string;
  asset: AssetDetails | null;
  time: string;
  direction: string;
  room: string;
} | null;

type RoomDetails = {
  room: RoomSummary;
  assets: RoomAsset[];
  lastItemIn: RoomMovement;
  lastItemOut: RoomMovement;
};

function displayTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function RoomsPage() {
  const { role } = useAuth();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomDetails | null>(null);
  const [editingRoom, setEditingRoom] = useState<RoomSummary | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetDetails | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const insideDisplayName =
    rooms.find((room) => room.key === "Room1")?.displayName || "Room1";
  const outsideDisplayName =
    rooms.find((room) => room.key === "Outside")?.displayName || "Outside";
  const searchQuery = assetSearch.trim().toLowerCase();
  const filteredAssets =
    selectedRoom?.assets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(searchQuery) ||
        asset.tagId.toLowerCase().includes(searchQuery) ||
        asset.category.toLowerCase().includes(searchQuery)
    ) || [];
  const roomSearchQuery = roomSearch.trim().toLowerCase();
  const filteredRooms = rooms.filter((room) =>
    [room.displayName, room.key, room.location, room.scanner].some((value) =>
      value.toLowerCase().includes(roomSearchQuery)
    )
  );

  useEffect(() => {
    async function loadRooms() {
      try {
        const response = await fetch("/api/rooms");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to load rooms");
        }
        setRooms(data.rooms);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load rooms"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadRooms();
  }, []);

  async function openRoom(room: RoomSummary) {
    setDetailsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(room.key)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load room details");
      }
      setSelectedRoom(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load room details"
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  async function saveDisplayName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRoom) {
      return;
    }

    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length > 40) {
      setError("Room name is required and must be 40 characters or fewer.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(editingRoom.key)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: trimmedName }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to rename room");
      }

      setRooms((current) =>
        current.map((room) =>
          room.key === editingRoom.key
            ? { ...room, displayName: data.room.displayName }
            : room
        )
      );
      setSelectedRoom((current) =>
        current?.room.key === editingRoom.key
          ? {
              ...current,
              room: { ...current.room, displayName: data.room.displayName },
            }
          : current
      );
      setEditingRoom(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to rename room"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6 p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rooms/Locations</h1>
          <p className="mt-1 text-sm text-gray-500">
            View room scanners and the assets currently assigned to each location.
          </p>
        </div>
        <input
          type="search"
          aria-label="Search rooms and scanners"
          placeholder="Search location"
          value={roomSearch}
          onChange={(event) => setRoomSearch(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:max-w-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
        />
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading rooms...</p>
      ) : filteredRooms.length === 0 ? (
        <p className="text-gray-500">No matching rooms or scanners.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredRooms.map((room) => (
            <article
              key={room.key}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => void openRoom(room)}
                  className="flex-1 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <h2 className="text-xl font-semibold text-gray-900">
                    {room.displayName}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Scanner: <span className="font-medium">{room.scanner}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Location: <span className="font-medium">{room.location}</span>
                  </p>
                  <p className="mt-3 text-sm text-gray-600">
                    Assets currently here:{" "}
                    <span className="font-semibold text-gray-900">
                      {room.assetCount}
                    </span>
                  </p>
                  <span className="mt-4 inline-block text-sm font-medium text-red-600">
                    View room details
                  </span>
                </button>
                {role === "sysadmin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayName(room.displayName);
                      setEditingRoom(room);
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit name
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {detailsLoading && (
        <p className="text-sm text-gray-500">Loading room details...</p>
      )}

      {selectedRoom && !detailsLoading && (
        <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedRoom.room.displayName}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Scanner {selectedRoom.room.scanner} ·{" "}
                {selectedRoom.room.location}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRoom(null)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "Last item in", movement: selectedRoom.lastItemIn },
              { label: "Last item out", movement: selectedRoom.lastItemOut },
            ].map(({ label, movement }) => {
              const item = movement;
              return (
                <div
                  key={label}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <h3 className="font-semibold text-gray-900">{label}</h3>
                  {item ? (
                    <>
                      {item.asset ? (
                        <button
                          type="button"
                          onClick={() => setSelectedAsset(item.asset)}
                          className="mt-2 text-left text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
                        >
                          {item.assetName}
                        </button>
                      ) : (
                        <p className="mt-2 text-sm text-gray-700">
                          {item.assetName}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-gray-500">
                        {displayTime(item.time)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {item.direction === "ENTER"
                          ? `Entered: ${outsideDisplayName} → ${insideDisplayName}`
                          : `Exited: ${insideDisplayName} → ${outsideDisplayName}`}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No scans yet</p>
                  )}
                </div>
              );
            })}
          </div>

          <input
            type="search"
            aria-label="Search room assets"
            placeholder="Search assets by name, tag ID, or category..."
            value={assetSearch}
            onChange={(event) => setAssetSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
          />

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Tag ID</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Last in</th>
                  <th className="px-4 py-3">Last out</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-5 text-gray-500" colSpan={6}>
                      {searchQuery
                        ? "No matching assets"
                        : "No assets are currently in this room."}
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <button
                          type="button"
                          onClick={() => setSelectedAsset(asset)}
                          className="text-left text-red-600 hover:text-red-700 hover:underline"
                        >
                          {asset.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{asset.tagId}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {asset.category}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600">
                        {asset.condition}
                      </td>
                      {[asset.lastIn, asset.lastOut].map((movement, index) => (
                        <td
                          key={`${asset.id}-movement-${index}`}
                          className="px-4 py-3 text-gray-600"
                        >
                          {movement ? (
                            <>
                              <p>{displayTime(movement.time)}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {movement.movement}
                              </p>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedAsset && (
        <AssetDetailsModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}

      {editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveDisplayName}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-xl font-semibold text-gray-900">
              Edit room name
            </h2>
            <label className="block text-sm font-medium text-gray-700">
              Display name
              <input
                autoFocus
                maxLength={40}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <p className="text-xs text-gray-500">Maximum 40 characters.</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save name"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
