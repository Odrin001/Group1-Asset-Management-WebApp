import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  type?: "submit" | "button" | "reset";
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

/**
 * Button - Reusable button component with variants
 */
export function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  onClick,
  className = "",
}: Readonly<ButtonProps>) {
  const baseStyles =
    "font-semibold rounded-lg transition duration-200 flex items-center gap-2 justify-center";

  const variants = {
    primary: "bg-primary-500 text-white hover:bg-primary-600 disabled:bg-primary-300",
    secondary:
      "border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-50",
    danger: "bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300",
  };

  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-6 py-3",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        <svg
          className="w-5 h-5 animate-spin"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 1v6m4.22-4.22l-4.24 4.24m0 0l-4.24-4.24M16.22 6.78l-4.24 4.24"
          />
        </svg>
      ) : (
        icon
      )}
      <span>{loading ? "Loading..." : children}</span>
    </button>
  );
}
