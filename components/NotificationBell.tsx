"use client";

import { useCallback, useEffect, useState } from "react";

type NotificationItem = {
  _id: string;
  message: string;
  createdAt: string;
  severity: "normal" | "notice" | "warning" | "critical";
  isRead: boolean;
  maintenanceMessage?: string;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function severityClasses(severity: NotificationItem["severity"]) {
  if (severity === "critical") {
    return "border-l-4 border-red-500 bg-red-50";
  }
  if (severity === "warning") {
    return "border-l-4 border-amber-500 bg-amber-50";
  }
  if (severity === "notice") {
    return "border-l-4 border-blue-400 bg-blue-50";
  }
  return "border-l-4 border-transparent bg-white";
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  const refreshNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to load notifications");
      }

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setError("");
    } catch (requestError) {
      console.error("Error refreshing notifications:", requestError);
      setError("Notifications could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
    const intervalId = window.setInterval(() => {
      void refreshNotifications();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [refreshNotifications]);

  async function markAllAsRead() {
    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update notifications");
      }
      await refreshNotifications();
    } catch (requestError) {
      console.error("Error marking notifications as read:", requestError);
      setError("Notifications could not be marked as read.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-white px-1 text-center text-xs font-bold leading-5 text-red-700 shadow">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={unreadCount === 0}
              className="text-sm font-medium text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Mark all as read
            </button>
          </div>

          {error ? (
            <p className="px-4 py-6 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
              {notifications.map((notification) => (
                <li
                  key={notification._id}
                  className={`px-4 py-3 ${severityClasses(notification.severity)} ${
                    notification.isRead ? "opacity-70" : ""
                  }`}
                >
                  <p className="text-sm">{notification.message}</p>
                  {notification.maintenanceMessage && (
                    <span
                      className={`mt-1 inline-block text-xs font-semibold ${
                        notification.severity === "critical"
                          ? "text-red-700"
                          : "text-amber-700"
                      }`}
                    >
                      {notification.maintenanceMessage}
                    </span>
                  )}
                  <time
                    className="mt-1 block text-xs text-slate-500"
                    dateTime={notification.createdAt}
                  >
                    {formatTimestamp(notification.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
