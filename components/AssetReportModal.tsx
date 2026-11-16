"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ASSET_REPORT_CONDITIONS,
  ASSET_REPORT_TYPES,
} from "@/lib/asset-reports";
import { useAuth } from "@/components/AuthProvider";

type ReportableAsset = {
  id: string;
  name: string;
  rfidUid?: string;
  category: string;
};

type AssetReportModalProps = {
  assets: ReportableAsset[];
};

const MAX_PICTURE_BYTES = 2 * 1024 * 1024;

export default function AssetReportModal({ assets }: AssetReportModalProps) {
  const { role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<ReportableAsset | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [reportType, setReportType] = useState("");
  const [title, setTitle] = useState("");
  const [suggestedCondition, setSuggestedCondition] = useState("");
  const [details, setDetails] = useState("");
  const [picture, setPicture] = useState("");
  const [pictureError, setPictureError] = useState("");
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pictureInputRef = useRef<HTMLInputElement>(null);

  const search = assetQuery.trim().toLowerCase();
  const matchingAssets = assets
    .filter((asset) =>
      [asset.name, asset.rfidUid, asset.category].some((value) =>
        value?.toLowerCase().includes(search)
      )
    )
    .slice(0, 8);
  const suggestions = search ? matchingAssets : assets.slice(0, 8);

  useEffect(() => {
    if (!isOpen || role !== "guest") return;

    let active = true;
    async function loadQuota() {
      try {
        const response = await fetch("/api/asset-reports/quota");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Unable to load report quota.");
        }
        if (active) setQuotaRemaining(data.remaining);
      } catch (quotaError) {
        console.error("Error loading asset report quota:", quotaError);
        if (active) {
          setError(
            quotaError instanceof Error
              ? quotaError.message
              : "Unable to load report quota."
          );
        }
      }
    }

    void loadQuota();
    return () => {
      active = false;
    };
  }, [isOpen, role]);

  function resetForm() {
    setAssetQuery("");
    setSelectedAsset(null);
    setShowSuggestions(false);
    setReportType("");
    setTitle("");
    setSuggestedCondition("");
    setDetails("");
    setPicture("");
    setPictureError("");
    setQuotaRemaining(null);
    setError("");
    setSubmitted(false);
  }

  function chooseAsset(asset: ReportableAsset) {
    setSelectedAsset(asset);
    setAssetQuery(asset.name);
    setShowSuggestions(false);
    setActiveSuggestionIndex(0);
    setError("");
  }

  function handleAssetKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setShowSuggestions(false);
      return;
    }
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestionIndex((index) =>
        Math.min(index + 1, suggestions.length - 1)
      );
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
    } else if (
      event.key === "Enter" &&
      showSuggestions &&
      suggestions[activeSuggestionIndex]
    ) {
      event.preventDefault();
      chooseAsset(suggestions[activeSuggestionIndex]);
    }
  }

  async function handlePictureChange(file?: File) {
    setPictureError("");
    if (!file) {
      setPicture("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPicture("");
      setPictureError("Choose an image file.");
      if (pictureInputRef.current) pictureInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_PICTURE_BYTES) {
      setPicture("");
      setPictureError("Picture must be 2 MB or smaller.");
      if (pictureInputRef.current) pictureInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPicture(reader.result);
    };
    reader.onerror = () => setPictureError("The picture could not be read.");
    reader.readAsDataURL(file);
  }

  function clearPicture() {
    setPicture("");
    setPictureError("");
    if (pictureInputRef.current) pictureInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selectedAsset || selectedAsset.name !== assetQuery) {
      setError("Choose an asset from the suggestion list.");
      return;
    }
    if (pictureError) {
      setError(pictureError);
      return;
    }
    if (!reportType || !details.trim()) {
      setError("Choose a report type and enter details.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/asset-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          type: reportType,
          title,
          suggestedCondition,
          details,
          picture: picture || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 429) setQuotaRemaining(0);
        throw new Error(data.message || "Unable to submit asset report.");
      }
      setSubmitted(true);
      if (role === "guest" && quotaRemaining !== null) {
        setQuotaRemaining(Math.max(0, quotaRemaining - 1));
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit asset report."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setIsOpen(true);
        }}
        className="inline-flex h-12 items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 text-base font-semibold text-gray-800 transition hover:bg-gray-50"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3v18l7-4 5 3 6-3V4l-6 3-5-3-7 3zm7 1v13m5-10v13"
          />
        </svg>
        Report Asset
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-report-title"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="asset-report-title" className="text-xl font-bold text-gray-900">
                Report Asset
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-2xl leading-none text-gray-500 hover:text-gray-800"
                aria-label="Close report form"
              >
                ×
              </button>
            </div>

            {submitted ? (
              <div className="space-y-4">
                <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
                  Your asset report was submitted.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                {role === "guest" && (
                  <p className="text-sm text-gray-600" aria-live="polite">
                    {quotaRemaining === null
                      ? "Loading daily report quota..."
                      : `${quotaRemaining} of 5 reports left today`}
                  </p>
                )}

                <div>
                  <label
                    htmlFor="asset-report-asset"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Asset
                  </label>
                  <div className="relative">
                    <input
                      id="asset-report-asset"
                      type="text"
                      autoComplete="off"
                      value={assetQuery}
                      onFocus={() => setShowSuggestions(true)}
                      onChange={(event) => {
                        setAssetQuery(event.target.value);
                        setSelectedAsset(null);
                        setShowSuggestions(true);
                        setActiveSuggestionIndex(0);
                      }}
                      onKeyDown={handleAssetKeyDown}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      placeholder="Search by name, tag ID, or category"
                      aria-autocomplete="list"
                      aria-expanded={showSuggestions}
                    />
                    {showSuggestions && (
                      <ul
                        className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                        role="listbox"
                      >
                        {suggestions.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-gray-500">
                            No matching assets
                          </li>
                        ) : (
                          suggestions.map((asset, index) => (
                            <li key={asset.id} role="option" aria-selected={selectedAsset?.id === asset.id}>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => chooseAsset(asset)}
                                onMouseEnter={() => setActiveSuggestionIndex(index)}
                                className={`w-full px-3 py-2 text-left text-sm ${
                                  index === activeSuggestionIndex
                                    ? "bg-red-50 text-red-800"
                                    : "text-gray-800 hover:bg-gray-50"
                                }`}
                              >
                                <span className="font-medium">{asset.name}</span>
                                <span className="ml-2 text-gray-500">{asset.rfidUid || "—"}</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  {selectedAsset && (
                    <p className="mt-1 text-xs text-green-700">
                      Selected: {selectedAsset.name} · {selectedAsset.rfidUid || "—"}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="asset-report-type"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Report type
                  </label>
                  <select
                    id="asset-report-type"
                    required
                    value={reportType}
                    onChange={(event) => setReportType(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  >
                    <option value="">Select a type</option>
                    {ASSET_REPORT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="asset-report-title-input"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Title <span className="font-normal text-gray-500">(optional)</span>
                  </label>
                  <input
                    id="asset-report-title-input"
                    type="text"
                    maxLength={80}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="asset-report-condition"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Suggested condition <span className="font-normal text-gray-500">(optional)</span>
                  </label>
                  <select
                    id="asset-report-condition"
                    value={suggestedCondition}
                    onChange={(event) => setSuggestedCondition(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  >
                    <option value="">No suggestion</option>
                    {ASSET_REPORT_CONDITIONS.map((condition) => (
                      <option key={condition} value={condition}>{condition}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="asset-report-details"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Details
                  </label>
                  <textarea
                    id="asset-report-details"
                    required
                    maxLength={1000}
                    rows={4}
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="asset-report-picture"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Picture <span className="font-normal text-gray-500">(optional, max 2 MB)</span>
                  </label>
                  <input
                    id="asset-report-picture"
                    ref={pictureInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={(event) => void handlePictureChange(event.target.files?.[0])}
                    className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium"
                  />
                  {pictureError && (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm text-red-600" role="alert">{pictureError}</p>
                      <button
                        type="button"
                        onClick={clearPicture}
                        className="text-sm font-medium text-gray-700 underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  {picture && (
                    <div className="mt-2 flex items-start gap-3">
                      <img src={picture} alt="Selected report" className="h-20 w-20 rounded-lg border object-cover" />
                      <button
                        type="button"
                        onClick={clearPicture}
                        className="text-sm text-red-700 hover:text-red-900"
                      >
                        Remove picture
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
