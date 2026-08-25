"use client";

import { useMemo, useState } from "react";
import { Asset } from "@/lib/types";

export type SortOption =
  | "default"
  | "name-asc"
  | "name-desc"
  | "date-desc"
  | "date-asc"
  | "location-asc"
  | "location-desc"
  | "status"
  | "condition"
  | "category";

type ImageFilter = "all" | "has-image" | "no-image";

export interface AssetFilters {
  name: string;
  image: ImageFilter;
  category: string;
  fromDate: string;
  toDate: string;
  location: string;
  status: string;
  condition: string;
}

const defaultFilters: AssetFilters = {
  name: "",
  image: "all",
  category: "all",
  fromDate: "",
  toDate: "",
  location: "",
  status: "all",
  condition: "all",
};

const sortLabels: Record<SortOption, string> = {
  default: "Default Sort",
  "name-asc": "Asset Name: A to Z",
  "name-desc": "Asset Name: Z to A",
  "date-desc": "Date Registered: Newest to Oldest",
  "date-asc": "Date Registered: Oldest to Newest",
  "location-asc": "Location: A to Z",
  "location-desc": "Location: Z to A",
  status: "Status",
  condition: "Condition",
  category: "Category",
};

const compareText = (first: string, second: string) =>
  first.localeCompare(second, undefined, { sensitivity: "base" });

export function useAssetListControls(
  assets: Asset[],
  globalSearch = ""
) {
  const [filters, setFilters] = useState<AssetFilters>(defaultFilters);
  const [sortOption, setSortOption] = useState<SortOption>("default");

  const categories = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.category).filter(Boolean))).sort(compareText),
    [assets]
  );
  const statuses = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.assetStatus).filter(Boolean))).sort(compareText),
    [assets]
  );
  const conditions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.condition).filter(Boolean))).sort(compareText),
    [assets]
  );

  const visibleAssets = useMemo(() => {
    const normalizedGlobalSearch = globalSearch.trim().toLowerCase();
    const normalizedName = filters.name.trim().toLowerCase();
    const normalizedLocation = filters.location.trim().toLowerCase();

    const filtered = assets.filter((asset) => {
      const assetName = asset.name?.toLowerCase() || "";
      const category = asset.category?.toLowerCase() || "";
      const location = asset.location?.toLowerCase() || "";
      const date = asset.dateRegistered || "";

      const matchesGlobalSearch = !normalizedGlobalSearch ||
        assetName.includes(normalizedGlobalSearch) ||
        category.includes(normalizedGlobalSearch) ||
        location.includes(normalizedGlobalSearch) ||
        asset.assetType?.toLowerCase().includes(normalizedGlobalSearch);
      const matchesName = !normalizedName || assetName.includes(normalizedName);
      const matchesImage = filters.image === "all" ||
        (filters.image === "has-image" ? Boolean(asset.image) : !asset.image);
      const matchesCategory = filters.category === "all" || asset.category === filters.category;
      const matchesFromDate = !filters.fromDate || date >= filters.fromDate;
      const matchesToDate = !filters.toDate || date <= filters.toDate;
      const matchesLocation = !normalizedLocation || location.includes(normalizedLocation);
      const matchesStatus = filters.status === "all" || asset.assetStatus === filters.status;
      const matchesCondition = filters.condition === "all" || asset.condition === filters.condition;

      return matchesGlobalSearch && matchesName && matchesImage && matchesCategory &&
        matchesFromDate && matchesToDate && matchesLocation && matchesStatus && matchesCondition;
    });

    if (sortOption === "default") return filtered;

    return [...filtered].sort((first, second) => {
      switch (sortOption) {
        case "name-asc": return compareText(first.name, second.name);
        case "name-desc": return compareText(second.name, first.name);
        case "date-desc": return second.dateRegistered.localeCompare(first.dateRegistered);
        case "date-asc": return first.dateRegistered.localeCompare(second.dateRegistered);
        case "location-asc": return compareText(first.location, second.location);
        case "location-desc": return compareText(second.location, first.location);
        case "status": return compareText(first.assetStatus, second.assetStatus);
        case "condition": return compareText(first.condition, second.condition);
        case "category": return compareText(first.category, second.category);
      }
    });
  }, [assets, filters, globalSearch, sortOption]);

  const activeFilterCount = Object.entries(filters).filter(([key, value]) =>
    key === "image" || key === "category" || key === "status" || key === "condition"
      ? value !== "all"
      : Boolean(value)
  ).length;

  return {
    filters,
    setFilters,
    visibleAssets,
    categories,
    statuses,
    conditions,
    sortOption,
    setSortOption,
    activeFilterCount,
    clearFilters: () => setFilters(defaultFilters),
  };
}

