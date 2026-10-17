import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyTracker",
  description: "Skytales planleggingsverktøy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb" className="h-full antialiased">
      <body className="h-full flex flex-col overflow-hidden">{children}</body>
    </html>
  );
}
