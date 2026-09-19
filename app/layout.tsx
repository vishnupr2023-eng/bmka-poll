import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BMKA Kerala Thanima Voting Portal",
  description: "Official Audience Voting Portal for BMKA Kerala Thanima 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