interface AssetListControlsProps {
  filters: AssetFilters;
  setFilters: React.Dispatch<React.SetStateAction<AssetFilters>>;
  categories: string[];
  statuses: string[];
  conditions: string[];
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  activeFilterCount: number;
  clearFilters: () => void;
}

export function AssetListControls({
  filters,
  setFilters,
  categories,
  statuses,
  conditions,
  sortOption,
  setSortOption,
  activeFilterCount,
  clearFilters,
}: AssetListControlsProps) {
  const [openPanel, setOpenPanel] = useState<"filter" | "sort" | null>(null);
  const updateFilter = (field: keyof AssetFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="relative flex gap-2">
      <button
        type="button"
        onClick={() => setOpenPanel(openPanel === "filter" ? null : "filter")}
        className={`px-3 py-1 text-sm border rounded hover:bg-gray-100 transition ${activeFilterCount ? "border-red-500 text-red-600" : "border-gray-300"}`}
      >
        Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
      </button>
      <button
        type="button"
        onClick={() => setOpenPanel(openPanel === "sort" ? null : "sort")}
        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 transition"
      >
        Sort{sortOption !== "default" ? " *" : ""}
      </button>

      {openPanel === "filter" && (
        <div className="absolute right-0 top-10 z-30 w-[min(90vw,22rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">Filter Assets</h4>
            <button type="button" onClick={clearFilters} className="text-xs font-medium text-red-600 hover:text-red-700">Clear Filters</button>
          </div>
          <label className="mb-3 block font-medium text-gray-700">Asset Name
            <input value={filters.name} onChange={(event) => updateFilter("name", event.target.value)} placeholder="Search asset name..." className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal outline-none focus:border-red-500" />
          </label>
          <fieldset className="mb-3">
            <legend className="mb-1 font-medium text-gray-700">Image</legend>
            {[["all", "All"], ["has-image", "Has Image"], ["no-image", "No Image"]].map(([value, label]) => (
              <label key={value} className="mr-3 inline-flex items-center gap-1 font-normal text-gray-600">
                <input type="radio" name="image-filter" checked={filters.image === value} onChange={() => updateFilter("image", value)} /> {label}
              </label>
            ))}
          </fieldset>
          <label className="mb-3 block font-medium text-gray-700">Category
            <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal">
              <option value="all">All</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="font-medium text-gray-700">From<input type="date" value={filters.fromDate} onChange={(event) => updateFilter("fromDate", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-2 font-normal" /></label>
            <label className="font-medium text-gray-700">To<input type="date" value={filters.toDate} onChange={(event) => updateFilter("toDate", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-2 font-normal" /></label>
          </div>
          <label className="mb-3 block font-medium text-gray-700">Location
            <input value={filters.location} onChange={(event) => updateFilter("location", event.target.value)} placeholder="Search location..." className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal outline-none focus:border-red-500" />
          </label>
          <label className="mb-3 block font-medium text-gray-700">Status
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal">
              <option value="all">All</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="block font-medium text-gray-700">Condition
            <select value={filters.condition} onChange={(event) => updateFilter("condition", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal">
              <option value="all">All</option>{conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
            </select>
          </label>
        </div>
      )}

      {openPanel === "sort" && (
        <div className="absolute right-0 top-10 z-30 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
          {(Object.keys(sortLabels) as SortOption[]).map((option) => (
            <button key={option} type="button" onClick={() => { setSortOption(option); setOpenPanel(null); }} className={`block w-full rounded px-3 py-2 text-left text-sm ${sortOption === option ? "bg-red-50 font-semibold text-red-700" : "text-gray-700 hover:bg-gray-100"}`}>
              {sortLabels[option]}{sortOption === option ? "  ✓" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
