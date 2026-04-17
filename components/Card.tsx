import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Card - Simple container component for grouped content
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

/**
 * CardHeader - Title section for a card with optional icon
 */
export function CardHeader({ title, description, icon }: CardHeaderProps) {
  return (
    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CardBody - Content container for a card
 */
export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`p-8 space-y-6 ${className}`}>{children}</div>;
}
