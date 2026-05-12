import type { Metadata, Viewport } from "next";
import "./globals.css";
import { loadUpcomingElections } from "@/lib/loadUpcoming";
import { UpcomingElectionsBar } from "@/features/upcoming/UpcomingElectionsBar";

export const metadata: Metadata = {
  title: "Seoul Election Atlas",
  description:
    "Interactive map of National Assembly election outcomes across Seoul districts.",
};

// Explicit viewport + theme color so mobile Safari's URL bar and the
// Android chrome match the page background, and the layout stays at the
// device width (no janky desktop-shrink scaling).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafafa",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const upcoming = await loadUpcomingElections();

  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        <UpcomingElectionsBar elections={upcoming} />
        {children}
      </body>
    </html>
  );
}
