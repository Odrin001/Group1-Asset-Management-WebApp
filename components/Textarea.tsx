import React from "react";

interface TextareaProps {
  label?: string;
  id: string;
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
  helperText?: string;
  error?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}

/**
 * Textarea - Reusable textarea component for longer text
 */
export function Textarea({
  label,
  id,
  placeholder,
  icon,
  required,
  helperText,
  error,
  value,
  onChange,
  rows = 4,
}: Readonly<TextareaProps>) {
  return (
    <div>
      {label && (
        <div className="flex items-center gap-2 mb-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <label htmlFor={id} className="text-sm font-semibold text-gray-900">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
      )}
      <textarea
        id={id}
        placeholder={placeholder}
        value={value || ""}
        onChange={onChange}
        rows={rows}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent resize-none transition ${
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-gray-300 focus:ring-primary-500"
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}
