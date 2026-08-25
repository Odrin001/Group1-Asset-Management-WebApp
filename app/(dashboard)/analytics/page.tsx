"use client";

import { useEffect, useState } from "react";

type ScanLog = {
  action: string;
  time: string;
  date: string;
  uid: string;
  fromRoom: string;
  toRoom: string;
  assetName: string;
  createdAt: string;
};

function generateUID(): string {
  const prefix = "E2003412017A1101890A1C";
  const suffix = Math.floor(Math.random() * 90 + 10).toString();
  return prefix + suffix;
}

function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getCurrentDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ScanLog[]>([]);
  const [searchAsset, setSearchAsset] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("All");
  const [dateFromStr, setDateFromStr] = useState("");
  const [dateToStr, setDateToStr] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 15;

  const fetchLogs = async () => {
  try {
    const response = await fetch(
      "/api/scanner/logs"
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      setLogs(
        data.map((log) => ({
          ...log,
          uid: log.uid || generateUID(),
          time: log.time || getCurrentTime(),
          date: log.date || getCurrentDate(),
        }))
      );
    } else {
      console.error("Data is not an array", data);
      setLogs([]);
    }
  } catch (error) {
    console.error("Failed to fetch logs");
  }
};

  useEffect(() => {
  fetchLogs();

  const interval = setInterval(() => {
    fetchLogs();
  }, 2000);

  const handleKey = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    if (key === "r") {
      setLogs([]);
    }
  };

  window.addEventListener("keydown", handleKey);

  return () => {
    clearInterval(interval);
    window.removeEventListener("keydown", handleKey);
  };
}, []);

  // Filter logs by room, search, and date range
  useEffect(() => {
    let filtered = [...logs];

    // Filter by room
    if (selectedRoom === "All") {
      filtered = filtered;
    } else if (selectedRoom === "Outside") {
      filtered = filtered.filter(
        (log) => log.action === "EXIT" && log.toRoom === "-"
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

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900">
          Live Scanner
        </h1>

        <p className="text-gray-600 text-lg mt-2">
          Monitor real-time asset movement
        </p>

        <p className="text-sm text-red-500 mt-2">
          Press R to reset
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Top Bar */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            Recent Scan Activity
          </h2>

          <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>

            LIVE SCANNING
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <input
            type="text"
            placeholder="Search asset..."
            value={searchAsset}
            onChange={(e) => setSearchAsset(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          {/* Room Filter */}
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          {/* Date To */}
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            To:
            <input
              type="datetime-local"
              value={dateToStr}
              onChange={(e) => setDateToStr(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-green-500"
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
            <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
              Filter ({activeFilters})
            </span>
          )}
        </div>

        {/* Table */}
        {filteredLogs.length > 0 ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">Action</th>
                    <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">Time</th>
                    <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">UID</th>
                    <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">From Room</th>
                    <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">To Room</th>
                    <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">Asset Name</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedLogs.map((log, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-8 py-5">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium text-white ${
                            log.action === "ENTER"
                              ? "bg-green-600"
                              : "bg-red-600"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="px-8 py-5 text-gray-700">
                        {new Date(log.createdAt).toLocaleDateString("en-GB")}
                      </td>

                      <td className="px-8 py-5 text-gray-700">
                        {log.time}
                      </td>

                      <td className="px-8 py-5 font-medium text-gray-900">
                        {log.uid}
                      </td>

                      <td className="px-8 py-5 text-gray-700">
                        {log.fromRoom}
                      </td>

                      <td className="px-8 py-5 text-gray-700">
                        {log.toRoom}
                      </td>

                      <td className="px-8 py-5 font-medium text-gray-900">
                        {log.assetName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-6 bg-gray-50 flex flex-col items-center gap-4 border-t">
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
                              ? "bg-green-600 text-white"
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
        ) : (
          <div className="py-20 text-center">
            <p className="text-xl font-semibold text-gray-700">
              No matching scan activity found
            </p>

            <p className="text-gray-500 mt-2">
              {logs.length === 0
                ? "Start scanning to see real-time asset movement"
                : "Try adjusting your filters"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}