import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SDCA Asset Management System",
  description: "Manage school assets efficiently",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
