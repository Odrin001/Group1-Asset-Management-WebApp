"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Account = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  status?: string;
  createdAt?: string | null;
};

const roles = ["sysadmin", "admin", "guest"];
const statuses = ["pending", "active", "rejected"];

type AccountLog = {
  _id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  action: string;
  who: { name: string; email: string };
  timestamp: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function formatLogValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [allLogs, setAllLogs] = useState<AccountLog[]>([]);
  const [allLogsLoading, setAllLogsLoading] = useState(true);
  const [allLogsError, setAllLogsError] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logFromDate, setLogFromDate] = useState("");
  const [logToDate, setLogToDate] = useState("");
  const [logsRefresh, setLogsRefresh] = useState(0);
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null);
  const [accountHistory, setAccountHistory] = useState<AccountLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const loadAccounts = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/accounts");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load accounts");
      }
      setAccounts(data.users);
      setSelectedRoles(
        Object.fromEntries(data.users.map((account: Account) => [account._id, account.role]))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAllLogsLoading(true);
      setAllLogsError("");
      const params = new URLSearchParams();
      if (logSearch.trim()) {
        params.set("search", logSearch.trim());
      }
      if (logFromDate) {
        params.set("from", logFromDate);
      }
      if (logToDate) {
        params.set("to", logToDate);
      }

      try {
        const response = await fetch(
          `/api/admin/account-logs?${params.toString()}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to load account changes");
        }
        setAllLogs(data.logs);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setAllLogsError(
          err instanceof Error ? err.message : "Failed to load account changes"
        );
      } finally {
        if (!controller.signal.aborted) {
          setAllLogsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [logFromDate, logSearch, logToDate, logsRefresh]);

  const filteredAccounts = useMemo(() => {
    const search = accountSearch.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesSearch =
        !search ||
        account.fullName.toLowerCase().includes(search) ||
        account.email.toLowerCase().includes(search);
      const matchesStatus =
        statusFilter === "all" ||
        (account.status || "active") === statusFilter;
      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [accountSearch, accounts, roleFilter, statusFilter]);

  async function updateAccount(id: string, updates: { role?: string; status?: string }) {
    setError("");
    try {
      const response = await fetch(`/api/admin/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update account");
      }
      await loadAccounts();
      setLogsRefresh((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account");
    }
  }

  async function openHistory(account: Account) {
    setHistoryAccount(account);
    setAccountHistory([]);
    setHistoryError("");
    setHistoryLoading(true);
    try {
      const response = await fetch(
        `/api/admin/account-logs?accountId=${encodeURIComponent(account._id)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load account history");
      }
      setAccountHistory(data.logs);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to load account history"
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Approve registrations and manage account roles.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Search accounts by name or email"
          placeholder="Search name or email..."
          value={accountSearch}
          onChange={(event) => setAccountSearch(event.target.value)}
          className="min-w-60 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All roles</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role === "sysadmin"
                ? "Sysadmin"
                : role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-500">Loading accounts...</p>
        ) : filteredAccounts.length === 0 ? (
          <p className="p-6 text-gray-500">No matching accounts</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Registered</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account._id} className="border-t border-gray-100">
                  <td className="px-5 py-4 font-medium text-gray-900">{account.fullName}</td>
                  <td className="px-5 py-4 text-gray-600">{account.email}</td>
                  <td className="px-5 py-4 capitalize text-gray-600">{account.status || "active"}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Role for ${account.email}`}
                        value={selectedRoles[account._id] || "guest"}
                        onChange={(event) =>
                          setSelectedRoles((current) => ({
                            ...current,
                            [account._id]: event.target.value,
                          }))
                        }
                        className="rounded border border-gray-300 px-2 py-1"
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          void updateAccount(account._id, {
                            role: selectedRoles[account._id] || "guest",
                          })
                        }
                        className="rounded bg-slate-700 px-3 py-1 text-white hover:bg-slate-800"
                      >
                        Save role
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600">
                    {formatDate(account.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {account.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void updateAccount(account._id, { status: "active" })}
                            className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateAccount(account._id, { status: "rejected" })}
                            className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void openHistory(account)}
                        className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50"
                      >
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="space-y-4">
        <header>
          <h2 className="text-2xl font-bold text-gray-900">All account changes</h2>
        </header>
        <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <input
            type="search"
            aria-label="Search account changes"
            placeholder="Search account or who changed it..."
            value={logSearch}
            onChange={(event) => setLogSearch(event.target.value)}
            className="min-w-60 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            From
            <input
              type="date"
              value={logFromDate}
              onChange={(event) => setLogFromDate(event.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            To
            <input
              type="date"
              value={logToDate}
              onChange={(event) => setLogToDate(event.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-2"
            />
          </label>
        </div>
        {allLogsError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {allLogsError}
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {allLogsLoading ? (
            <p className="p-6 text-gray-500">Loading account changes...</p>
          ) : allLogs.length === 0 ? (
            <p className="p-6 text-gray-500">No account changes found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Changed by</th>
                  <th className="px-5 py-3">Date and time</th>
                  <th className="px-5 py-3">Change</th>
                </tr>
              </thead>
              <tbody>
                {allLogs.map((log) => (
                  <tr key={log._id} className="border-t border-gray-100">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{log.accountName}</p>
                      <p className="text-gray-600">{log.accountEmail}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {log.action.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {log.who.name} ({log.who.email})
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {log.field
                        ? `${log.field}: ${formatLogValue(log.oldValue)} → ${formatLogValue(log.newValue)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {historyAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Account history
                </h2>
                <p className="text-sm text-gray-500">
                  {historyAccount.fullName} ({historyAccount.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryAccount(null)}
                className="text-2xl text-gray-500 hover:text-gray-700"
                aria-label="Close account history"
              >
                ×
              </button>
            </div>
            {historyError && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {historyError}
              </div>
            )}
            {historyLoading ? (
              <p className="py-4 text-gray-500">Loading history...</p>
            ) : accountHistory.length === 0 ? (
              <p className="py-4 text-gray-500">No account history found.</p>
            ) : (
              <ol className="space-y-4">
                {accountHistory.map((log) => (
                  <li key={log._id} className="border-l-2 border-red-200 pl-4">
                    <p className="font-semibold text-gray-900">
                      {log.action.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatDateTime(log.timestamp)} · {log.who.name} ({log.who.email})
                    </p>
                    {log.field && (
                      <p className="mt-2 text-sm text-gray-700">
                        {log.field}: {formatLogValue(log.oldValue)} →{" "}
                        {formatLogValue(log.newValue)}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
