import type { Party, PartyFamily } from "@/types";

// Fallback palette for when a party lacks an election-specific or default color.
// Tokens mirror 04 Design/Color System.md.
const FAMILY_FALLBACK: Record<PartyFamily, string> = {
  liberal: "#3D6FCF",
  conservative: "#D84545",
  progressive: "#F2A900",
  centrist: "#6B8E8A",
  minor: "#9C9C9C",
  independent: "#5A5A5A",
};

export function colorFor(
  party: Party | undefined,
  electionYear: number | string,
): string {
  if (!party) return FAMILY_FALLBACK.independent;
  const yearKey = String(electionYear);
  return (
    party.colors[yearKey] ??
    party.colors.default ??
    FAMILY_FALLBACK[party.family] ??
    "#888888"
  );
}

export function familyFallback(family: PartyFamily): string {
  return FAMILY_FALLBACK[family];
}
