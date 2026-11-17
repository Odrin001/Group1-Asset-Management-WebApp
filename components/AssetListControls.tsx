"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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

type LocationOption = {
  key: string;
  displayName: string;
};

const fixedLocationKeys = ["Room1", "Outside"];

function isLocationOption(value: unknown): value is LocationOption {
  return (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    typeof value.key === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string"
  );
}

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

const supportedStatuses = ["active", "inactive", "maintenance", "retired"];
const supportedConditions = ["new", "good", "fair", "poor"];

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
  globalSearch = "",
  includeSupportedStatusAndConditionOptions = false,
  canLoadRooms = false
) {
  const [filters, setFilters] = useState<AssetFilters>(defaultFilters);
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [rooms, setRooms] = useState<LocationOption[]>([]);

  useEffect(() => {
    if (!canLoadRooms) {
      setRooms([]);
      return;
    }

    let active = true;

    async function loadRooms() {
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok) {
          return;
        }

        const data: unknown = await response.json();
        if (
          typeof data !== "object" ||
          data === null ||
          !("rooms" in data) ||
          !Array.isArray(data.rooms)
        ) {
          return;
        }

        const loadedRooms = data.rooms
          .filter(isLocationOption)
          .filter((room) => fixedLocationKeys.includes(room.key));
        if (active) {
          setRooms(loadedRooms);
        }
      } catch {
        // Fixed keys and asset locations remain available if display names cannot be loaded.
      }
    }

    void loadRooms();
    return () => {
      active = false;
    };
  }, [canLoadRooms]);

  const locationOptions = useMemo(() => {
    const keys = new Map<string, string>();
    for (const key of fixedLocationKeys) {
      keys.set(key.toLowerCase(), key);
    }
    for (const asset of assets) {
      if (asset.location) {
        const normalizedKey = asset.location.toLowerCase();
        if (!keys.has(normalizedKey)) {
          keys.set(normalizedKey, asset.location);
        }
      }
    }

    const displayNames = new Map(
      rooms.map((room) => [room.key.toLowerCase(), room.displayName])
    );
    return Array.from(keys, ([normalizedKey, key]) => ({
      key,
      displayName: displayNames.get(normalizedKey) || key,
    }));
  }, [assets, rooms]);

  const categories = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.category).filter(Boolean))).sort(compareText),
    [assets]
  );
  const statuses = useMemo(
    () =>
      Array.from(
        new Set([
          ...(includeSupportedStatusAndConditionOptions ? supportedStatuses : []),
          ...assets.map((asset) => asset.assetStatus).filter(Boolean),
        ])
      ).sort(compareText),
    [assets, includeSupportedStatusAndConditionOptions]
  );
  const conditions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(includeSupportedStatusAndConditionOptions ? supportedConditions : []),
          ...assets.map((asset) => asset.condition).filter(Boolean),
        ])
      ).sort(compareText),
    [assets, includeSupportedStatusAndConditionOptions]
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
      const matchesLocation = !normalizedLocation ||
        location.includes(normalizedLocation) ||
        rooms.some(
          (room) =>
            room.key.toLowerCase() === location &&
            room.displayName.toLowerCase().includes(normalizedLocation)
        );
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
  }, [assets, filters, globalSearch, rooms, sortOption]);

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
    locationOptions,
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
  locationOptions: LocationOption[];
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
  locationOptions,
  statuses,
  conditions,
  sortOption,
  setSortOption,
  activeFilterCount,
  clearFilters,
}: AssetListControlsProps) {
  const [openPanel, setOpenPanel] = useState<"filter" | "sort" | null>(null);
  const [isLocationListOpen, setIsLocationListOpen] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState(-1);
  const locationContainerRef = useRef<HTMLDivElement>(null);
  const updateFilter = (field: keyof AssetFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };
  const normalizedLocationQuery = filters.location.trim().toLowerCase();
  const matchingLocations = locationOptions.filter(
    (location) =>
      !normalizedLocationQuery ||
      location.displayName.toLowerCase().includes(normalizedLocationQuery) ||
      location.key.toLowerCase().includes(normalizedLocationQuery)
  );

  useEffect(() => {
    function closeLocationListOutside(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        !locationContainerRef.current?.contains(event.target)
      ) {
        setIsLocationListOpen(false);
        setActiveLocationIndex(-1);
      }
    }

    document.addEventListener("mousedown", closeLocationListOutside);
    return () => {
      document.removeEventListener("mousedown", closeLocationListOutside);
    };
  }, []);

  const chooseLocation = (location: LocationOption) => {
    updateFilter("location", location.key);
    setIsLocationListOpen(false);
    setActiveLocationIndex(-1);
  };

  const handleLocationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && matchingLocations.length > 0) {
      event.preventDefault();
      setIsLocationListOpen(true);
      setActiveLocationIndex((current) =>
        current < matchingLocations.length - 1 ? current + 1 : 0
      );
    } else if (event.key === "ArrowUp" && matchingLocations.length > 0) {
      event.preventDefault();
      setIsLocationListOpen(true);
      setActiveLocationIndex((current) =>
        current <= 0 ? matchingLocations.length - 1 : current - 1
      );
    } else if (
      event.key === "Enter" &&
      isLocationListOpen &&
      activeLocationIndex >= 0
    ) {
      const location = matchingLocations[activeLocationIndex];
      if (location) {
        event.preventDefault();
        chooseLocation(location);
      }
    } else if (event.key === "Escape") {
      setIsLocationListOpen(false);
      setActiveLocationIndex(-1);
    }
  };

  return (
    <div className="relative flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto">
      <input
        type="search"
        aria-label="Search asset name"
        value={filters.name}
        onChange={(event) => updateFilter("name", event.target.value)}
        placeholder="Search asset name..."
        className="w-64 min-w-0 flex-1 rounded border border-gray-300 px-3 py-1 text-sm font-normal outline-none focus:border-red-500 sm:flex-none"
      />
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
          <div className="mb-3">
            <label htmlFor="asset-location-filter" className="block font-medium text-gray-700">
              Location
            </label>
            <div ref={locationContainerRef} className="mt-1">
              <input
                id="asset-location-filter"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isLocationListOpen}
                aria-controls="asset-location-options"
                aria-activedescendant={
                  isLocationListOpen && activeLocationIndex >= 0
                    ? `asset-location-option-${activeLocationIndex}`
                    : undefined
                }
                value={filters.location}
                onChange={(event) => {
                  updateFilter("location", event.target.value);
                  setIsLocationListOpen(true);
                  setActiveLocationIndex(-1);
                }}
                onFocus={() => {
                  setIsLocationListOpen(true);
                  setActiveLocationIndex(-1);
                }}
                onKeyDown={handleLocationKeyDown}
                placeholder="Search location..."
                className="w-full rounded border border-gray-300 px-3 py-2 font-normal outline-none focus:border-red-500"
              />
              {isLocationListOpen && (
                <ul
                  id="asset-location-options"
                  role="listbox"
                  className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {matchingLocations.length > 0 ? (
                    matchingLocations.map((location, index) => (
                      <li
                        key={location.key}
                        id={`asset-location-option-${index}`}
                        role="option"
                        aria-selected={index === activeLocationIndex}
                      >
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseLocation(location)}
                          className={`w-full px-3 py-2 text-left font-normal text-gray-800 hover:bg-gray-50 ${
                            index === activeLocationIndex ? "bg-gray-100" : ""
                          }`}
                        >
                          {location.displayName}
                          {location.displayName !== location.key && (
                            <span className="ml-1 text-gray-500">({location.key})</span>
                          )}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 font-normal text-gray-500">
                      No matching locations.
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
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
