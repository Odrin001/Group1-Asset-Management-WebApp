"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";

type ExportScope = "whole" | "filtered" | "custom";

export default function ReportsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("All");
  const [searchAsset, setSearchAsset] = useState("");
  const [dateFromStr, setDateFromStr] = useState("");
  const [dateToStr, setDateToStr] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>("whole");
  const [selectedExportAssets, setSelectedExportAssets] = useState<string[]>([]);
  const [exportCategory, setExportCategory] = useState("All");
  const [exportStatus, setExportStatus] = useState("All");
  const [exportCondition, setExportCondition] = useState("All");
  const [exportLocation, setExportLocation] = useState("All");
  const [exportActivity, setExportActivity] = useState("All");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [includeLocationSummary, setIncludeLocationSummary] = useState(true);
  const [includeActivity, setIncludeActivity] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeAssetFields, setIncludeAssetFields] = useState(true);
  const [showClearReportModal, setShowClearReportModal] = useState(false);
  const [clearCountdown, setClearCountdown] = useState(0);
  const [isClearingReport, setIsClearingReport] = useState(false);
  const recordsPerPage = 15;

  useEffect(() => {
    if (!showClearReportModal || clearCountdown <= 0) return;

    const timer = setTimeout(() => {
      setClearCountdown((countdown) => countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showClearReportModal, clearCountdown]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Assets
        const assetRes = await fetch("/api/rfid/tags");
        const assetData = await assetRes.json();

        // Fetch Logs
        const logRes = await fetch("/api/scanner/logs");
        const logData = await logRes.json();
        setAssets(assetData.rfidTags || []);
        setLogs(logData || []);
        setFilteredLogs(logData || []);
      } catch (error) {
        console.error("Error loading reports:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter logs by room, search, and date range
  useEffect(() => {
    let filtered = [...logs];

    // Filter by room
    if (selectedRoom === "All") {
        filtered = filtered;
    } else if (selectedRoom === "Outside") {
        filtered = filtered.filter(
            (log) =>
            log.action === "EXIT" &&
            log.toRoom === "-"
          );
    } else {
        filtered = filtered.filter(
        (log) => log.toRoom === selectedRoom
        );
    }

    // Filter by asset name (search)
    if (searchAsset.trim()) {
      const searchLower = searchAsset.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          (log.assetName || "").toLowerCase().includes(searchLower) ||
          (log.uid || "").toLowerCase().includes(searchLower)
      );
    }

    // Filter by date range
    if (dateFromStr) {
      const fromDate = new Date(dateFromStr);
      filtered = filtered.filter(
        (log) => new Date(log.createdAt) >= fromDate
      );
    }

    if (dateToStr) {
      const toDate = new Date(dateToStr);
      filtered = filtered.filter(
        (log) => new Date(log.createdAt) <= toDate
      );
    }

    setFilteredLogs(filtered);
  }, [selectedRoom, logs, searchAsset, dateFromStr, dateToStr]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRoom, searchAsset, dateFromStr, dateToStr]);

  // Summary Counts
  const room1Assets = assets.filter(
    (asset) => asset.currentRoom === "Room1"
  );

  const outsideAssets = assets.filter(
    (asset) => asset.currentRoom === "Outside"
  );

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + recordsPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Count active filters
  const activeFilters = [
    selectedRoom !== "All" ? 1 : 0,
    searchAsset.trim() ? 1 : 0,
    dateFromStr ? 1 : 0,
    dateToStr ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Clear filters
  const handleClearFilters = () => {
    setSelectedRoom("All");
    setSearchAsset("");
    setDateFromStr("");
    setDateToStr("");
    setCurrentPage(1);
  };

  const openClearReportModal = () => {
    setClearCountdown(5);
    setShowClearReportModal(true);
  };

  const handleClearAllReport = async () => {
    setIsClearingReport(true);

    try {
      const response = await fetch("/api/scanner/logs", { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to clear report");

      setLogs([]);
      setFilteredLogs([]);
      setCurrentPage(1);
      setShowClearReportModal(false);
    } catch (error) {
      console.error("Error clearing asset report:", error);
    } finally {
      setIsClearingReport(false);
    }
  };

  const toggleExportAsset = (uid: string) => {
    setSelectedExportAssets((current) =>
      current.includes(uid)
        ? current.filter((assetUid) => assetUid !== uid)
        : [...current, uid]
    );
  };

  const handleExportReport = () => {
    let exportAssets = assets;
    let exportLogs = logs;

    if (exportScope === "filtered") {
      const filteredUids = new Set(filteredLogs.map((log) => log.uid));
      exportAssets = assets.filter((asset) => filteredUids.has(asset.uid));
      exportLogs = filteredLogs;
    }

    if (exportScope === "custom") {
      exportAssets = assets.filter((asset) => {
        const matchesAsset =
          selectedExportAssets.length === 0 || selectedExportAssets.includes(asset.uid);
        const matchesCategory = exportCategory === "All" || asset.category === exportCategory;
        const matchesStatus = exportStatus === "All" || asset.assetStatus === exportStatus;
        const matchesCondition = exportCondition === "All" || asset.condition === exportCondition;
        const matchesLocation = exportLocation === "All" || asset.currentRoom === exportLocation;
        return matchesAsset && matchesCategory && matchesStatus && matchesCondition && matchesLocation;
      });

      const exportUids = new Set(exportAssets.map((asset) => asset.uid));
      exportLogs = logs.filter((log) => {
        const matchesAsset = exportUids.has(log.uid);
        const matchesActivity = exportActivity === "All" || log.action === exportActivity;
        const matchesFrom = !exportFrom || new Date(log.createdAt) >= new Date(exportFrom);
        const matchesTo = !exportTo || new Date(log.createdAt) <= new Date(exportTo);
        return matchesAsset && matchesActivity && matchesFrom && matchesTo;
      });
    }

    generatePDF(
      exportAssets,
      exportLogs,
      exportScope === "whole"
        ? {
            includeSummary: true,
            includeDescriptions: true,
            includeLocationSummary: true,
            includeActivity: true,
            includeImages: true,
            includeAssetFields: true,
          }
        : {
            includeSummary,
            includeDescriptions,
            includeLocationSummary,
            includeActivity,
            includeImages,
            includeAssetFields,
          }
    );
    setShowExportOptions(false);
  };

  const generatePDF = (
    exportAssets = assets,
    exportLogs = logs,
    options = {
      includeSummary: true,
      includeDescriptions: true,
      includeLocationSummary: true,
      includeActivity: true,
      includeImages: true,
      includeAssetFields: true,
    }
  ) => {
  const doc = new jsPDF();
  const exportedRoom1Assets = exportAssets.filter((asset) => asset.currentRoom === "Room1");
  const exportedOutsideAssets = exportAssets.filter((asset) => asset.currentRoom === "Outside");
  const reportLogs = exportLogs.map((log) => {
    const matchingAsset = exportAssets.find((asset) => asset.uid === log.uid);
    return matchingAsset ? { ...log, assetName: matchingAsset.assetName } : log;
  });

  let y = 20;
  const addPageIfNeeded = (space = 15) => {
    if (y + space > 275) {
      doc.addPage();
      y = 20;
    }
  };
  const drawAssetNameLine = (
    prefix: string,
    assetName: string,
    suffix: string,
    x: number,
    lineY: number,
    fontSize = 11
  ) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.text(prefix, x, lineY);
    const prefixWidth = doc.getTextWidth(prefix);
    doc.setFont("helvetica", "bold");
    doc.text(assetName, x + prefixWidth, lineY);
    const nameWidth = doc.getTextWidth(assetName);
    doc.setFont("helvetica", "normal");
    doc.text(suffix, x + prefixWidth + nameWidth, lineY);
  };

doc.setFont("helvetica", "bold");
doc.setFontSize(22);

doc.text(
  "SDCA Asset Management System",
  105,
  20,
  { align: "center" }
);

  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20.8);
  doc.text("Asset Reports", 20, y);

  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    20,
    y
  );

  y += 15;

  // TOTAL ASSETS
  if (options.includeSummary) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18.2);
  doc.text(`Total Assets: ${exportAssets.length}`, 20, y);

  y += 10;

  exportAssets.forEach((asset) => {
    drawAssetNameLine(
      "• ",
      asset.assetName,
      ` — UID: ${asset.uid}`,
      25,
      y
    );

    y += 7;
  });
  }

  // ALL ASSET DESCRIPTIONS
  if (options.includeDescriptions) {
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18.2);
  doc.text("All Asset Descriptions:", 20, y);
  y += 10;

  exportAssets.forEach((asset) => {
    const description = `${asset.assetName} — UID: ${asset.uid}`;
    const descriptionLines = doc.splitTextToSize(description, 165);
    const imageHeight = options.includeImages && asset.image ? 55 : 0;

    addPageIfNeeded(descriptionLines.length * 5 + 40 + imageHeight);

    drawAssetNameLine("• ", asset.assetName, "", 25, y, 13.75);
    y += 8;

    const fields = options.includeAssetFields
      ? [
          ["UID:", asset.uid],
          ["Category:", asset.category || "N/A"],
          ["Condition:", asset.condition || "N/A"],
          ["Status:", asset.assetStatus || "N/A"],
          ["Current Location:", asset.currentRoom || "Unknown"],
        ]
      : [["UID:", asset.uid]];

    doc.setFontSize(11);
    fields.forEach(([label, value], fieldIndex) => {
      doc.setFont("helvetica", "bold");
      const separator = fieldIndex < fields.length - 1 ? " ||" : "";
      doc.text(`${label} `, 25, y);
      const labelWidth = doc.getTextWidth(`${label} `);
      doc.setFont("helvetica", "normal");
      doc.text(`${String(value)}${separator}`, 25 + labelWidth, y);
      y += 5;
    });

    if (options.includeImages && asset.image) {
      try {
        const imageFormat = asset.image.startsWith("data:image/png")
          ? "PNG"
          : asset.image.startsWith("data:image/webp")
            ? "WEBP"
            : "JPEG";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12.65);
        doc.text("Image", 25, y + 2);
        y += 7;
        doc.addImage(asset.image, imageFormat, 20, y, 60, 50);
        y += 55;
      } catch (error) {
        console.error("Error adding image for", asset.assetName, error);
      }
    }

    y += 5;
  });
  }

  if (options.includeLocationSummary) {
  addPageIfNeeded(25);
  y += 10;

  // ROOM1
  doc.setFontSize(14);

  doc.text(
    `Assets in Room1: ${exportedRoom1Assets.length}`,
    20,
    y
  );

  y += 10;

  exportAssets.filter((asset) => asset.currentRoom === "Room1").forEach((asset) => {
    addPageIfNeeded(12);
    drawAssetNameLine(
      "• ",
      asset.assetName,
      ` — UID: ${asset.uid}`,
      25,
      y
    );

    y += 7;
  });

  y += 10;

  // OUTSIDE
  doc.setFontSize(14);

  doc.text(
    `Assets Outside: ${exportedOutsideAssets.length}`,
    20,
    y
  );

  y += 10;

  exportAssets.filter((asset) => asset.currentRoom === "Outside").forEach((asset) => {
    addPageIfNeeded(12);
    drawAssetNameLine(
      "• ",
      asset.assetName,
      ` — UID: ${asset.uid}`,
      25,
      y
    );

    y += 7;
  });
  }

  if (options.includeActivity) {
  y += 15;

// TOTAL SCANS TODAY
  addPageIfNeeded(25);
  doc.setFontSize(14);

    doc.text(
    `Total Scans Today: ${
    reportLogs.filter((log) => {
        const today = new Date().toDateString();

        return (
        new Date(log.createdAt).toDateString() === today
        );
    }).length
    }`,
    20,
    y
    );

    y += 15;

  // TOTAL SCANS
  addPageIfNeeded(25);
  doc.setFontSize(14);

  doc.text(
    `Total Scans: ${reportLogs.length}`,
    20,
    y
  );

  y += 15;

  // RECENT ACTIVITY
  addPageIfNeeded(25);
  doc.setFontSize(16);
  doc.text("Recent RFID Activity", 20, y);

  y += 10;

  reportLogs.slice(0, 6).forEach((log) => {
    addPageIfNeeded(25);
    doc.setFontSize(11);

    const status =
      log.action === "EXIT"
        ? "Outside"
        : log.toRoom;

    drawAssetNameLine(
      "",
      log.assetName || "Unknown Asset",
      ` | UID: ${log.uid} | ${status}`,
      20,
      y
    );

    y += 7;

    doc.text(
      `${new Date(log.createdAt).toLocaleString()}`,
      25,
      y
    );

    y += 10;
  });
  }

  doc.save("Asset-Report.pdf");
};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Asset Reports
          </h1>

          <p className="text-gray-600 mt-2">
            Monitor RFID asset activity and inventory movement
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowExportOptions(true)}
            className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition"
          >
            Export Report
          </button>

          {showExportOptions && (
            <div className="absolute right-0 z-10 mt-3 w-[min(90vw,520px)] rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Export Asset Report</h2>
                <button type="button" onClick={() => setShowExportOptions(false)} className="text-gray-500 hover:text-gray-900">Close</button>
              </div>

              <p className="mt-5 text-sm font-bold text-gray-900">Export Scope</p>
              <div className="mt-2 space-y-2 text-sm text-gray-700">
                {[
                  ["whole", "Whole Result", "Export all available assets and activity"],
                  ["filtered", "Current Filtered Results", "Use the filters currently shown on this page"],
                  ["custom", "Custom Selection", "Choose assets and report filters manually"],
                ].map(([value, label, description]) => (
                  <label key={value} className="flex items-start gap-2">
                    <input type="radio" name="exportScope" value={value} checked={exportScope === value} onChange={() => setExportScope(value as ExportScope)} className="mt-1" />
                    <span><span className="font-semibold">{label}</span><span className="block text-xs text-gray-500">{description}</span></span>
                  </label>
                ))}
              </div>

              {exportScope === "custom" && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
                  <select value={exportCategory} onChange={(e) => setExportCategory(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="All">Category: All</option>
                    {[...new Set(assets.map((asset) => asset.category).filter(Boolean))].map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="All">Status: All</option>
                    {[...new Set(assets.map((asset) => asset.assetStatus).filter(Boolean))].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <select value={exportCondition} onChange={(e) => setExportCondition(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="All">Condition: All</option>
                    {[...new Set(assets.map((asset) => asset.condition).filter(Boolean))].map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                  </select>
                  <select value={exportLocation} onChange={(e) => setExportLocation(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="All">Location: All</option>
                    <option value="Room1">Room1</option>
                    <option value="Outside">Outside</option>
                  </select>
                  <select value={exportActivity} onChange={(e) => setExportActivity(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="All">Activity: All</option>
                    <option value="ENTER">Enter</option>
                    <option value="EXIT">Exit</option>
                  </select>
                  <input type="datetime-local" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" aria-label="Custom export from" />
                  <input type="datetime-local" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" aria-label="Custom export to" />
                  <div className="col-span-2 max-h-28 overflow-y-auto rounded-lg border p-3 text-sm">
                    <p className="mb-2 font-semibold">Selected Assets (leave empty for all)</p>
                    {assets.map((asset) => (
                      <label key={asset.uid} className="mr-4 inline-flex items-center gap-2">
                        <input type="checkbox" checked={selectedExportAssets.includes(asset.uid)} onChange={() => toggleExportAsset(asset.uid)} />
                        {asset.assetName}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {exportScope !== "whole" && (
                <>
              <p className="mt-5 text-sm font-bold text-gray-900">Report Contents</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-700">
                {[["Asset Summary", includeSummary, setIncludeSummary], ["All Asset Descriptions", includeDescriptions, setIncludeDescriptions], ["Location Summary", includeLocationSummary, setIncludeLocationSummary], ["RFID Scan Activity", includeActivity, setIncludeActivity], ["Pictures", includeImages, setIncludeImages], ["Category / Condition / Status", includeAssetFields, setIncludeAssetFields]].map(([label, checked, setter]) => (
                  <label key={label as string} className="flex items-center gap-2"><input type="checkbox" checked={checked as boolean} onChange={(e) => (setter as (value: boolean) => void)(e.target.checked)} />{label as string}</label>
                ))}
              </div>
                </>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowExportOptions(false)} className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel</button>
                <button type="button" onClick={handleExportReport} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Export Report</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="text-gray-500">
          Loading reports...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6">

            {/* Total Assets */}
            <div className="bg-white rounded-xl p-6 border shadow-sm">
              <p className="text-sm text-gray-500">
                Total Assets
              </p>

                <h2 className="text-4xl font-bold text-gray-900 mt-2">
                {assets.length}
                </h2>
            </div>

            {/* Room1 Assets */}
            <div className="bg-white rounded-xl p-6 border shadow-sm">
              <p className="text-sm text-gray-500">
                Assets in Room1
              </p>
                <h2 className="text-4xl font-bold text-green-600 mt-2">
                {room1Assets.length}
                </h2>
            </div>

            {/* Outside Assets */}
            <div className="bg-white rounded-xl p-6 border shadow-sm">
              <p className="text-sm text-gray-500">
                Assets Outside
              </p>

                <h2 className="text-4xl font-bold text-red-600 mt-2">
                {outsideAssets.length}
                </h2>
            </div>

            {/* Total Scans */}
            <div className="bg-white rounded-xl p-6 border shadow-sm">
              <p className="text-sm text-gray-500">
                Total Scans
              </p>

              <h2 className="text-4xl font-bold text-blue-600 mt-2">
                {logs.length}
              </h2>
            </div>
          </div>

          {/* Logs Section */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">

            {/* Top */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Recent RFID Activity
                </h2>
              </div>

              {/* Filters Row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search asset..."
                  value={searchAsset}
                  onChange={(e) => setSearchAsset(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />

                {/* Room Filter */}
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="All">All Rooms</option>
                  <option value="Room1">Room1</option>
                  <option value="Outside">Outside</option>
                </select>

                {/* Date From */}
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  From:
                  <input
                    type="datetime-local"
                    value={dateFromStr}
                    onChange={(e) => setDateFromStr(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </label>

                {/* Date To */}
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  To:
                  <input
                    type="datetime-local"
                    value={dateToStr}
                    onChange={(e) => setDateToStr(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </label>

                {/* Clear Filters */}
                {activeFilters > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition"
                  >
                    Clear
                  </button>
                )}

                {/* Filter Badge */}
                {activeFilters > 0 && (
                  <span className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                    Filter ({activeFilters})
                  </span>
                )}
              </div>
            </div>

            {/* Empty State */}
            {filteredLogs.length === 0 ? (
              <div className="p-6 text-gray-500">
                No matching RFID activity found.
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {paginatedLogs.map((log, index) => (
                    <div
                      key={index}
                      className="p-6 flex items-center justify-between"
                    >
                      {/* Left */}
                      <div>
                        <p className="font-semibold text-gray-900">
                          {log.assetName || "Unknown Asset"}
                        </p>

                        <p className="text-sm text-gray-500 mt-1">
                          UID: {log.uid}
                        </p>
                      </div>

                      {/* Right */}
                      <div className="text-right">
                        <p
                          className={`font-semibold ${
                            log.action === "EXIT"
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {log.action === "EXIT"
                                  ? "Outside"
                                  : log.toRoom}
                        </p>

                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(
                            log.createdAt
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-6 border-t bg-gray-50 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        ← Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                        .map((page, idx, arr) => (
                          <div key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-2 py-1 text-gray-500">...</span>}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                                currentPage === page
                                  ? "bg-red-600 text-white"
                                  : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              {page}
                            </button>
                          </div>
                        ))}

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Next →
                      </button>
                    </div>
                    <p className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={openClearReportModal}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition"
            >
              Clear All Asset Report
            </button>
          </div>
        </>
      )}

      {showClearReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close clear report confirmation"
              onClick={() => setShowClearReportModal(false)}
              className="absolute right-4 top-3 text-2xl text-gray-500 hover:text-gray-900"
            >
              ×
            </button>
            <h2 className="pr-8 text-xl font-bold text-gray-900">
              Clear All Asset Report
            </h2>
            <p className="mt-4 text-gray-700">
              Are you sure that you want to clear everything that has been scanned?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearReportModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearCountdown > 0 || isClearingReport}
                onClick={handleClearAllReport}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isClearingReport
                  ? "Clearing..."
                  : clearCountdown > 0
                    ? `Ok (${clearCountdown})`
                    : "Ok"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}