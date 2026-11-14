"use client";

import { useCallback, useEffect, useState } from "react";

type Account = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  status?: string;
  createdAt: string;
};

const roles = ["sysadmin", "admin", "guest"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account");
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

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-500">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <p className="p-6 text-gray-500">No accounts found.</p>
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
              {accounts.map((account) => (
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
                    {new Date(account.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    {account.status === "pending" ? (
                      <div className="flex gap-2">
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
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
