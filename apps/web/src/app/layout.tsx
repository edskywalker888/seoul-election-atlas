import type { Metadata } from "next";
import "./globals.css";
import { loadUpcomingElections } from "@/lib/loadUpcoming";
import { UpcomingElectionsBar } from "@/features/upcoming/UpcomingElectionsBar";

export const metadata: Metadata = {
  title: "Seoul Election Atlas",
  description:
    "Interactive map of National Assembly election outcomes across Seoul districts.",
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
