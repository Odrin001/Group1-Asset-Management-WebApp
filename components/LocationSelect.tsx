"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type RoomOption = {
  key: string;
  displayName: string;
};

type LocationSelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  helperText?: string;
  icon?: ReactNode;
  labelContainerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
};

function isRoomOption(value: unknown): value is RoomOption {
  return (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    typeof value.key === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string"
  );
}

export default function LocationSelect({
  id,
  value,
  onChange,
  label,
  required = false,
  helperText,
  icon,
  labelContainerClassName = "mb-2 flex items-center gap-2",
  labelClassName = "text-sm font-semibold text-gray-900",
  inputClassName = "w-full rounded-lg border border-gray-300 px-4 py-3 text-black transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500",
}: LocationSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [query, setQuery] = useState(value);
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRooms() {
      try {
        const response = await fetch("/api/rooms");
        const data: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof data === "object" &&
            data !== null &&
            "message" in data &&
            typeof data.message === "string"
              ? data.message
              : "Unable to load locations.";
          throw new Error(message);
        }
        if (
          typeof data !== "object" ||
          data === null ||
          !("rooms" in data) ||
          !Array.isArray(data.rooms)
        ) {
          throw new Error("Unable to load locations.");
        }

        const loadedRooms = data.rooms.filter(isRoomOption);
        if (loadedRooms.length === 0) {
          throw new Error("No locations are available.");
        }
        if (active) {
          setRooms(loadedRooms);
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load locations."
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadRooms();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isTyping) {
      setQuery(rooms.find((room) => room.key === value)?.displayName || value);
    }
  }, [isTyping, rooms, value]);

  useEffect(() => {
    function handleOutsideMouseDown(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideMouseDown);
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const matchingRooms = rooms.filter(
    (room) =>
      room.displayName.toLowerCase().includes(normalizedQuery) ||
      room.key.toLowerCase().includes(normalizedQuery)
  );

  function chooseRoom(room: RoomOption) {
    onChange(room.key);
    setQuery(room.displayName);
    setIsTyping(false);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && matchingRooms.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current < matchingRooms.length - 1 ? current + 1 : 0
      );
    } else if (event.key === "ArrowUp" && matchingRooms.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? matchingRooms.length - 1 : current - 1
      );
    } else if (event.key === "Enter" && isOpen && activeIndex >= 0) {
      event.preventDefault();
      chooseRoom(matchingRooms[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const disabled = isLoading || Boolean(loadError);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <div className={labelContainerClassName}>
          {icon && <span className="text-gray-500">{icon}</span>}
          <label htmlFor={id} className={labelClassName}>
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        </div>
      )}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen && !disabled}
        aria-controls={`${id}-options`}
        aria-activedescendant={
          isOpen && activeIndex >= 0
            ? `${id}-option-${activeIndex}`
            : undefined
        }
        aria-required={required}
        required={required}
        value={query}
        disabled={disabled}
        onFocus={() => {
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsTyping(true);
          setIsOpen(true);
          setActiveIndex(-1);
          onChange("");
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search locations..."
        className={`${inputClassName} disabled:cursor-not-allowed disabled:bg-gray-50`}
      />
      {isLoading ? (
        <p className="mt-1 text-xs text-gray-500" role="status">
          Loading locations...
        </p>
      ) : loadError ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {loadError}
        </p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      ) : null}
      {isOpen && !disabled && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {matchingRooms.length > 0 ? (
            matchingRooms.map((room, index) => (
              <li
                key={room.key}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseRoom(room)}
                  className={`w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 ${
                    index === activeIndex ? "bg-gray-100" : ""
                  }`}
                >
                  {room.displayName} <span className="text-gray-500">({room.key})</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-sm text-gray-500">
              No matching locations.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
