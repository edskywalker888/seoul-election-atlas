/**
 * Margin-of-victory color intensity. Maps a winner's vote_pct to a
 * white-mix ratio so close races render as pale shades and landslides
 * render as deep saturated colors.
 *
 * Calibrated for Korean two-party constituency races where winners
 * typically land between 48% and 70%.
 */

const PALE_RATIO = 0.7;
const SATURATE_PCT = 70;
const PALE_PCT = 45;

/**
 * Linear interpolation between a base hex color and white.
 * ratio = 0 → original color
 * ratio = 1 → white
 */
export function mixWithWhite(hex: string, ratio: number): string {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const clamped = Math.max(0, Math.min(1, ratio));
  const mix = (c: number) => Math.round(c + (255 - c) * clamped);
  return (
    "#" +
    [mix(r), mix(g), mix(b)]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Maps a winner's vote_pct to a white-mix ratio.
 *  - >= 70% → 0 (full saturation; landslide)
 *  - <= 45% → PALE_RATIO (very pale; effectively a tie)
 *  - linear between
 */
export function intensityWhiteRatio(votePct: number): number {
  if (votePct >= SATURATE_PCT) return 0;
  if (votePct <= PALE_PCT) return PALE_RATIO;
  return ((SATURATE_PCT - votePct) / (SATURATE_PCT - PALE_PCT)) * PALE_RATIO;
}

/**
 * Convenience: produce the fill color for a district given the party's
 * base color and the winner's vote share.
 */
export function fillWithIntensity(
  baseHex: string,
  votePct: number | undefined,
): string {
  if (votePct == null) return baseHex;
  return mixWithWhite(baseHex, intensityWhiteRatio(votePct));
}

/**
 * Stops used by the legend gradient bar. Renders 5 tints from pale (PALE_PCT)
 * to deep (SATURATE_PCT+).
 */
export const INTENSITY_STOPS = [PALE_PCT, 50, 55, 60, 65, SATURATE_PCT];

export const INTENSITY_RANGE = { palePct: PALE_PCT, saturatePct: SATURATE_PCT };
