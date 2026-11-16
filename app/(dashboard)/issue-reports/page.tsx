"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ASSET_REPORT_STATUSES,
  ASSET_REPORT_TYPES,
} from "@/lib/asset-reports";

type Reporter = {
  id: string;
  name: string;
  email: string;
};

type AssetReport = {
  _id: string;
  assetId: string;
  assetName: string;
  tagId: string;
  type: string;
  title?: string;
  suggestedCondition?: string;
  details: string;
  picture?: string;
  reporter: Reporter;
  status: (typeof ASSET_REPORT_STATUSES)[number];
  resolutionNote?: string;
  handledBy?: Reporter;
  handledAt?: string;
  createdAt: string;
};

type ReportAsset = {
  _id: string;
  assetName: string;
  uid: string;
  category: string;
  currentRoom: string;
  quantity: number;
  assetStatus: string;
  condition: string;
  description: string;
  dateRegistered: string;
  createdAt: string;
  lastEditedAt?: string;
  lastEditedBy?: { name?: string; email?: string };
};

function formatTime(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function formatStatus(status: string) {
  return status.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function IssueReportsPage() {
  const [reports, setReports] = useState<AssetReport[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<AssetReport | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ReportAsset | null>(null);
  const [reportStatus, setReportStatus] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [assetCondition, setAssetCondition] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isSavingCondition, setIsSavingCondition] = useState(false);
  const [error, setError] = useState("");
  const [conditionMessage, setConditionMessage] = useState("");

  const openReport = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    setError("");
    setConditionMessage("");
    setSelectedReport(null);
    setSelectedAsset(null);

    try {
      const response = await fetch(`/api/asset-reports/${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to load asset report.");
      }

      const report = data.report as AssetReport;
      const asset = data.asset as ReportAsset | null;
      setSelectedReport(report);
      setSelectedAsset(asset);
      setReportStatus(report.status);
      setResolutionNote(report.resolutionNote || "");
      setAssetCondition(asset?.condition || "good");
      window.history.replaceState(
        {},
        "",
        `/issue-reports?reportId=${encodeURIComponent(id)}`
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load asset report."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const closeReport = useCallback(() => {
    setSelectedReport(null);
    setSelectedAsset(null);
    window.history.replaceState({}, "", "/issue-reports");
  }, []);

  useEffect(() => {
    let active = true;

    async function loadReports() {
      try {
        const response = await fetch("/api/asset-reports");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Unable to load asset reports.");
        }
        if (active) setReports(data.reports);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load asset reports."
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadReports();
    const reportId = new URLSearchParams(window.location.search).get("reportId");
    if (reportId) void openReport(reportId);

    return () => {
      active = false;
    };
  }, [openReport]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesSearch =
        !query ||
        [report.assetName, report.tagId, report.reporter.name, report.reporter.email, report.type]
          .some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all" || report.status === statusFilter;
      const matchesType = typeFilter === "all" || report.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [reports, search, statusFilter, typeFilter]);

  async function saveReportUpdate() {
    if (!selectedReport) return;
    setIsSavingReport(true);
    setError("");

    try {
      const response = await fetch(
        `/api/asset-reports/${encodeURIComponent(selectedReport._id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: reportStatus, resolutionNote }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update asset report.");
      }
      const updatedReport = data.report as AssetReport;
      setSelectedReport(updatedReport);
      setReports((items) =>
        items.map((item) =>
          item._id === updatedReport._id ? { ...item, ...updatedReport } : item
        )
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update asset report."
      );
    } finally {
      setIsSavingReport(false);
    }
  }

  async function saveAssetCondition() {
    if (!selectedAsset) return;
    setIsSavingCondition(true);
    setConditionMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/rfid/tags/${encodeURIComponent(selectedAsset._id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedAsset.assetName,
            category: selectedAsset.category,
            location: selectedAsset.currentRoom,
            quantity: selectedAsset.quantity,
            assetStatus: selectedAsset.assetStatus,
            condition: assetCondition,
            description: selectedAsset.description,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update asset condition.");
      }
      setSelectedAsset((asset) =>
        asset ? { ...asset, condition: data.updatedTag.condition } : asset
      );
      setConditionMessage("Asset condition updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update asset condition."
      );
    } finally {
      setIsSavingCondition(false);
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Issue Reports</h1>
        <p className="mt-1 text-gray-600">Review and manage reported asset issues.</p>
      </div>

      {error && !selectedReport && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b bg-gray-50 p-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search asset, reporter, or type..."
            className="min-w-60 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {ASSET_REPORT_STATUSES.map((status) => (
              <option key={status} value={status}>{formatStatus(status)}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="max-w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            aria-label="Filter by report type"
          >
            <option value="all">All types</option>
            {ASSET_REPORT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="p-8 text-center text-gray-500">Loading issue reports...</p>
        ) : filteredReports.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No issue reports found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredReports.map((report) => (
              <button
                key={report._id}
                type="button"
                onClick={() => void openReport(report._id)}
                className="flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-gray-900">
                    {report.assetName} <span className="font-normal text-gray-500">· {report.tagId}</span>
                  </span>
                  <span className="mt-1 block text-sm text-gray-600">
                    {report.type} · Reported by {report.reporter.name}
                  </span>
                </span>
                <span className="flex items-center gap-4 text-sm">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                    {formatStatus(report.status)}
                  </span>
                  <time className="whitespace-nowrap text-gray-500" dateTime={report.createdAt}>
                    {formatTime(report.createdAt)}
                  </time>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {(selectedReport || isLoadingDetail) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReport();
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-report-detail-title"
          >
            {isLoadingDetail || !selectedReport ? (
              <p className="py-12 text-center text-gray-500">Loading report...</p>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 id="issue-report-detail-title" className="text-2xl font-bold text-gray-900">
                      {selectedReport.title || selectedReport.type}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {selectedReport.assetName} · Tag ID: {selectedReport.tagId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeReport}
                    className="text-2xl leading-none text-gray-500 hover:text-gray-800"
                    aria-label="Close report details"
                  >
                    ×
                  </button>
                </div>

                {error && (
                  <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                  <section className="space-y-3">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="mb-2 font-semibold text-gray-900">Report details</h3>
                      <p className="text-sm"><span className="font-medium">Type:</span> {selectedReport.type}</p>
                      {selectedReport.title && <p className="mt-1 text-sm"><span className="font-medium">Title:</span> {selectedReport.title}</p>}
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{selectedReport.details}</p>
                      {selectedReport.suggestedCondition && (
                        <p className="mt-2 text-sm"><span className="font-medium">Suggested condition:</span> {selectedReport.suggestedCondition}</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="mb-2 font-semibold text-gray-900">Reporter</h3>
                      <p className="text-sm">{selectedReport.reporter.name}</p>
                      <p className="text-sm text-gray-600">{selectedReport.reporter.email}</p>
                      <time className="mt-1 block text-sm text-gray-500" dateTime={selectedReport.createdAt}>
                        {formatTime(selectedReport.createdAt)}
                      </time>
                    </div>

                    {selectedReport.picture && (
                      <div>
                        <h3 className="mb-2 font-semibold text-gray-900">Picture</h3>
                        <img
                          src={selectedReport.picture}
                          alt={`Reported issue for ${selectedReport.assetName}`}
                          className="max-h-80 w-full rounded-lg border border-gray-200 object-contain"
                        />
                      </div>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="mb-3 font-semibold text-gray-900">Review</h3>
                      <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="issue-report-status">
                        Status
                      </label>
                      <select
                        id="issue-report-status"
                        value={reportStatus}
                        onChange={(event) => setReportStatus(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        {ASSET_REPORT_STATUSES.map((status) => (
                          <option key={status} value={status}>{formatStatus(status)}</option>
                        ))}
                      </select>
                      <label className="mb-1 mt-3 block text-sm font-medium text-gray-700" htmlFor="issue-report-resolution">
                        Resolution note
                      </label>
                      <textarea
                        id="issue-report-resolution"
                        maxLength={1000}
                        rows={3}
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      {selectedReport.handledBy && (
                        <p className="mt-2 text-xs text-gray-500">
                          Last updated by {selectedReport.handledBy.name} · {formatTime(selectedReport.handledAt)}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void saveReportUpdate()}
                        disabled={isSavingReport}
                        className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {isSavingReport ? "Saving..." : "Save review"}
                      </button>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="mb-3 font-semibold text-gray-900">Asset condition</h3>
                      {selectedAsset ? (
                        <>
                          <p className="mb-3 text-sm text-gray-600">
                            Current condition: {selectedAsset.condition || "Unknown"}
                          </p>
                          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="issue-asset-condition">
                            Update condition
                          </label>
                          <select
                            id="issue-asset-condition"
                            value={assetCondition}
                            onChange={(event) => setAssetCondition(event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          >
                            {["new", "good", "fair", "poor"].map((condition) => (
                              <option key={condition} value={condition}>
                                {condition.charAt(0).toUpperCase() + condition.slice(1)}
                              </option>
                            ))}
                          </select>
                          {conditionMessage && (
                            <p className="mt-2 text-sm text-green-700">{conditionMessage}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => void saveAssetCondition()}
                            disabled={isSavingCondition}
                            className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {isSavingCondition ? "Updating..." : "Update asset"}
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">
                          This asset no longer exists, so its condition cannot be updated.
                        </p>
                      )}
                    </div>
                  </section>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={closeReport}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
