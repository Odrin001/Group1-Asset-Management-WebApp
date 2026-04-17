import React from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  id: string;
  options: SelectOption[];
  icon?: React.ReactNode;
  required?: boolean;
  helperText?: string;
  error?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * Select - Reusable dropdown component
 */
export function Select({
  label,
  id,
  options,
  icon,
  required,
  helperText,
  error,
  value,
  onChange,
}: SelectProps) {
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
      <select
        id={id}
        value={value || ""}
        onChange={onChange}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white text-gray-900 transition ${
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-gray-300 focus:ring-primary-500"
        }`}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}
