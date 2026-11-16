"use client";

import { useEffect, useMemo, useState } from "react";

type Person = {
  name?: string;
  email?: string;
} | null;

type AssetSummary = {
  id: string;
  name: string;
  tagId: string;
  createdAt: string | null;
  createdBy: Person;
  lastEditedAt: string | null;
  lastEditedBy: Person;
  editors: Array<{ name: string; email: string }>;
  activityDates: string[];
  deleted: boolean;
};

type ChangedField = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

type AssetLog = {
  _id: string;
  assetId: string;
  tagId: string;
  assetName: string;
  action: "CREATED" | "EDITED" | "DELETED";
  who: { name: string; email: string };
  timestamp: string;
  changedFields: ChangedField[];
  pictureChanged: boolean;
  oldPicture?: string;
  pictureTooLarge: boolean;
};

function displayPerson(person: Person) {
  return person?.name || person?.email
    ? `${person.name || "Unknown"}${person.email ? ` (${person.email})` : ""}`
    : "Unknown";
}

function displayDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function dateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
}

export default function EditLogsPage() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetSummary | null>(null);
  const [logs, setLogs] = useState<AssetLog[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAssets() {
      try {
        const response = await fetch("/api/edit-logs");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to load edit logs");
        }
        setAssets(data.assets);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load edit logs"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadAssets();
  }, []);

  async function selectAsset(asset: AssetSummary) {
    setSelectedAsset(asset);
    setLogs([]);
    setHistoryLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/edit-logs?assetId=${encodeURIComponent(asset.id)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load asset history");
      }
      setLogs(data.logs);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load asset history"
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesSearch =
        !query ||
        asset.name.toLowerCase().includes(query) ||
        asset.tagId.toLowerCase().includes(query) ||
        asset.editors.some(
          (editor) =>
            editor.name.toLowerCase().includes(query) ||
            editor.email.toLowerCase().includes(query)
        );
      const matchesDate =
        (!fromDate && !toDate) ||
        asset.activityDates.some((activityDate) => {
          const key = dateKey(activityDate);
          return (!fromDate || key >= fromDate) && (!toDate || key <= toDate);
        });
      return matchesSearch && matchesDate;
    });
  }, [assets, fromDate, search, toDate]);

  return (
    <section className="space-y-6 p-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Edit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review asset registration, edit, and deletion history.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <input
              type="search"
              aria-label="Search assets and editors"
              placeholder="Search name, tag ID, or editor..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-60 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              From
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              To
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-2"
              />
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <p className="p-6 text-gray-500">Loading assets...</p>
            ) : filteredAssets.length === 0 ? (
              <p className="p-6 text-gray-500">No assets found.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Tag ID</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Created by</th>
                    <th className="px-4 py-3">Last edited</th>
                    <th className="px-4 py-3">Last edited by</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr
                      key={asset.id}
                      className={`cursor-pointer border-t border-gray-100 hover:bg-red-50 ${
                        selectedAsset?.id === asset.id ? "bg-red-50" : ""
                      }`}
                      onClick={() => void selectAsset(asset)}
                    >
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {asset.name}
                        {asset.deleted && (
                          <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            Deleted
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-600">{asset.tagId}</td>
                      <td className="px-4 py-4 text-gray-600">
                        {displayDate(asset.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {displayPerson(asset.createdBy)}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {displayDate(asset.lastEditedAt)}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {displayPerson(asset.lastEditedBy)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedAsset ? `${selectedAsset.name} History` : "Asset History"}
          </h2>
          {!selectedAsset ? (
            <p className="mt-3 text-sm text-gray-500">
              Select an asset to view its history.
            </p>
          ) : historyLoading ? (
            <p className="mt-3 text-sm text-gray-500">Loading history...</p>
          ) : logs.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              No history recorded for this asset.
            </p>
          ) : (
            <ol className="mt-5 space-y-5">
              {logs.map((log) => (
                <li key={log._id} className="border-l-2 border-red-200 pl-4">
                  <p className="font-semibold text-gray-900">{log.action}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {displayDate(log.timestamp)} · {displayPerson(log.who)}
                  </p>
                  {log.changedFields.map((change) => (
                    <p
                      key={`${log._id}-${change.field}`}
                      className="mt-2 text-sm text-gray-700"
                    >
                      <span className="font-medium capitalize">
                        {change.field}
                      </span>
                      : {displayValue(change.oldValue)} to{" "}
                      {displayValue(change.newValue)}
                    </p>
                  ))}
                  {log.pictureChanged && (
                    <div className="mt-3 text-sm text-gray-700">
                      <p className="font-medium">Picture changed</p>
                      {log.oldPicture ? (
                        <img
                          src={log.oldPicture}
                          alt="Previous asset picture"
                          className="mt-2 max-h-40 max-w-full rounded-lg border border-gray-200 object-contain"
                        />
                      ) : null}
                      {log.pictureTooLarge ? (
                        <p className="mt-1 text-amber-700">Picture too large</p>
                      ) : !log.oldPicture ? (
                        <p className="mt-1 text-gray-500">
                          No previous picture.
                        </p>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
