"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import jsPDF from "jspdf";
import { useAuth } from "@/components/AuthProvider";
import {
  ASSET_REPORT_STATUSES,
  ASSET_REPORT_TYPES,
} from "@/lib/asset-reports";

type ExportScope = "whole" | "filtered" | "custom";

type AssetInfoSummary = {
  totalReports: number;
  filteredTotal: number;
  reportCounts: Record<string, number>;
  lastSevenDaysCount: number;
  typeCounts: Array<{ type: string; count: number }>;
  mostReportedAssets: Array<{
    assetId: string;
    assetName: string;
    tagId: string;
    count: number;
  }>;
  latestReports: Array<{
    _id: string;
    assetName: string;
    tagId: string;
    type: string;
    reporter: { name: string };
    status: string;
    createdAt: string;
  }>;
};

function formatReportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function formatReportStatus(status: string) {
  return status.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportStatusClass(status: string) {
  if (status === "resolved") return "bg-green-100 text-green-800";
  if (status === "dismissed") return "bg-gray-100 text-gray-700";
  if (status === "in_review") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

export default function ReportsPage() {
  const { role } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("All");
  const [searchAsset, setSearchAsset] = useState("");
  const [dateFromStr, setDateFromStr] = useState("");
  const [dateToStr, setDateToStr] = useState("");
  const [activeReportTab, setActiveReportTab] = useState<"activity" | "assetInfo">("activity");
  const [issueReportFilters, setIssueReportFilters] = useState({
    from: "",
    to: "",
    type: "all",
    status: "all",
  });
  const [issueReportSummary, setIssueReportSummary] =
    useState<AssetInfoSummary | null>(null);
  const [isLoadingIssueSummary, setIsLoadingIssueSummary] = useState(false);
  const [issueSummaryError, setIssueSummaryError] = useState("");
  const [showClearIssueReportsModal, setShowClearIssueReportsModal] =
    useState(false);
  const [isClearingIssueReports, setIsClearingIssueReports] = useState(false);
  const [issueReportsClearError, setIssueReportsClearError] = useState("");
  const [clearActivityError, setClearActivityError] = useState("");
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

  const loadIssueReportSummary = useCallback(async () => {
    setIsLoadingIssueSummary(true);
    setIssueSummaryError("");

    try {
      const params = new URLSearchParams();
      if (issueReportFilters.from) params.set("from", issueReportFilters.from);
      if (issueReportFilters.to) params.set("to", issueReportFilters.to);
      if (issueReportFilters.type !== "all") {
        params.set("type", issueReportFilters.type);
      }
      if (issueReportFilters.status !== "all") {
        params.set("status", issueReportFilters.status);
      }
      const response = await fetch(
        `/api/asset-reports/summary?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to load issue report summary.");
      }
      setIssueReportSummary(data);
    } catch (error) {
      console.error("Error loading issue report summary:", error);
      setIssueSummaryError(
        error instanceof Error
          ? error.message
          : "Unable to load issue report summary."
      );
    } finally {
      setIsLoadingIssueSummary(false);
    }
  }, [issueReportFilters]);

  useEffect(() => {
    if (activeReportTab === "assetInfo") {
      void loadIssueReportSummary();
    }
  }, [activeReportTab, loadIssueReportSummary]);

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
    setClearActivityError("");
    setShowClearReportModal(true);
  };

  const handleClearAllReport = async () => {
    setIsClearingReport(true);
    setClearActivityError("");

    try {
      const response = await fetch("/api/scanner/logs", { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to clear RFID activity.");

      setLogs([]);
      setFilteredLogs([]);
      setCurrentPage(1);
      setShowClearReportModal(false);
    } catch (error) {
      console.error("Error clearing asset report:", error);
      setClearActivityError(
        error instanceof Error ? error.message : "Failed to clear RFID activity."
      );
    } finally {
      setIsClearingReport(false);
    }
  };

  const openClearIssueReportsModal = () => {
    setIssueReportsClearError("");
    setShowClearIssueReportsModal(true);
  };

  const handleClearAllIssueReports = async () => {
    setIsClearingIssueReports(true);
    setIssueReportsClearError("");

    try {
      const response = await fetch("/api/asset-reports", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to clear issue reports.");
      }

      setShowClearIssueReportsModal(false);
      await loadIssueReportSummary();
    } catch (error) {
      console.error("Error clearing issue reports:", error);
      setIssueReportsClearError(
        error instanceof Error
          ? error.message
          : "Failed to clear issue reports."
      );
    } finally {
      setIsClearingIssueReports(false);
    }
  };

  const toggleExportAsset = (uid: string) => {
    setSelectedExportAssets((current) =>
      current.includes(uid)
        ? current.filter((assetUid) => assetUid !== uid)
        : [...current, uid]
    );
  };

  const handleExportReport = async () => {
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

    const reportMeta = {
      scope: exportScope,
      scopeLabel:
        exportScope === "whole"
          ? "Whole Result"
          : exportScope === "filtered"
            ? "Filtered Result"
            : "Custom Selection",
      location:
        exportScope === "custom"
          ? exportLocation === "All"
            ? "All Locations"
            : exportLocation
          : selectedRoom === "All"
            ? "All Locations"
            : selectedRoom,
      asset:
        exportScope === "custom"
          ? selectedExportAssets.length > 0
            ? `${selectedExportAssets.length} selected assets`
            : "All Assets"
          : searchAsset.trim()
            ? searchAsset.trim()
            : "All Assets",
      dateRange:
        exportScope === "custom"
          ? !exportFrom && !exportTo
            ? "All Dates"
            : `${exportFrom || "Start"} to ${exportTo || "Now"}`
          : !dateFromStr && !dateToStr
            ? "All Dates"
            : `${dateFromStr || "Start"} to ${dateToStr || "Now"}`,
    };

    const pdfOptions =
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
          };

    await generatePDF(exportAssets, exportLogs, pdfOptions, reportMeta);
    setShowExportOptions(false);
  };

  const normalizeImageForPdf = (source: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to create canvas context for PDF image"));
          return;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      image.onerror = () => reject(new Error("Unable to load asset image"));
      image.src = source;
    });

  const generatePDF = async (
    exportAssets = assets,
    exportLogs = logs,
    options = {
      includeSummary: true,
      includeDescriptions: true,
      includeLocationSummary: true,
      includeActivity: true,
      includeImages: true,
      includeAssetFields: true,
    },
    reportMeta = {
      scope: "whole",
      scopeLabel: "Whole Result",
      location: "All Locations",
      asset: "All Assets",
      dateRange: "All Dates",
    }
  ) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const exportedRoom1Assets = exportAssets.filter((asset) => asset.currentRoom === "Room1");
    const exportedOutsideAssets = exportAssets.filter((asset) => asset.currentRoom === "Outside");

    const reportLogs = exportLogs.map((log) => {
      const matchingAsset = exportAssets.find((asset) => asset.uid === log.uid);
      return matchingAsset ? { ...log, assetName: matchingAsset.assetName } : log;
    });

    let y = 20;

    const addPageIfNeeded = (space = 18) => {
      if (y + space > 270) {
        doc.addPage();
        y = 20;
      }
    };

    const drawSectionHeader = (title: string) => {
      addPageIfNeeded(28);

      doc.setDrawColor(148, 163, 184);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14.5);
      doc.setTextColor(15, 23, 42);
      doc.text(title, margin, y);
      y += 7.5;

      doc.line(margin, y, pageWidth - margin, y);
      y += 9;
    };

    const drawFooter = (pageNumber: number, totalPages: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `SDCA Asset Management System | Asset & RFID Activity Report | Page ${pageNumber} of ${totalPages}`,
        margin,
        pageHeight - 8
      );
    };

    const drawFooterForAllPages = () => {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i += 1) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }
    };

    const drawSummaryCard = (label: string, value: string | number, x: number, width: number) => {
      const cardHeight = 18;
      const cardY = y;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, cardY, width, cardHeight, 2, 2, "F");
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, cardY, width, cardHeight, 2, 2, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(label, x + 4, cardY + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), x + 4, cardY + 14);
    };

    const summaryTotal = exportAssets.length;
    const summaryScans = reportLogs.length;
    const scansToday = reportLogs.filter((log) => {
      const today = new Date().toDateString();
      return new Date(log.createdAt).toDateString() === today;
    }).length;

    const reportLogo = await normalizeImageForPdf("/SDCA-Logo.png").catch(() => null);

    doc.setTextColor(15, 23, 42);
    const logoX = margin;
    const logoY = 9;
    const logoWidth = 28;
    const logoHeight = 18;

    if (reportLogo) {
      doc.addImage(reportLogo, "PNG", logoX, logoY, logoWidth, logoHeight);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("SDCA ASSET MANAGEMENT SYSTEM", logoX + logoWidth + 7, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("Asset & RFID Activity Report", logoX + logoWidth + 7, 26);

    y = 36;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, margin, y);
    doc.text(`Report Scope: ${reportMeta.scopeLabel}`, pageWidth - margin, y, { align: "right" });
    doc.setDrawColor(148, 163, 184);
    doc.line(margin, y + 6, pageWidth - margin, y + 6);
    y += 14;

    if (options.includeSummary) {
      drawSectionHeader("Executive Summary");

      const firstRowX = [margin, margin + 58, margin + 116];
      const secondRowX = [margin, margin + 88];
      const firstRowWidths = [52, 52, 52];
      const secondRowWidths = [80, 80];

      drawSummaryCard("Total Assets", summaryTotal, firstRowX[0], firstRowWidths[0]);
      drawSummaryCard("Room 1", exportedRoom1Assets.length, firstRowX[1], firstRowWidths[1]);
      drawSummaryCard("Outside", exportedOutsideAssets.length, firstRowX[2], firstRowWidths[2]);
      y += 25;
      drawSummaryCard("Total Scans", summaryScans, secondRowX[0], secondRowWidths[0]);
      drawSummaryCard("Scans Today", scansToday, secondRowX[1], secondRowWidths[1]);
      y += 25;

      drawSectionHeader("Report Information");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const scopeLines = [
        ["Export Type:", reportMeta.scopeLabel],
        ["Location:", reportMeta.location],
        ["Asset Filter:", reportMeta.asset],
        ["Date Range:", reportMeta.dateRange],
      ];

      for (const [label, value] of scopeLines) {
        doc.setFont("helvetica", "bold");
        doc.text(label, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), margin + 40, y);
        y += 6;
      }
      y += 4;
    }

    if (options.includeDescriptions) {
      drawSectionHeader("Asset Inventory");

      const inventoryTableX = margin;
      const inventoryCols = {
        asset: 29,
        image: 23,
        uid: 31,
        category: 34,
        condition: 25,
        status: 25,
        location: 25,
      };
      const inventoryHeader = [
        { label: "Asset", width: inventoryCols.asset },
        ...(options.includeImages ? [{ label: "Image", width: inventoryCols.image }] : []),
        { label: "UID", width: inventoryCols.uid },
        ...(options.includeAssetFields ? [
          { label: "Category", width: inventoryCols.category },
          { label: "Condition", width: inventoryCols.condition },
          { label: "Status", width: inventoryCols.status },
        ] : []),
        { label: "Location", width: inventoryCols.location },
      ];
      const inventoryWidth = inventoryHeader.reduce((sum, column) => sum + column.width, 0);

      const drawInventoryHeader = (x: number, headerY: number) => {
        doc.setFillColor(226, 232, 240);
        doc.rect(x, headerY, inventoryWidth, 8, "F");
        doc.setDrawColor(148, 163, 184);
        doc.rect(x, headerY, inventoryWidth, 8, "S");

        let headerX = x;
        inventoryHeader.forEach((column) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.2);
          doc.text(column.label, headerX + 2, headerY + 5.5);
          headerX += column.width;
        });
      };

      const drawInventoryRow = async (asset: any, rowY: number) => {
        const rowHeight = Math.max(
          18,
          5 + Math.max(
            doc.splitTextToSize(asset.assetName || "Unnamed Asset", inventoryCols.asset - 4).length,
            ...(options.includeAssetFields
              ? [
                  doc.splitTextToSize(asset.category || "N/A", inventoryCols.category - 4).length,
                  doc.splitTextToSize(asset.condition || "N/A", inventoryCols.condition - 4).length,
                  doc.splitTextToSize(asset.assetStatus || "N/A", inventoryCols.status - 4).length,
                ]
              : [0])
          ) * 4.5
        );

        doc.setFillColor(255, 255, 255);
        doc.rect(inventoryTableX, rowY, inventoryWidth, rowHeight, "F");
        doc.setDrawColor(203, 213, 225);
        doc.rect(inventoryTableX, rowY, inventoryWidth, rowHeight, "S");

        let cellX = inventoryTableX;

        const assetLines = doc.splitTextToSize(asset.assetName || "Unnamed Asset", inventoryCols.asset - 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(assetLines, cellX + 2, rowY + 5);
        cellX += inventoryCols.asset;

        if (options.includeImages) {
          if (asset.image) {
            try {
              const normalizedImage = await normalizeImageForPdf(asset.image);
              doc.addImage(normalizedImage, "JPEG", cellX + 2, rowY + 2, 18, 14);
            } catch (error) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.5);
              doc.text("No Image", cellX + 2, rowY + 8);
            }
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.text("No Image", cellX + 2, rowY + 8);
          }
          cellX += inventoryCols.image;
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const uidLines = doc.splitTextToSize(asset.uid || "N/A", inventoryCols.uid - 4);
        doc.text(uidLines, cellX + 2, rowY + 5);
        cellX += inventoryCols.uid;

        if (options.includeAssetFields) {
          const categoryLines = doc.splitTextToSize(asset.category || "N/A", inventoryCols.category - 4);
          doc.text(categoryLines, cellX + 2, rowY + 5);
          cellX += inventoryCols.category;

          const conditionLines = doc.splitTextToSize(asset.condition || "N/A", inventoryCols.condition - 4);
          doc.text(conditionLines, cellX + 2, rowY + 5);
          cellX += inventoryCols.condition;

          const statusLines = doc.splitTextToSize(asset.assetStatus || "N/A", inventoryCols.status - 4);
          doc.text(statusLines, cellX + 2, rowY + 5);
          cellX += inventoryCols.status;
        }

        const locationLines = doc.splitTextToSize(asset.currentRoom || "Unknown", inventoryCols.location - 4);
        doc.text(locationLines, cellX + 2, rowY + 5);
        cellX += inventoryCols.location;

        return rowHeight;
      };

      let inventoryY = y;
      drawInventoryHeader(inventoryTableX, inventoryY);
      inventoryY += 9;

      for (const asset of exportAssets) {
        const estimatedRowHeight = Math.max(
          18,
          Math.max(
            doc.splitTextToSize(asset.assetName || "Unnamed Asset", inventoryCols.asset - 4).length,
            ...(options.includeAssetFields
              ? [
                  doc.splitTextToSize(asset.category || "N/A", inventoryCols.category - 4).length,
                  doc.splitTextToSize(asset.condition || "N/A", inventoryCols.condition - 4).length,
                  doc.splitTextToSize(asset.assetStatus || "N/A", inventoryCols.status - 4).length,
                ]
              : [0]),
            doc.splitTextToSize(asset.currentRoom || "Unknown", inventoryCols.location - 4).length
          ) * 4.5 + 7
        );

        if (inventoryY + estimatedRowHeight > pageHeight - 18) {
          doc.addPage();
          y = 20;
          inventoryY = 20;
          drawInventoryHeader(inventoryTableX, inventoryY);
          inventoryY += 9;
        }

        const rowHeight = await drawInventoryRow(asset, inventoryY);
        inventoryY += rowHeight + 1;
      }

      y = inventoryY + 11;
    }

    if (options.includeImages) {
      const imageAssets = exportAssets.filter((asset) => Boolean(asset.image));
      if (imageAssets.length > 0) {
        doc.addPage();
        y = 20;
        drawSectionHeader("Asset With Images");

        let imageRowY = y;
        const imageFrameWidth = 80;
        const imageFrameHeight = 60;

        for (let imageIndex = 0; imageIndex < imageAssets.length; imageIndex += 2) {
          const rowAssets = imageAssets.slice(imageIndex, imageIndex + 2);
          const rowLayouts = rowAssets.map((asset) => {
            const nameLines = doc.splitTextToSize(
              asset.assetName || "Unnamed Asset",
              imageFrameWidth - 4
            );
            const uidLines = doc.splitTextToSize(
              `UID: ${asset.uid || "N/A"}`,
              imageFrameWidth - 4
            );
            const nameY = 66;
            const uidY = nameY + nameLines.length * 4.5 + 4;

            return {
              asset,
              nameLines,
              uidLines,
              uidY,
              height: Math.max(84, uidY + uidLines.length * 4.5 + 4),
            };
          });
          const rowHeight = Math.max(...rowLayouts.map((layout) => layout.height));

          if (imageRowY + rowHeight > pageHeight - margin) {
            doc.addPage();
            y = 20;
            drawSectionHeader("Asset With Images");
            imageRowY = y;
          }

          for (const [columnIndex, layout] of rowLayouts.entries()) {
            const safeX = margin + columnIndex * 92;
            const safeY = imageRowY;

            try {
              const normalizedImage = await normalizeImageForPdf(layout.asset.image);
              const imageProperties = doc.getImageProperties(normalizedImage);
              const scale = Math.min(
                imageFrameWidth / imageProperties.width,
                imageFrameHeight / imageProperties.height
              );
              const imageWidth = imageProperties.width * scale;
              const imageHeight = imageProperties.height * scale;
              doc.addImage(
                normalizedImage,
                "JPEG",
                safeX + (imageFrameWidth - imageWidth) / 2,
                safeY + 2 + (imageFrameHeight - imageHeight) / 2,
                imageWidth,
                imageHeight
              );
            } catch (error) {
              doc.setFillColor(248, 250, 252);
              doc.rect(safeX, safeY + 2, imageFrameWidth, imageFrameHeight, "F");
              doc.setDrawColor(203, 213, 225);
              doc.rect(safeX, safeY + 2, imageFrameWidth, imageFrameHeight, "S");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              doc.text("No Image", safeX + 25, safeY + 32);
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(layout.nameLines, safeX + 2, safeY + 66);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(layout.uidLines, safeX + 2, safeY + layout.uidY);
          }

          imageRowY += rowHeight + 8;
        }

        y = imageRowY;
        if (options.includeLocationSummary || options.includeActivity) {
          doc.addPage();
          y = 20;
        }
      }
    }

    if (options.includeLocationSummary) {
      drawSectionHeader("Asset Location Summary");

      const roomSections = [
        ["Room 1", exportedRoom1Assets],
        ["Outside", exportedOutsideAssets],
      ];

      for (const [label, items] of roomSections) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`${label} — ${items.length} Assets`, margin, y);
        y += 7;

        if (items.length === 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text("No assets found.", margin + 6, y);
          y += 8;
          continue;
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        for (const asset of items) {
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
          doc.text(`• ${asset.assetName || "Unnamed Asset"} | ${asset.uid || "N/A"}`, margin + 6, y);
          y += 6;
        }

        y += 6;
      }
    }

    if (options.includeActivity) {
      drawSectionHeader("Recent RFID Activity");

      const confirmedLogs = (reportLogs.filter((log) => log.action === "ENTER" || log.action === "EXIT")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 30));
      const activityRows = confirmedLogs.length > 0 ? confirmedLogs : reportLogs.slice(0, 30);

      const activityTableX = margin;
      const activityCols = {
        date: 25,
        time: 18,
        asset: 31,
        uid: 31,
        movement: 17,
        destination: 33,
      };
      const activityWidth = Object.values(activityCols).reduce((sum, width) => sum + width, 0);
      const activityHeaders = ["Date", "Time", "Asset", "UID", "Movement", "Destination"];

      const drawActivityHeader = (x: number, headerY: number) => {
        doc.setFillColor(226, 232, 240);
        doc.rect(x, headerY, activityWidth, 8, "F");
        doc.setDrawColor(148, 163, 184);
        doc.rect(x, headerY, activityWidth, 8, "S");

        let headerX = x;
        activityHeaders.forEach((label, index) => {
          const width = Object.values(activityCols)[index] ?? 20;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.2);
          doc.text(label, headerX + 2, headerY + 5.5);
          headerX += width;
        });
      };

      const drawActivityRow = (log: any, rowY: number) => {
        const rowX = activityTableX;
        const dateValue = new Date(log.createdAt);
        const dateText = Number.isNaN(dateValue.getTime()) ? "N/A" : dateValue.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const timeText = Number.isNaN(dateValue.getTime()) ? "N/A" : dateValue.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const assetName = log.assetName || "Unknown Asset";
        const movement = log.action === "EXIT" ? "EXIT" : "ENTER";
        const destination = log.action === "EXIT" ? "Outside" : log.toRoom || "Room1";

        const fieldSets = [dateText, timeText, assetName, log.uid || "N/A", movement, destination];

        let cellX = rowX;
        let maxLines = 1;
        const textData = fieldSets.map((value, index) => {
          const width = Object.values(activityCols)[index] ?? 20;
          const lines = doc.splitTextToSize(String(value), width - 4);
          maxLines = Math.max(maxLines, lines.length);
          return { value: lines, width };
        });

        const rowHeight = Math.max(11, maxLines * 4 + 5);
        doc.setFillColor(255, 255, 255);
        doc.rect(rowX, rowY, activityWidth, rowHeight, "F");
        doc.setDrawColor(203, 213, 225);
        doc.rect(rowX, rowY, activityWidth, rowHeight, "S");

        textData.forEach(({ value, width }) => {
          const startX = cellX;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          const lineHeight = 4;
          const topOffset = rowY + 5 + (rowHeight - (value.length * lineHeight)) / 2;
          doc.text(value, startX + 2, topOffset);
          cellX += width;
        });

        return rowHeight;
      };

      if (activityRows.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("No RFID activity recorded for this export.", margin, y);
        y += 10;
      } else {
        let activityY = y;
        drawActivityHeader(activityTableX, activityY);
        activityY += 9;

        for (const log of activityRows) {
          const estimatedRowHeight = Math.max(
            11,
            Math.max(
              doc.splitTextToSize(new Date(log.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), activityCols.date - 4).length,
              doc.splitTextToSize(log.assetName || "Unknown Asset", activityCols.asset - 4).length,
              doc.splitTextToSize(log.uid || "N/A", activityCols.uid - 4).length,
              doc.splitTextToSize(log.action === "EXIT" ? "EXIT" : "ENTER", activityCols.movement - 4).length,
              doc.splitTextToSize((log.action === "EXIT" ? "Outside" : log.toRoom) || "Room1", activityCols.destination - 4).length
            ) * 4 + 6
          );

          if (activityY + estimatedRowHeight > pageHeight - 16) {
            doc.addPage();
            activityY = 20;
            drawActivityHeader(activityTableX, activityY);
            activityY += 9;
          }

          const rowHeight = drawActivityRow(log, activityY);
          activityY += rowHeight + 1;
        }

        y = activityY + 11;
      }
    }

    drawFooterForAllPages();
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
                    <input
                      type="radio"
                      name="exportScope"
                      value={value}
                      checked={exportScope === value}
                      onChange={() => setExportScope(value as ExportScope)}
                      className="mt-1"
                    />
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
              <div className="mb-4 flex items-center gap-2" role="tablist" aria-label="Report sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeReportTab === "activity"}
                  onClick={() => setActiveReportTab("activity")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeReportTab === "activity"
                      ? "bg-red-600 text-white"
                      : "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                  }`}
                >
                  Recent RFID Activity
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeReportTab === "assetInfo"}
                  onClick={() => setActiveReportTab("assetInfo")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeReportTab === "assetInfo"
                      ? "bg-red-600 text-white"
                      : "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                  }`}
                >
                  Asset Info Reports
                </button>
              </div>

              {activeReportTab === "activity" && (
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
              )}
              {activeReportTab === "assetInfo" && (
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    From:
                    <input
                      type="date"
                      value={issueReportFilters.from}
                      onChange={(event) =>
                        setIssueReportFilters((filters) => ({
                          ...filters,
                          from: event.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    To:
                    <input
                      type="date"
                      value={issueReportFilters.to}
                      onChange={(event) =>
                        setIssueReportFilters((filters) => ({
                          ...filters,
                          to: event.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </label>
                  <select
                    value={issueReportFilters.type}
                    onChange={(event) =>
                      setIssueReportFilters((filters) => ({
                        ...filters,
                        type: event.target.value,
                      }))
                    }
                    className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Filter issue reports by type"
                  >
                    <option value="all">All types</option>
                    {ASSET_REPORT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <select
                    value={issueReportFilters.status}
                    onChange={(event) =>
                      setIssueReportFilters((filters) => ({
                        ...filters,
                        status: event.target.value,
                      }))
                    }
                    className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Filter issue reports by status"
                  >
                    <option value="all">All statuses</option>
                    {ASSET_REPORT_STATUSES.map((status) => (
                      <option key={status} value={status}>{formatReportStatus(status)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {activeReportTab === "activity" ? (
              <>
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
              </>
            ) : (
              <div className="space-y-6 p-6">
                {isLoadingIssueSummary ? (
                  <p className="py-8 text-center text-gray-500">
                    Loading issue report summary...
                  </p>
                ) : issueSummaryError ? (
                  <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
                    {issueSummaryError}
                  </p>
                ) : !issueReportSummary ? (
                  <p className="py-8 text-center text-gray-500">
                    Issue report summary is unavailable.
                  </p>
                ) : issueReportSummary.totalReports === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
                    No issue reports yet.
                  </div>
                ) : issueReportSummary.filteredTotal === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
                    No issue reports match these filters.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["Open", issueReportSummary.reportCounts.open, "text-amber-700"],
                        ["In review", issueReportSummary.reportCounts.in_review, "text-blue-700"],
                        ["Resolved", issueReportSummary.reportCounts.resolved, "text-green-700"],
                        ["Dismissed", issueReportSummary.reportCounts.dismissed, "text-gray-700"],
                        ["Last 7 days", issueReportSummary.lastSevenDaysCount, "text-red-700"],
                      ].map(([label, count, color]) => (
                        <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                          <p className="text-sm text-gray-500">{label}</p>
                          <p className={`mt-2 text-3xl font-bold ${color}`}>{count}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <section className="rounded-xl border border-gray-200 p-5">
                        <h3 className="mb-4 text-lg font-semibold text-gray-900">
                          Reports by type
                        </h3>
                        <div className="space-y-4">
                          {issueReportSummary.typeCounts.map((item) => {
                            const maxCount = Math.max(
                              1,
                              ...issueReportSummary.typeCounts.map((entry) => entry.count)
                            );
                            return (
                              <div key={item.type}>
                                <div className="mb-1 flex justify-between gap-3 text-sm">
                                  <span className="text-gray-700">{item.type}</span>
                                  <span className="font-semibold text-gray-900">{item.count}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-red-600"
                                    style={{
                                      width: `${(item.count / maxCount) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <section className="rounded-xl border border-gray-200 p-5">
                        <h3 className="mb-4 text-lg font-semibold text-gray-900">
                          Most reported assets
                        </h3>
                        {issueReportSummary.mostReportedAssets.length === 0 ? (
                          <p className="text-sm text-gray-500">No reports for these filters.</p>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {issueReportSummary.mostReportedAssets.map((asset) => (
                              <div
                                key={asset.assetId}
                                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-gray-900">
                                    {asset.assetName}
                                  </p>
                                  <p className="text-sm text-gray-500">Tag ID: {asset.tagId}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                                  {asset.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    <section className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="border-b bg-gray-50 px-5 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Latest reports</h3>
                      </div>
                      {issueReportSummary.latestReports.length === 0 ? (
                        <p className="p-5 text-sm text-gray-500">No reports for these filters.</p>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {issueReportSummary.latestReports.map((report) => (
                            <Link
                              key={report._id}
                              href={`/issue-reports?reportId=${encodeURIComponent(report._id)}`}
                              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-gray-50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-gray-900">
                                  {report.assetName} <span className="font-normal text-gray-500">· {report.tagId}</span>
                                </span>
                                <span className="mt-1 block text-sm text-gray-600">
                                  {report.type} · Reported by {report.reporter?.name || "Unknown"}
                                </span>
                              </span>
                              <span className="flex items-center gap-3">
                                <span className={`rounded-full px-3 py-1 text-xs font-medium ${reportStatusClass(report.status)}`}>
                                  {formatReportStatus(report.status)}
                                </span>
                                <time
                                  className="whitespace-nowrap text-sm text-gray-500"
                                  dateTime={report.createdAt}
                                >
                                  {formatReportDate(report.createdAt)}
                                </time>
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            {role === "sysadmin" && activeReportTab === "activity" && (
              <button
                type="button"
                onClick={openClearReportModal}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition"
              >
                Clear All RFID Activity
              </button>
            )}
            {role === "sysadmin" && activeReportTab === "assetInfo" && (
              <button
                type="button"
                onClick={openClearIssueReportsModal}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition"
              >
                Clear All Asset Info Reports
              </button>
            )}
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
              Clear All RFID Activity
            </h2>
            <p className="mt-4 text-gray-700">
              This deletes all scan logs, including the room movement history shown in
              Rooms/Locations, and cannot be undone.
            </p>
            {clearActivityError && (
              <p className="mt-4 text-sm text-red-700" role="alert">
                {clearActivityError}
              </p>
            )}
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
                  ? "Deleting..."
                  : clearCountdown > 0
                    ? `Delete all scan logs (${clearCountdown})`
                    : "Delete all scan logs"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearIssueReportsModal && role === "sysadmin" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <button
              type="button"
              aria-label="Close clear issue reports confirmation"
              onClick={() => setShowClearIssueReportsModal(false)}
              className="absolute right-4 top-3 text-2xl text-gray-500 hover:text-gray-900"
            >
              ×
            </button>
            <h2 className="pr-8 text-xl font-bold text-gray-900">
              Clear All Asset Info Reports
            </h2>
            <p className="mt-4 text-gray-700">
              This deletes all issue reports and their pictures and cannot be undone.
            </p>
            {issueReportsClearError && (
              <p className="mt-4 text-sm text-red-700" role="alert">
                {issueReportsClearError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearIssueReportsModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingIssueReports}
                onClick={() => void handleClearAllIssueReports()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isClearingIssueReports
                  ? "Deleting..."
                  : "Delete all issue reports"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}