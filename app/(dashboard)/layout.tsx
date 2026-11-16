"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import NotificationBell from "@/components/NotificationBell";

export default function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}

function DashboardShell({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, loading, canManageAssets } = useAuth();
  const canViewCurrentPage =
    role === "sysadmin" ||
    (role === "admin" && pathname !== "/accounts") ||
    (role === "guest" &&
      (pathname === "/dashboard" || pathname === "/furniture"));

  useEffect(() => {
    if (!loading && role === null) {
      router.replace("/login");
    } else if (!loading && role && !canViewCurrentPage) {
      router.replace("/dashboard");
    }
  }, [canViewCurrentPage, loading, role, router]);

  // Function to check if a route is active
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    return pathname === href;
  };

  // Function to get navigation link classes
  const getNavLinkClasses = (href: string) => {
    const baseClasses = "w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all";
    const activeClasses = "bg-slate-700 border-l-4 border-red-500 text-white";
    const inactiveClasses = "text-slate-300 hover:bg-slate-700 hover:border-l-4 hover:border-red-400 hover:text-white";

    return `${baseClasses} ${isActive(href) ? activeClasses : inactiveClasses}`;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 text-white flex flex-col shadow-xl">
        {/* Logo Section */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-700">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg
              className="w-6 h-6 text-slate-800"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <span className="font-bold text-lg text-white">AssetTrack</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {/* Assets Section */}
          <div className="text-xs font-semibold text-slate-400 uppercase px-2 py-2 mb-4">
            Assets
          </div>

          <Link
            href="/dashboard"
            className={getNavLinkClasses("/dashboard")}
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
              <path
                fillRule="evenodd"
                d="M3 10a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"
                clipRule="evenodd"
              />
            </svg>
            <span>Computer Hardware</span>
          </Link>

          <Link
            href="/furniture"
            className={getNavLinkClasses("/furniture")}
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
              <path
                fillRule="evenodd"
                d="M3 10a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"
                clipRule="evenodd"
              />
            </svg>
            <span>Furniture</span>
          </Link>
          
          {canManageAssets && (
            <Link href="/reports" className={getNavLinkClasses("/reports")}>
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4z" />
            </svg>

            <span>Asset Reports</span>
            </Link>
          )}

          {(role === "sysadmin" || role === "admin") && (
            <div className="pt-2">
              <div className="text-xs font-semibold text-slate-400 uppercase px-2 py-2 mb-2">
                Edit Logs and Rooms/Locations
              </div>
              <div className="space-y-2">
                <Link
                  href="/edit-logs"
                  className={getNavLinkClasses("/edit-logs")}
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828L14.5 9.5l-3 3-3-3 3-3 2.086-2.914zM7 12l3 3-7 7H0v-3l7-7z" />
                  </svg>
                  <span>Edit Logs</span>
                </Link>
                <Link
                  href="/rooms"
                  className={getNavLinkClasses("/rooms")}
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 2a1 1 0 011 1v1.08A6.002 6.002 0 0116.92 9H18a1 1 0 110 2h-1.08A6.002 6.002 0 0111 16.92V18a1 1 0 11-2 0v-1.08A6.002 6.002 0 013.08 11H2a1 1 0 110-2h1.08A6.002 6.002 0 019 3.08V2a1 1 0 011-1zm0 4a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                  <span>Rooms/Locations</span>
                </Link>
                <Link
                  href="/issue-reports"
                  className={getNavLinkClasses("/issue-reports")}
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v3m0 4h.01M10.3 3.9 1.8 18.5A1.7 1.7 0 003.3 21h17.4a1.7 1.7 0 001.5-2.5L13.7 3.9a2 2 0 00-3.4 0z"
                    />
                  </svg>
                  <span>Issue Reports</span>
                </Link>
              </div>
            </div>
          )}

          {role === "sysadmin" && (
            <Link href="/accounts" className={getNavLinkClasses("/accounts")}>
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM4 16a4 4 0 118 0v1H4v-1zM14 7a2.5 2.5 0 012.5 2.5c0 .9-.48 1.68-1.2 2.12A5.98 5.98 0 0118 16v1h-4v-1a5.97 5.97 0 00-1.34-3.78A4.5 4.5 0 0014 7z" />
              </svg>
              <span>Accounts</span>
            </Link>
          )}

        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 space-y-3">
            {canManageAssets && (
              <Link
                href="/analytics"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all shadow-sm"
              >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z" />
                <path d="M8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7z" />
                <path d="M14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>

              <span>Analytics</span>
              </Link>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-red-600 border-b border-red-700 px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 text-white text-sm font-medium">
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 2a1 1 0 01.832.445l6 8a1 1 0 01-.832 1.555H13v5a1 1 0 01-1 1H8a1 1 0 01-1-1v-5H4a1 1 0 01-.832-1.555l6-8A1 1 0 0110 2z" />
            </svg>
            <span className="opacity-90">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            {(role === "admin" || role === "sysadmin") && <NotificationBell />}
            <button
              onClick={async () => {
                if (confirm("Are you sure you want to sign out?")) {
                  try {
                    const response = await fetch("/api/auth/logout", {
                      method: "POST",
                    });
                    if (!response.ok) {
                      throw new Error("Sign out failed");
                    }
                    localStorage.removeItem("user");
                    router.replace("/login");
                  } catch (error) {
                    console.error("Error signing out:", error);
                    alert("Unable to sign out. Please try again.");
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all"
              title="Sign Out"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="min-h-0 flex-1 overflow-auto p-8">
          {loading ? (
            <p className="text-gray-500">Loading your account...</p>
          ) : canViewCurrentPage ? (
            children
          ) : null}
        </div>
      </div>
    </div>
  );
}
